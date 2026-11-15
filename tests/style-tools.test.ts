import { ESLint } from 'eslint';
import * as prettier from 'prettier';
import { describe, expect, it } from 'vitest';

const eslint = new ESLint({ overrideConfigFile: 'eslint.style.config.js', fix: true });

async function fixStyle(source: string, filePath = 'apps/web/src/style-fixture.tsx') {
  const options = { ...(await prettier.resolveConfig(filePath)), filepath: filePath };
  const formatted = await prettier.format(source, options);
  const [result] = await eslint.lintText(formatted, { filePath });

  expect(result!.messages).toEqual([]);

  return prettier.format(result!.output ?? formatted, options);
}

describe('monorepo style configuration', () => {
  it('groups imports and separates declarations, control flow, functions and return', async () => {
    const result = await fixStyle(`import local from './local';
import shared from '@wardrobe/shared';
import React from 'react';
const first=1;
const second=2;
consume(first,second);
function choose(){const unused=1;const value=second;if(value){consume(value);}return value;}
consume(choose());`);

    expect(result.indexOf("from 'react'")).toBeLessThan(result.indexOf("from '@wardrobe/shared'"));
    expect(result).toContain("from '@wardrobe/shared';\n\nimport local");
    expect(result).toContain('const first = 1;\nconst second = 2;\n\nconsume');
    expect(result).toContain('const unused = 1;\n  const value = second;\n\n  if');
    expect(result).toContain('}\n\n  return value;');
    expect(result).toContain('}\n\nconsume(choose());');
  });

  it('separates exported functions without separating every exported constant', async () => {
    const result = await fixStyle(
      'export const first=1;export const second=2;export type Choice=number;export function choose(){return first;}',
    );

    expect(result).toContain('export const first = 1;\nexport const second = 2;');
    expect(result).toContain('export type Choice = number;\n\nexport function choose');
  });

  it('keeps all import evaluation order when a module has side effect imports', async () => {
    const source = `import value from './initialised';
import './initialise';
import React from 'react';
import './styles.css';
consume(value);`;
    const result = await fixStyle(source);
    const imports = (code: string) => code.split('\n').filter((line) => line.startsWith('import'));

    expect(imports(result)).toEqual(imports(source));
  });

  it('is stable after a second complete pass, including JSX and type imports', async () => {
    const source = `import type { StyleAnswers } from '@wardrobe/shared';
import {useState} from 'react';
export function Example(){const [value]=useState<StyleAnswers>({});return <div><span>{String(value.q28_remind_rarely_worn)}</span></div>;}`;
    const once = await fixStyle(source);

    expect(await fixStyle(once)).toBe(once);
    expect(
      await fixStyle(
        'export const View=()=> <div>Keep this text</div>;',
        'apps/web/src/style-fixture.jsx',
      ),
    ).toContain('Keep this text');
    expect(await fixStyle('module.exports={active:true};', 'scripts/style-fixture.cjs')).toContain(
      'module.exports',
    );
  });

  it('recognises existing non-style disable comments without activating those rules', async () => {
    const source =
      '/* eslint-disable @typescript-eslint/no-require-imports */\nconst sharp = require("sharp");\nconsume(sharp);';

    expect(await fixStyle(source, 'infra/storage/style-fixture.cjs')).toContain("require('sharp')");
  });

  it('excludes vendored code, generated artifacts and private local data', async () => {
    for (const path of [
      'apps/web/dist/generated.js',
      'coverage/report.js',
      'node_modules/package/index.js',
      'infra/supabase/vendor.js',
      'data/private.js',
      'investigation/run.js',
      'test-results/artifact.js',
    ]) {
      expect(await eslint.isPathIgnored(path), path).toBe(true);
    }
  });
});
