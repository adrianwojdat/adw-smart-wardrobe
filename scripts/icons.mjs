import { createRequire } from 'node:module';
const require = createRequire(new URL('../apps/api/package.json', import.meta.url));
const sharp = require('sharp');
for (const size of [192, 512])
  await sharp('apps/web/public/icon.svg')
    .resize(size, size)
    .png()
    .toFile(`apps/web/public/icon-${size}.png`);
