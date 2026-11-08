import { buildApp } from './app.js';
import { configSchema } from './config.js';
const config = configSchema.parse(process.env);
const app = await buildApp(config);
for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(signal, () => {
    void app.close().then(() => process.exit(0));
  });
await app.listen({ port: config.PORT, host: '0.0.0.0' });
