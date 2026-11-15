import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const baselinePath = path.join(root, 'docs/quality/knip-baseline.json');
const result = spawnSync('node_modules/.bin/knip', ['--no-progress', '--reporter', 'json'], {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: 20 * 1024 * 1024,
});

if (result.error) throw result.error;

let report;

try {
  report = JSON.parse(result.stdout);
} catch {
  console.error(result.stderr || result.stdout);
  console.error('Failed to parse the Knip report as JSON.');
  process.exit(2);
}

const current = new Map();

for (const issue of report.issues ?? []) {
  for (const [type, findings] of Object.entries(issue)) {
    if (!Array.isArray(findings)) continue;

    for (const finding of findings) {
      const fingerprint = JSON.stringify({
        file: issue.file ?? '.',
        type,
        name: finding.name ?? finding.symbol ?? finding.text ?? '(unnamed)',
      });

      current.set(fingerprint, (current.get(fingerprint) ?? 0) + 1);
    }
  }
}

const count = (map) => [...map.values()].reduce((sum, value) => sum + value, 0);
const breakdown = (map) => {
  const totals = new Map();

  for (const [key, amount] of map) {
    const type = JSON.parse(key).type;

    totals.set(type, (totals.get(type) ?? 0) + amount);
  }

  return Object.fromEntries([...totals].sort(([a], [b]) => a.localeCompare(b)));
};

if (process.argv.includes('--write-baseline')) {
  await mkdir(path.dirname(baselinePath), { recursive: true });

  const issues = Object.fromEntries([...current.entries()].sort(([a], [b]) => a.localeCompare(b)));

  await writeFile(baselinePath, `${JSON.stringify({ schemaVersion: 1, issues }, null, 2)}\n`);
  console.log(
    `Zapisano baseline Knip: ${count(current)} issue(s), ${JSON.stringify(breakdown(current))}.`,
  );
  process.exit(0);
}

let baseline;

try {
  baseline = JSON.parse(await readFile(baselinePath, 'utf8')).issues;
} catch {
  console.error(`Missing baseline ${path.relative(root, baselinePath)}.`);
  process.exit(2);
}

const added = [];

for (const [fingerprint, amount] of current) {
  const extra = amount - (baseline[fingerprint] ?? 0);

  if (extra > 0) added.push({ fingerprint, amount: extra });
}

const addedCount = added.reduce((sum, item) => sum + item.amount, 0);
const fixedCount = Object.entries(baseline).reduce(
  (sum, [fingerprint, amount]) => sum + Math.max(0, amount - (current.get(fingerprint) ?? 0)),
  0,
);

console.log(
  `Knip baseline: ${count(current)} issue(s), ${addedCount} new, ${fixedCount} fixed; ${JSON.stringify(breakdown(current))}.`,
);

if (addedCount) {
  for (const issue of added.slice(0, 30)) console.error(issue.fingerprint);
  process.exit(1);
}
