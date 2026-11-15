import { ESLint } from 'eslint';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const baselinePath = path.join(root, 'docs/quality/eslint-baseline.json');
const eslint = new ESLint();
const staged = process.argv.includes('--staged');
const targets = staged
  ? execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
      encoding: 'utf8',
    })
      .split('\n')
      .filter((file) => /\.(?:[cm]?js|[cm]?ts|tsx|jsx)$/.test(file))
  : ['.'];

if (staged && targets.length === 0) {
  console.log('No staged JS/TS files to lint.');
  process.exit(0);
}

const results = await eslint.lintFiles(targets);
const current = new Map();

for (const result of results) {
  const file = path.relative(root, result.filePath).split(path.sep).join('/');

  for (const message of result.messages) {
    const fingerprint = JSON.stringify({
      file,
      severity: message.severity,
      ruleId: message.ruleId ?? 'fatal',
    });

    current.set(fingerprint, (current.get(fingerprint) ?? 0) + 1);
  }
}

const totals = (map) => [...map.values()].reduce((sum, count) => sum + count, 0);

if (process.argv.includes('--write-baseline')) {
  const diagnostics = Object.fromEntries(
    [...current.entries()].sort(([a], [b]) => a.localeCompare(b)),
  );

  await mkdir(path.dirname(baselinePath), { recursive: true });
  await writeFile(baselinePath, `${JSON.stringify({ schemaVersion: 1, diagnostics }, null, 2)}\n`);
  console.log(`Saved baseline: ${totals(current)} known ESLint diagnostics.`);
  process.exit(0);
}

let baseline;

try {
  baseline = JSON.parse(await readFile(baselinePath, 'utf8')).diagnostics;
} catch {
  console.error(
    `Missing baseline ${path.relative(root, baselinePath)}. Review and save it explicitly first.`,
  );
  process.exit(2);
}

const newDiagnostics = [];

for (const [fingerprint, count] of current) {
  const previous = baseline[fingerprint] ?? 0;

  if (count > previous) newDiagnostics.push({ fingerprint, count: count - previous });
}

const newCount = newDiagnostics.reduce((sum, item) => sum + item.count, 0);
const fixedCount = [...Object.entries(baseline)].reduce(
  (sum, [fingerprint, count]) => sum + Math.max(0, count - (current.get(fingerprint) ?? 0)),
  0,
);

console.log(
  `ESLint typed ${staged ? '(staged) ' : ''}baseline: ${totals(current)} diagnostics; ${newCount} new, ${fixedCount} resolved against the baseline.`,
);

if (newCount) {
  for (const issue of newDiagnostics.slice(0, 20)) console.error(issue.fingerprint);
  process.exit(1);
}
