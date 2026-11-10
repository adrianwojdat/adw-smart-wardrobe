/* eslint-disable @typescript-eslint/no-require-imports -- Supabase backend uses CommonJS. */
// Compatibility adapter for the pinned Supabase file backend on macOS bind mounts.
// Image bytes remain ordinary files. Only xattr metadata moves to a separate directory.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');

function createAdapter(storageRoot, metadataRoot) {
  storageRoot = path.resolve(storageRoot);
  metadataRoot = path.resolve(metadataRoot);
  const inside = (root, file) => {
    const rel = path.relative(root, file);
    return rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel);
  };
  if (inside(storageRoot, metadataRoot) || inside(metadataRoot, storageRoot))
    throw new Error('Metadata and image directories must be separate');
  fs.mkdirSync(metadataRoot, { recursive: true, mode: 0o700 });
  const realStorage = fs.realpathSync(storageRoot);
  const realMetadata = fs.realpathSync(metadataRoot);
  const missing = () => Object.assign(new Error('Attribute not found'), { code: 'ENODATA' });
  function location(file) {
    file = path.resolve(file);
    if (!inside(storageRoot, file) || file === storageRoot)
      throw new Error('Object is outside storage root');
    let ancestor = file;
    while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor);
    if (!inside(realStorage, fs.realpathSync(ancestor)))
      throw new Error('Object symlink escapes storage root');
    const key = path.relative(storageRoot, file).split(path.sep).join('/');
    return {
      key,
      sidecar: path.join(metadataRoot, createHash('sha256').update(key).digest('hex') + '.json'),
    };
  }
  function read(file) {
    const { key, sidecar } = location(file);
    if (!fs.existsSync(sidecar)) return { version: 1, key, attributes: {} };
    if (fs.lstatSync(sidecar).isSymbolicLink()) throw new Error('Metadata symlink rejected');
    const data = JSON.parse(fs.readFileSync(sidecar, 'utf8'));
    if (
      data.version !== 1 ||
      data.key !== key ||
      !data.attributes ||
      Object.getPrototypeOf(data.attributes) !== Object.prototype
    )
      throw new Error('Invalid sidecar metadata');
    for (const [attr, value] of Object.entries(data.attributes)) {
      validateAttribute(attr);
      if (typeof value !== 'string' || Buffer.from(value, 'base64').toString('base64') !== value)
        throw new Error('Invalid sidecar attribute value');
    }
    return data;
  }
  function write(file, data) {
    const { key, sidecar } = location(file);
    if (fs.realpathSync(metadataRoot) !== realMetadata)
      throw new Error('Metadata directory changed');
    const temp = path.join(metadataRoot, '.' + randomUUID() + '.tmp');
    let fd;
    try {
      fd = fs.openSync(temp, 'wx', 0o600);
      fs.writeFileSync(fd, JSON.stringify({ ...data, key }));
      fs.fsyncSync(fd);
      fs.closeSync(fd);
      fd = undefined;
      fs.renameSync(temp, sidecar);
    } finally {
      if (fd !== undefined) fs.closeSync(fd);
      fs.rmSync(temp, { force: true });
    }
  }
  function validateAttribute(attr) {
    if (!/^user\.supabase\.(cache-control|content-type|content-encoding|etag)$/.test(attr))
      throw new Error('Unsupported metadata attribute');
  }
  function deleteMetadata(file) {
    fs.rmSync(location(file).sidecar, { force: true });
  }
  return {
    getAttributeSync(file, attr) {
      validateAttribute(attr);
      const value = read(file).attributes[attr];
      if (value === undefined) throw missing();
      return Buffer.from(value, 'base64');
    },
    setAttributeSync(file, attr, value) {
      validateAttribute(attr);
      if (!fs.statSync(file).isFile()) throw new Error('Metadata requires an existing object file');
      const data = read(file);
      data.attributes[attr] = Buffer.from(value).toString('base64');
      write(file, data);
    },
    removeAttributeSync(file, attr) {
      validateAttribute(attr);
      const data = read(file);
      if (data.attributes[attr] === undefined) throw missing();
      delete data.attributes[attr];
      write(file, data);
    },
    // Supabase publishes staged uploads/parts with rename. Metadata must follow them.
    async rename(source, destination) {
      const sourceData = read(source);
      const previous = read(destination);
      const destinationExisted = fs.existsSync(location(destination).sidecar);
      write(destination, sourceData);
      try {
        await fs.promises.rename(source, destination);
      } catch (error) {
        if (destinationExisted) write(destination, previous);
        else deleteMetadata(destination);
        throw error;
      }
      deleteMetadata(source);
    },
    async unlink(file) {
      location(file);
      try {
        await fs.promises.unlink(file);
      } catch (error) {
        if (error.code === 'ENOENT') deleteMetadata(file);
        throw error;
      }
      deleteMetadata(file);
    },
    async removePath(directory) {
      const { key } = location(directory);
      const sidecars = fs
        .readdirSync(metadataRoot)
        .filter((name) => /^[a-f0-9]{64}\.json$/.test(name));
      const remove = [];
      for (const name of sidecars) {
        const file = path.join(metadataRoot, name);
        if (fs.lstatSync(file).isSymbolicLink()) throw new Error('Metadata symlink rejected');
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (data.key === key || data.key?.startsWith(key + '/')) remove.push(file);
      }
      await fs.promises.rm(directory, { recursive: true, force: true });
      for (const file of remove) fs.unlinkSync(file);
    },
  };
}
module.exports = { createAdapter };
