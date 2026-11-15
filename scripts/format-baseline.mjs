import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const baselinePath = path.join(root, 'docs/quality/prettier-baseline.json');
const result = spawnSync(
  'node_modules/.bin/prettier',
  ['--ignore-path', '.gitignore', '--ignore-path', '.prettierignore', '--list-different', '.'],
  {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  },
);

if (result.error) throw result.error;

const current = new Set(
  result.stdout
    .split('\n')
    .map((file) => file.trim().replaceAll('\\', '/').replace(/^\.\//, ''))
    .filter(Boolean),
);

if (process.argv.includes('--write-baseline')) {
  await mkdir(path.dirname(baselinePath), { recursive: true });
  await writeFile(
    baselinePath,
    `${JSON.stringify({ schemaVersion: 1, files: [...current].sort() }, null, 2)}\n`,
  );
  console.log(`Saved Prettier baseline: ${current.size} existing files.`);
  process.exit(0);
}

let baseline;

try {
  baseline = new Set(JSON.parse(await readFile(baselinePath, 'utf8')).files);
} catch {
  console.error(`Missing baseline ${path.relative(root, baselinePath)}.`);
  process.exit(2);
}

const added = [...current].filter((file) => !baseline.has(file));
const fixed = [...baseline].filter((file) => !current.has(file));

console.log(
  `Prettier baseline: ${current.size} files need formatting; ${added.length} new, ${fixed.length} fixed.`,
);

if (added.length) {
  for (const file of added) console.error(file);
  process.exit(1);
}
