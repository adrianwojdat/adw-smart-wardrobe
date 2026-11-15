import { createHmac, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

if (existsSync('.env')) {
  console.error('.env already exists. Secrets were not overwritten.');
  process.exit(1);
}

const secret = () => randomBytes(32).toString('hex');
const jwtSecret = secret();
const jwt = (role) => {
  const now = Math.floor(Date.now() / 1000);
  const data = [
    { alg: 'HS256', typ: 'JWT' },
    { role, iss: 'supabase', iat: now, exp: now + 10 * 365 * 86400 },
  ]
    .map((x) => Buffer.from(JSON.stringify(x)).toString('base64url'))
    .join('.');

  return data + '.' + createHmac('sha256', jwtSecret).update(data).digest('base64url');
};

const values = {
  POSTGRES_PASSWORD: secret(),
  JWT_SECRET: jwtSecret,
  ANON_KEY: jwt('anon'),
  SERVICE_ROLE_KEY: jwt('service_role'),
  DASHBOARD_PASSWORD: secret(),
  SECRET_KEY_BASE: secret() + secret(),
  REALTIME_DB_ENC_KEY: randomBytes(8).toString('hex'),
  VAULT_ENC_KEY: randomBytes(16).toString('hex'),
  PG_META_CRYPTO_KEY: secret(),
  S3_PROTOCOL_ACCESS_KEY_ID: randomBytes(16).toString('hex'),
  S3_PROTOCOL_ACCESS_KEY_SECRET: secret(),
  SESSION_DB_PASSWORD: secret(),
  WORKER_DB_PASSWORD: secret(),
  SESSION_ENCRYPTION_KEY: secret(),
  GEMINI_ENCRYPTION_KEY: secret(),
  REDIS_PASSWORD: secret(),
};
const content = readFileSync('.env.example', 'utf8').replace(/^([A-Z_0-9]+)=.*$/gm, (line, key) =>
  key in values ? `${key}=${values[key]}` : line,
);

writeFileSync('.env', content, { mode: 0o600, flag: 'wx' });
console.log(
  'Created .env (0600) with random secrets. Configure APP_ORIGIN/SITE_URL and SMTP before deployment.',
);
