import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import ts from 'typescript';

import { isLikelyPolish } from './lib/language-policy.mjs';

const legacy = JSON.parse(fs.readFileSync('scripts/language-exceptions.json', 'utf8'));
const files = [
  ...new Set(
    execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
      encoding: 'utf8',
    })
      .split('\0')
      .filter(Boolean),
  ),
];
const errors = [];
let checked = 0;

function report(file, text, offset, content) {
  if (!isLikelyPolish(content)) return;

  const line = text.slice(0, offset).split('\n').length;

  // Report locations only: source content could contain private diagnostic data.
  errors.push(`${file}:${line}: suspected Polish prose outside a localization resource`);
}

for (const file of files) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) continue;
  if (!/\.(?:[cm]?[jt]sx?|md|html|json|ya?ml|sql)$/u.test(file)) continue;
  if (/^(?:infra\/supabase\/|data\/|investigation\/|docs\/quality\/)/u.test(file)) continue;
  if (/(?:^|\/)(?:node_modules|dist|coverage|test-results|playwright-report)\//u.test(file))
    continue;
  if (/(?:^|\/)locales\/pl(?:\/|\.json$)|\/pl-PL\/|(?:content|common)\.pl-PL\.json$/u.test(file))
    continue;
  if (file === 'pnpm-lock.yaml' || (file.startsWith('infra/models/') && file.endsWith('.json')))
    continue;

  const text = fs.readFileSync(file, 'utf8');

  if (file === 'infra/models/fashion-siglip/prototypes.json') continue; // Intentional classifier vocabulary.

  if (legacy.immutableMigrations[file]) {
    if (createHash('sha256').update(text).digest('hex') !== legacy.immutableMigrations[file])
      errors.push(`${file}: immutable migration differs from its reviewed language exception`);
    continue;
  }

  checked++;

  if (/\.[cm]?[jt]sx?$/u.test(file)) {
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    const testFile = /(?:^|\/)(?:tests|__tests__|test)\/|\.(?:test|spec)\.[jt]sx?$/u.test(file);
    const corpus = Object.hasOwn(legacy.multilingualData, file);
    const visit = (node) => {
      if (
        ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node) ||
        ts.isTemplateHead(node) ||
        ts.isTemplateMiddle(node) ||
        ts.isTemplateTail(node)
      ) {
        const parent = node.parent;
        const technical =
          ts.isNewExpression(parent) ||
          (ts.isCallExpression(parent) &&
            /^(?:it|test|describe|(?:console|logger)\.(?:warn|error|info|log))$/u.test(
              parent.expression.getText(source),
            ));

        if (technical || (!testFile && !corpus))
          report(file, text, node.getStart(source), node.text);
      }

      ts.forEachChild(node, visit);
    };

    visit(source);

    const scanner = ts.createScanner(
      ts.ScriptTarget.Latest,
      false,
      ts.LanguageVariant.Standard,
      text,
    );

    for (
      let token = scanner.scan();
      token !== ts.SyntaxKind.EndOfFileToken;
      token = scanner.scan()
    ) {
      if (
        token === ts.SyntaxKind.SingleLineCommentTrivia ||
        token === ts.SyntaxKind.MultiLineCommentTrivia
      )
        report(file, text, scanner.getTokenPos(), scanner.getTokenText());
    }
  } else {
    let offset = 0;

    for (const line of text.split('\n')) {
      if (
        ['docker-compose.yml', 'docker-compose.prod.yml'].includes(file) &&
        /^\s+GOTRUE_MAILER_SUBJECTS_[A-Z_]+:/u.test(line)
      ) {
        offset += line.length + 1;
        continue; // Generated Polish mail subjects, paired with versioned pl-PL templates.
      }

      const fixtureLine = /^tests\/.*\.sql$/u.test(file)
        ? line.replace(/'(?:''|[^'])*'/gu, (literal, index) =>
            /raise exception\s*$/iu.test(line.slice(0, index)) ? literal : '',
          )
        : line;
      const prose = fixtureLine.replace(/`[^`]*`|\]\([^)]*\)|<a id="[^"]*"><\/a>/gu, '');

      report(file, text, offset, prose);
      offset += line.length + 1;
    }
  }
}

if (errors.length) {
  console.error([...new Set(errors)].join('\n'));
  process.exitCode = 1;
} else
  console.log(
    `English-first language check passed (${checked} authored files; reviewed localization and immutable-history exceptions).`,
  );
