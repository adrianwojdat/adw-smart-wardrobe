# Code quality checks

The repository uses pnpm 12 workspaces, Node 26, ESLint 10 flat configuration, TypeScript 6, Prettier 3, Vitest 5, and Playwright. Vitest runs domain and component tests; React tests use React Testing Library, `user-event`, and jsdom.

Prettier controls line layout and indentation. The existing `eslint-plugin-simple-import-sort` and native ESLint `padding-line-between-statements` rule add global import groups and logical spacing. No additional Stylistic plugin is needed. Style configuration is shared by full linting and `eslint.style.config.js`; the latter runs only style rules, without fixing logic, types, or existing ESLint debt.

`pnpm style:fix` runs Prettier, stylistic ESLint with `--fix`, Prettier again to wrap sorted imports, and strict `pnpm style:check`. Both commands cover the entire monorepo. Global fixes were explicitly requested by the user; during normal local changes, format only touched files and review the diff. No stylistic baseline exception was added.

Blank lines are required after imports, before `return`, around function declarations, between variable declarations and executable logic, and after control-flow blocks. Consecutive `const`/`let`/`var` declarations may remain together, as may imports within one group. The rule cannot infer semantic sections or split JSX components; those remain the author’s responsibility.

To preserve initialization order, import sorting is disabled for an entire file containing an import without bindings (`import './initialise'`, CSS, etc.). Its order relative to other imports is preserved; spacing rules still apply. This guards the existing sorter instead of introducing a second sorting mechanism. Type imports remain beside their source group.

Prettier respects `.gitignore` and `.prettierignore`, while ESLint uses a shared exclusion list. Dependencies, builds, coverage, test artifacts, local data, vendored Supabase, the lockfile, model metadata, and immutable migrations are not changed. Translation JSON may be formatted without changing keys or values. Full `pnpm check` starts with strict `style:check`; typed ESLint still tracks existing debt through its separate baseline.

Import groups: (1) React and external libraries, (2) `@wardrobe/*`, (3) shared application infrastructure, (4) other feature modules, (5) local `./` imports. A blank line separates groups and imports from code. Logical spacing is useful around functions, larger statement blocks, and `return`, but not between every statement. Avoid large JSX components: extract views/subcomponents with distinct responsibilities and keep form, validation, and side-effect logic in feature hooks/functions. Always use the proper feature-first directory; `docs/ARCHITECTURE.md` describes boundaries.

The current debt audit and module plan are in [`CODEBASE_AUDIT.md`](./CODEBASE_AUDIT.md), [`ARCHITECTURE.md`](./ARCHITECTURE.md), [`REFACTOR_PLAN.md`](./REFACTOR_PLAN.md), and [`REFACTOR_PROGRESS.md`](./REFACTOR_PROGRESS.md). `pnpm check` uses explicit baselines; passing means no new problems against those baselines, rather than no existing debt.

## Main command

```sh
pnpm check
```

Runs formatting checks without modifying files, typed ESLint, all-workspace typechecks, Vitest, cycle and module-boundary checks, Knip, and builds.

## Individual checks

```sh
pnpm style:fix
pnpm style:check
pnpm format:check
pnpm format:raw
pnpm lint
pnpm lint:raw
pnpm typecheck
pnpm test
pnpm build
pnpm deps:check
pnpm knip:check
pnpm test:e2e
pnpm check:i18n
```

## Interface translations

English (`en`) is the base language and the default; Polish (`pl`) is an optional user choice. All user-visible web copy, including accessibility text, notifications, empty/loading/error states and validation feedback, must use `react-i18next`. Add matching non-empty semantic keys to both feature-local `locales/en.json` and `locales/pl.json`; shared strings live in `apps/web/src/locales/{en,pl}`. Do not translate API values or identifiers. `pnpm check:i18n` checks paired resource shapes, empty strings, and interpolation parity and is part of `pnpm check`.

- `pnpm lint:raw` runs full typed ESLint and displays all findings, including existing debt.
- `pnpm lint` compares the full result with `docs/quality/eslint-baseline.json`, grouping diagnostics by file/rule to avoid fingerprint changes caused only by TypeScript union ordering. Increased counts per file/rule block CI; resolved findings are reported. Typed lint covers unhandled promises, unsafe `any` operations/assertions, unused symbols, and React Hooks rules.
- `pnpm typecheck` checks web, API, worker, and shared. All configurations inherit `strict: true` from `tsconfig.base.json`. `tests/tsconfig.json` supplies type information for typed ESLint on tests.
- `pnpm format:raw` lists every file that fails Prettier. `pnpm format:check` compares them with `docs/quality/prettier-baseline.json`; a newly unformatted file blocks CI. Pre-commit checks staged formatting without modifying files automatically.
- `pnpm deps:check` uses dependency-cruiser for cycles/boundaries: applications must not import one another, and `packages/shared` must not depend on applications. `.dependency-cruiser-known-violations.json` contains only known exceptions. New violations fail the command.
- `pnpm knip:check` detects unused files, dependencies, exports, and types against `docs/quality/knip-baseline.json`. Knip never deletes anything automatically.
- `pnpm test` uses Vitest. Web components use `// @vitest-environment jsdom`; `apps/web/src/test/setup.ts` configures matchers and React Testing Library cleanup.
- `pnpm test:e2e` runs Playwright and requires the local stack at `E2E_BASE_URL` (default `http://localhost:8080`).

## Existing code baseline

The first full typed lint reported **686 diagnostics**. The largest groups were unsafe `any` access (268), `any` assignments (121), unsafe assertions (95), unnecessary `require-await` (51), unsafe calls (43), `any` arguments (42), and misused promises (34). Full details are in `docs/quality/eslint-baseline.json`. Rules remain enabled; the baseline permits gradual debt reduction without blocking new checks.

The first formatting check identified **11 existing files**. They were not reformatted globally during the initial audit; the historical list is explicit in `docs/quality/prettier-baseline.json`, and pre-commit strictly checks changed files.

The first dependency-cruiser run found **13 existing cycles** in `packages/shared` (mainly through the `index.ts` barrel) and **0 application-boundary violations**. Cycles were not hidden in rule configuration; they are recorded explicitly in `.dependency-cruiser-known-violations.json`.

The first Knip run reported 36 findings. After adding tooling scripts, the baseline contained **33 existing findings**: 10 files without recognized entry points, 4 dependencies, 4 exports, 2 types, and 13 imports without explicit dependencies in the test workspace. Some may be used by manual scripts, configuration, or workspace dependencies; review each before removal. Reference report: `docs/quality/knip-baseline.json`.

The initial audit did not run a global `--fix` or delete code based on reports. Global stylistic cleanup was subsequently performed on 2026-11-15 at the user’s explicit request. Baselines were not increased and typing debt was not automatically fixed.

## Git hooks

`pnpm install` runs `prepare` and configures Husky. The `.husky/pre-commit` hook runs lint-staged: typed ESLint checks staged JS/TS against the baseline, and Prettier checks staged files. The hook does not automatically format or modify files.

If the hook does not work after cloning:

```sh
pnpm install
git config --get core.hooksPath
```

The returned path should be `.husky/_`.

## Updating baselines

Fix existing problems and review reports first. Do not add findings merely to silence a check.

- ESLint: `pnpm lint:baseline:write` — use only after reviewing full `pnpm lint:raw` output.
- Prettier: `pnpm format:baseline:write` — add an exception only for a reviewed, previously existing file.
- dependency-cruiser: `pnpm deps:baseline:write` — exceptions need justification and review.
- Knip: `pnpm knip:baseline:write` — confirm manual/indirect use or plan safe removal separately.

Explain every approved baseline refresh in the change review. Do not update baselines during an ordinary refactor without explaining why.

## English-first verification

`pnpm language:check` scans authored code, comments, technical diagnostics and documentation for likely Polish prose. It uses high-confidence words/phrases rather than treating every accented proper name as an error. It is a heuristic, not a complete language detector. Review suspicious locations manually; the script never rewrites content.

Polish locale resources, localized mail templates, multilingual normalization/classifier data and localization fixtures are intentional exceptions. Existing SQL migrations are exempt only by explicit filename and SHA-256 in `scripts/language-exceptions.json`; future migrations are checked. Technical test names, errors and comments remain checked. Generated mail subjects in Compose retain the template language. Do not add broad exceptions to hide new technical prose.

The pre-commit hook runs lint-staged with `--no-stash --no-hide-partially-staged`, preserving the no-stash rule and avoiding hidden working-tree changes. Stage coherent whole-file groups and review the index before each commit.
