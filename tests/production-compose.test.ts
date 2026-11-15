import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

type RecordValue = Record<string, unknown>;

function record(value: unknown): RecordValue {
  assert(value !== null && typeof value === 'object' && !Array.isArray(value));

  return { ...value };
}

function array(value: unknown): unknown[] {
  assert(Array.isArray(value));

  return value;
}

function yaml(file: string): RecordValue {
  const value: unknown = parse(readFileSync(file, 'utf8'));

  return record(value);
}

function compose(file: string) {
  const document = yaml(file);

  return {
    name: document.name,
    services: Object.fromEntries(
      Object.entries(record(document.services)).map(([name, service]) => [name, record(service)]),
    ),
    volumes: record(document.volumes),
    networks: record(document.networks),
  };
}

const full = compose('docker-compose.yml');
const production = compose('docker-compose.prod.yml');
const backends = new Set(['auth', 'rest', 'storage']);

function managers(file: string, variables?: Record<string, string>) {
  const source = readFileSync(file, 'utf8');
  const rendered = variables
    ? source.replace(/\$\{([A-Z0-9_]+)\}/g, (_match: string, name: string) => variables[name] ?? '')
    : source;
  const value: unknown = parse(rendered);

  return array(record(value).resources).flatMap((listener) =>
    array(record(listener).filter_chains).flatMap((chain) =>
      array(record(chain).filters).map((filter) => record(record(filter).typed_config)),
    ),
  );
}

function hosts(manager: RecordValue) {
  return array(record(manager.route_config).virtual_hosts).map(record);
}

function routes(host: RecordValue) {
  return array(host.routes).map(record);
}

function cluster(route: RecordValue) {
  const value = record(route.route ?? {}).cluster;

  assert(value === undefined || typeof value === 'string');

  return value ?? '';
}

describe('standalone production deployment', () => {
  it('omits unused services and exposes only the application web ports', () => {
    expect(Object.keys(production.services).sort()).toEqual([
      'api',
      'api-gw',
      'auth',
      'db',
      'imgproxy',
      'migrate',
      'redis',
      'rest',
      'storage',
      'web',
      'worker',
    ]);
    expect(
      Object.entries(production.services)
        .filter(([, service]) => service.ports)
        .map(([name]) => name),
    ).toEqual(['web']);
    expect(production.services.web?.ports).toEqual(full.services.web?.ports);
  });

  it('preserves core application configuration, encrypted credentials, migrations and persistent identities', () => {
    expect(production.name).toBe(full.name);

    for (const name of [
      'api',
      'auth',
      'imgproxy',
      'migrate',
      'redis',
      'rest',
      'storage',
      'web',
      'worker',
    ]) {
      expect(production.services[name], name).toEqual(full.services[name]);
    }

    expect(production.services.db?.volumes).toEqual(full.services.db?.volumes);
    expect(Object.keys(production.volumes).sort()).toEqual([
      'caddy-config',
      'caddy-data',
      'db-config',
      'postgres-data',
      'redis-data',
    ]);
    for (const [name, definition] of Object.entries(production.volumes))
      expect(definition).toEqual(full.volumes[name]);
    expect(record(production.services.api?.environment).GEMINI_ENCRYPTION_KEY).toBe(
      '${GEMINI_ENCRYPTION_KEY:-}',
    );
    expect(record(production.services.worker?.environment).GEMINI_TASK_TIMEOUT_MS).toBe(
      '${GEMINI_TASK_TIMEOUT_MS:-900000}',
    );
  });

  it('uses one configurable image directory in both variants and keeps imgproxy read-only', () => {
    for (const variant of [full, production]) {
      expect(variant.services.storage?.volumes).toEqual([
        '${STORAGE_PATH:-./data/storage}:/var/lib/storage',
      ]);
      expect(variant.services.imgproxy?.volumes).toEqual([
        '${STORAGE_PATH:-./data/storage}:/var/lib/storage:ro',
      ]);
    }
  });

  it('has no dangling service, network or named-volume dependencies', () => {
    for (const service of Object.values(production.services)) {
      for (const name of Object.keys(record(service.depends_on ?? {})))
        expect(production.services).toHaveProperty(name);

      for (const name of Array.isArray(service.networks)
        ? array(service.networks)
        : Object.keys(record(service.networks ?? {}))) {
        assert(typeof name === 'string');
        expect(production.networks).toHaveProperty(name);
      }

      for (const mount of array(service.volumes ?? [])) {
        assert(typeof mount === 'string');

        const source = mount.split(':')[0]!;

        if (!source.startsWith('.') && !source.startsWith('/') && !source.startsWith('${'))
          expect(production.volumes).toHaveProperty(source);
      }
    }

    expect(Object.keys(record(production.services['api-gw']?.depends_on ?? {})).sort()).toEqual(
      [...backends].sort(),
    );
  });

  it('keeps upstream authentication, key translation and RBAC unchanged on all active routes', () => {
    const original = managers('infra/supabase/volumes/api/envoy/lds.template.yaml');
    const current = managers('infra/production/envoy/lds.template.yaml');

    expect(current).toHaveLength(original.length);

    for (const [index, manager] of current.entries()) {
      const source = original[index]!;

      expect(manager.http_filters).toEqual(source.http_filters);

      for (const [hostIndex, host] of hosts(manager).entries()) {
        const kept = routes(hosts(source)[hostIndex]!).filter((route) =>
          backends.has(cluster(route)),
        );

        expect(routes(host).slice(0, -1)).toEqual(kept);
        expect(routes(host).at(-1)).toMatchObject({
          match: { prefix: '/' },
          direct_response: { status: 404 },
        });
      }
    }
  });

  it('preserves empty optional key matchers after the gateway entrypoint substitutes variables', () => {
    const variables = { ANON_KEY: 'synthetic-anon', SERVICE_ROLE_KEY: 'synthetic-service' };
    const original = managers('infra/supabase/volumes/api/envoy/lds.template.yaml', variables);
    const current = managers('infra/production/envoy/lds.template.yaml', variables);

    for (const [index, manager] of current.entries()) {
      const source = original[index]!;

      expect(manager.http_filters).toEqual(source.http_filters);

      for (const [hostIndex, host] of hosts(manager).entries()) {
        expect(routes(host).slice(0, -1)).toEqual(
          routes(hosts(source)[hostIndex]!).filter((route) => backends.has(cluster(route))),
        );
      }
    }
  });

  it('does not resolve or forward requests to removed gateway backends', () => {
    const original = array(yaml('infra/supabase/volumes/api/envoy/cds.yaml').resources).map(record);
    const current = array(yaml('infra/production/envoy/cds.yaml').resources).map(record);

    expect(current).toEqual(original.filter((cluster) => backends.has(String(cluster.name))));
    expect(current.map((cluster) => cluster.name).sort()).toEqual([...backends].sort());

    for (const manager of managers('infra/production/envoy/lds.template.yaml')) {
      for (const host of hosts(manager)) {
        for (const route of routes(host))
          if (route.route) expect(backends.has(cluster(route))).toBe(true);
      }
    }
  });

  it('reproduces both checked-in variants and production gateway files without writing files', () => {
    const output = execFileSync(process.execPath, ['scripts/compose.mjs', '--check'], {
      encoding: 'utf8',
    });

    expect(output).toContain('Production Compose verified: 11 services');
  });
});
