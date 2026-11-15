import type { Page, TestInfo } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

export async function captureUiScreen(page: Page, testInfo: TestInfo, name: string) {
  const directory = path.resolve('investigation/tmp/ui-daisyui');

  await mkdir(directory, { recursive: true });
  await page.screenshot({
    path: path.join(directory, `${testInfo.project.name}-${name}.png`),
    fullPage: true,
    animations: 'disabled',
  });

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );

  if (hasHorizontalOverflow) throw new Error(`Poziome przewijanie na ekranie: ${name}`);
}
