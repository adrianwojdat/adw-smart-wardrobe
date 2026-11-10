// Reproducible adaptation of the pinned official Compose. Never fetches latest.
import { readFileSync, writeFileSync } from 'node:fs';
import { parse, stringify } from 'yaml';
const c = parse(readFileSync('infra/supabase/upstream-compose.yml', 'utf8'));
c.name = 'smart-wardrobe';
for (const [name, s] of Object.entries(c.services)) {
  if (name !== 'realtime') delete s.container_name;
  delete s.ports;
  s.logging = { driver: 'json-file', options: { 'max-size': '10m', 'max-file': '3' } };
  if (s.volumes)
    s.volumes = s.volumes.map((v) => v.replace('./volumes/', './infra/supabase/volumes/'));
}
// Local administrator access for Postico; never bind PostgreSQL on all interfaces.
c.services.db.ports = ['127.0.0.1:54322:5432'];
// Official gateway protects Studio with existing DASHBOARD credentials; loopback only.
c.services['api-gw'].ports = ['127.0.0.1:8000:8000'];
c.services['api-gw'].networks['studio-access'] = {};
c.services.db.networks = ['default', 'database-access'];
c.services.db.volumes = c.services.db.volumes.map((v) =>
  v.includes('/db/data:') ? 'postgres-data:/var/lib/postgresql/data' : v,
);
// Native file backend: macOS requires an engine with working Linux xattrs (OrbStack).
c.services.storage.volumes = ['./data/storage:/var/lib/storage'];
c.services.imgproxy.volumes = ['./data/storage:/var/lib/storage:ro'];
c.services.studio.volumes = [
  'studio-snippets:/app/snippets',
  './infra/supabase/volumes/functions:/app/edge-functions:ro',
];
c.services.functions.volumes = [
  './infra/supabase/volumes/functions:/home/deno/functions:ro',
  'deno-cache:/root/.cache/deno',
];
// GoTrue v2.197 loads template bodies via HTTP. Serve only on Auth loopback.
c.services.auth.image = 'smart-wardrobe-auth:gotrue-v2.197.0';
c.services.auth.build = { context: './infra/auth-email' };
c.services.auth.init = true;
c.services.auth.volumes = ['./infra/auth-email/templates:/email-templates:ro'];
for (const [type, subject] of Object.entries(
  JSON.parse(readFileSync('infra/auth-email/content.pl-PL.json', 'utf8')),
)) {
  const suffix = type.toUpperCase();
  c.services.auth.environment['GOTRUE_MAILER_SUBJECTS_' + suffix] = subject.subject;
  c.services.auth.environment['GOTRUE_MAILER_TEMPLATES_' + suffix] =
    'http://127.0.0.1:8089/pl-PL/' + type + '.html';
}
c.services.auth.environment.GOTRUE_PASSWORD_MIN_LENGTH = 12;
c.services.auth.environment.GOTRUE_SECURITY_REFRESH_TOKEN_REUSE_INTERVAL = 10;
c.services.functions.networks = ['default', 'egress']; // Official runtime downloads pinned Deno imports on first boot.
c.services.auth.networks = ['default', 'egress']; // SMTP delivery
c.services.storage.environment.FILE_SIZE_LIMIT = 10485760;
const health = { interval: '10s', timeout: '5s', retries: 10, start_period: '30s' };
c.services.redis = {
  image: 'redis:8.2.3-alpine',
  restart: 'unless-stopped',
  environment: { REDIS_PASSWORD: '${REDIS_PASSWORD:?Run node scripts/setup.mjs}' },
  command: [
    'sh',
    '-c',
    'exec redis-server --appendonly yes --appendfsync everysec --requirepass "$REDIS_PASSWORD"',
  ],
  volumes: ['redis-data:/data'],
  healthcheck: {
    ...health,
    test: ['CMD-SHELL', 'REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli ping | grep PONG'],
  },
};
// Opt-in local testing only: no published SMTP ports and no production dependency.
c.services['dev-mail-relay'] = {
  profiles: ['dev-mail'],
  build: { context: './infra/dev-mail' },
  restart: 'unless-stopped',
  init: true,
  networks: ['default', 'egress'],
  environment: {
    DEV_MAIL_RELAY: 'true',
    DEV_SMTP_HOST: '${DEV_SMTP_HOST:-host.docker.internal}',
    DEV_SMTP_PORT: '${DEV_SMTP_PORT:-1025}',
    DEV_SMTP_USER: '${DEV_SMTP_USER:-}',
    DEV_SMTP_PASS: '${DEV_SMTP_PASS:-}',
  },
  mem_limit: '128m',
  healthcheck: {
    ...health,
    test: [
      'CMD',
      'node',
      '-e',
      "fetch('http://127.0.0.1:3000').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))",
    ],
  },
};
const base = {
  build: { context: '.', dockerfile: 'infra/Dockerfile.node' },
  restart: 'unless-stopped',
  init: true,
  stop_grace_period: '30s',
};
const sessionUrl = 'postgresql://wardrobe_session:${SESSION_DB_PASSWORD}@db:5432/postgres';
const workerUrl = 'postgresql://wardrobe_worker:${WORKER_DB_PASSWORD}@db:5432/postgres';
c.services.migrate = {
  ...base,
  restart: 'no',
  command: ['node', '--import', 'tsx', 'apps/api/src/migrate.ts'],
  environment: {
    DATABASE_URL: 'postgresql://postgres:${POSTGRES_PASSWORD}@db:5432/postgres',
    SESSION_DB_PASSWORD: '${SESSION_DB_PASSWORD}',
    WORKER_DB_PASSWORD: '${WORKER_DB_PASSWORD}',
  },
  depends_on: {
    db: { condition: 'service_healthy' },
    auth: { condition: 'service_healthy' },
    storage: { condition: 'service_healthy' },
  },
};
c.services.api = {
  ...base,
  environment: {
    NODE_ENV: 'production',
    PORT: 3000,
    APP_ORIGIN: '${APP_ORIGIN}',
    APP_ADDITIONAL_ORIGINS: '${APP_ADDITIONAL_ORIGINS:-}',
    COOKIE_SECURE: '${COOKIE_SECURE}',
    SUPABASE_URL: 'http://api-gw:8000',
    SUPABASE_ANON_KEY: '${ANON_KEY}',
    SESSION_DATABASE_URL: sessionUrl,
    SESSION_ENCRYPTION_KEY: '${SESSION_ENCRYPTION_KEY}',
    REDIS_URL: 'redis://:${REDIS_PASSWORD}@redis:6379',
    QUEUE_ADMIN_USER_IDS: '${QUEUE_ADMIN_USER_IDS:-}',
    SMTP_ENABLED: '${SMTP_HOST:-}',
    EMAIL_AUTOCONFIRM: '${ENABLE_EMAIL_AUTOCONFIRM}',
  },
  depends_on: {
    migrate: { condition: 'service_completed_successfully' },
    'api-gw': { condition: 'service_healthy' },
    rest: { condition: 'service_healthy' },
    redis: { condition: 'service_healthy' },
  },
  healthcheck: {
    ...health,
    test: [
      'CMD',
      'node',
      '-e',
      "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))",
    ],
  },
};
c.services.worker = {
  ...base,
  command: ['node', '--import', 'tsx', 'apps/worker/src/index.ts'],
  networks: ['default', 'egress'],
  environment: {
    NODE_ENV: 'production',
    GARMENT_ANALYSIS_PROVIDER: '${GARMENT_ANALYSIS_PROVIDER:-fashion-siglip}',
    WORKER_DATABASE_URL: workerUrl,
    REDIS_URL: 'redis://:${REDIS_PASSWORD}@redis:6379',
    SUPABASE_URL: 'http://api-gw:8000',
    SUPABASE_SERVICE_ROLE_KEY: '${SERVICE_ROLE_KEY}',
    OLLAMA_BASE_URL: '${OLLAMA_BASE_URL:-}',
    OLLAMA_VISION_MODEL: '${OLLAMA_VISION_MODEL:-}',
  },
  depends_on: {
    migrate: { condition: 'service_completed_successfully' },
    redis: { condition: 'service_healthy' },
    'api-gw': { condition: 'service_healthy' },
  },
  healthcheck: {
    ...health,
    test: [
      'CMD',
      'node',
      '-e',
      "fetch('http://127.0.0.1:3001/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))",
    ],
  },
};
c.services.web = {
  build: { context: '.', dockerfile: 'infra/Dockerfile.web' },
  restart: 'unless-stopped',
  environment: { SITE_ADDRESS: '${SITE_ADDRESS:-:80}' },
  networks: ['default', 'egress'],
  ports: ['${HTTP_PORT:-8080}:80', '${HTTPS_PORT:-8443}:443'],
  volumes: ['caddy-data:/data', 'caddy-config:/config'],
  depends_on: { api: { condition: 'service_healthy' } },
  healthcheck: {
    ...health,
    test: ['CMD', 'wget', '--spider', '-q', 'http://127.0.0.1:8081/healthz'],
  },
};
c.services.api.mem_limit = '768m';
c.services.api.environment.NODE_OPTIONS = '--max-old-space-size=384';
c.services.worker.mem_limit = '1536m';
c.services.worker.environment.NODE_OPTIONS = '--max-old-space-size=256';
c.networks = {
  default: { internal: true },
  egress: {},
  'database-access': {},
  'studio-access': {},
};
for (const key of [
  'postgres-data',
  'storage-data',
  'redis-data',
  'studio-snippets',
  'caddy-data',
  'caddy-config',
])
  c.volumes[key] = {};
writeFileSync(
  'docker-compose.yml',
  '# Supabase 0.8.4 baseline: see infra/supabase/provenance.json\n' +
    stringify(c, { lineWidth: 120 }),
);
