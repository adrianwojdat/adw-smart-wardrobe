import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('apps/web/src');
const files = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) walk(fullPath);
    else if (entry.name === 'en.json' || path.basename(directory) === 'en') files.push(fullPath);
  }
}

walk(root);
walk(path.resolve('packages/shared/src/travel-packing/locales'));

const errors = [];
const tokens = (value) =>
  [...value.matchAll(/{{\s*-?\s*([\w.]+)\s*-?\s*}}/g)].map((match) => match[1]).sort();

function compare(en, pl, location) {
  const enIsObject = en !== null && typeof en === 'object' && !Array.isArray(en);
  const plIsObject = pl !== null && typeof pl === 'object' && !Array.isArray(pl);

  if (enIsObject !== plIsObject) {
    errors.push(`${location}: different value shape in en/pl`);

    return;
  }

  if (enIsObject) {
    const enKeys = Object.keys(en).sort();
    const plKeys = Object.keys(pl).sort();

    for (const key of enKeys)
      if (!Object.hasOwn(pl, key)) errors.push(`${location}.${key}: missing in pl`);
    for (const key of plKeys)
      if (!Object.hasOwn(en, key)) errors.push(`${location}.${key}: missing in en`);
    for (const key of enKeys)
      if (Object.hasOwn(pl, key)) compare(en[key], pl[key], `${location}.${key}`);

    return;
  }

  if (typeof en !== 'string' || typeof pl !== 'string') {
    errors.push(`${location}: translations must be strings`);

    return;
  }

  if (!en.trim() || !pl.trim()) errors.push(`${location}: empty translation`);
  if (JSON.stringify(tokens(en)) !== JSON.stringify(tokens(pl)))
    errors.push(`${location}: interpolation parameters differ (${tokens(en)} vs ${tokens(pl)})`);
}

for (const enFile of files) {
  const plFile =
    path.basename(enFile) === 'en.json'
      ? path.join(path.dirname(enFile), 'pl.json')
      : path.join(path.dirname(path.dirname(enFile)), 'pl', path.basename(enFile));

  if (!fs.existsSync(plFile)) {
    errors.push(`${path.relative(root, enFile)}: missing paired pl.json`);
    continue;
  }

  try {
    compare(
      JSON.parse(fs.readFileSync(enFile, 'utf8')),
      JSON.parse(fs.readFileSync(plFile, 'utf8')),
      path.relative(root, enFile),
    );
  } catch (error) {
    errors.push(`${path.relative(root, enFile)}: invalid JSON (${error.message})`);
  }
}

if (errors.length) {
  console.error(
    `i18n check failed with ${errors.length} issue(s):\n${errors.map((error) => `- ${error}`).join('\n')}`,
  );
  process.exitCode = 1;
} else {
  console.log(`i18n check passed: ${files.length} English/Polish resource pairs are complete.`);
}
