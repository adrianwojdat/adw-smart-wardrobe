import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const roots = [
  { path: 'apps/web/src', allowed: new Set(['main.tsx', 'vite-env.d.ts']) },
  { path: 'apps/api/src', allowed: new Set(['index.ts']) },
  { path: 'apps/worker/src', allowed: new Set(['index.ts']) },
];
const violations = [];
const files = [];

async function collect(directory) {
  for (const name of await readdir(directory)) {
    const entry = path.join(directory, name);

    if ((await stat(entry)).isDirectory()) await collect(entry);
    else if (/\.tsx?$/.test(name)) files.push(entry);
  }
}

for (const root of roots) {
  for (const name of await readdir(root.path)) {
    const entry = path.join(root.path, name);

    if ((await stat(entry)).isFile() && !root.allowed.has(name)) violations.push(entry);
  }

  await collect(root.path);
}

const moduleFrom = (file) => file.match(/apps\/web\/src\/features\/([^/]+)/)?.[1];
const importPattern = /(?:from\s*|import\s*\()(['"])(\.{1,2}\/[^'"]+)\1/g;

for (const file of files) {
  const source = await (await import('node:fs/promises')).readFile(file, 'utf8');
  const fromFeature = moduleFrom(file);

  for (const match of source.matchAll(importPattern)) {
    const base = path.resolve(path.dirname(file), match[2]);
    const candidates = [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')];
    const target = files.find((file) =>
      candidates.some((candidate) => path.resolve(candidate) === path.resolve(file)),
    );

    if (!target) continue;

    const toFeature = moduleFrom(target);

    if (toFeature && toFeature !== fromFeature && path.basename(target) !== 'index.ts') {
      violations.push(`${file} → ${target} (use the public features/${toFeature}/index.ts)`);
    }
  }
}

if (violations.length) {
  console.error('Source layout violations:');
  for (const file of violations) console.error(`- ${file}`);
  process.exit(1);
}

console.log('Source layout and public feature boundaries are valid.');
