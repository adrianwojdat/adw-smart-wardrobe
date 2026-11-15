export default {
  forbidden: [
    {
      name: 'no-circular-dependencies',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'web-does-not-import-server-apps',
      severity: 'error',
      from: { path: '^apps/web/' },
      to: { path: '^apps/(api|worker)/' },
    },
    {
      name: 'api-does-not-import-other-apps',
      severity: 'error',
      from: { path: '^apps/api/' },
      to: { path: '^apps/(web|worker)/' },
    },
    {
      name: 'worker-does-not-import-other-apps',
      severity: 'error',
      from: { path: '^apps/worker/' },
      to: { path: '^apps/(web|api)/' },
    },
    {
      name: 'shared-stays-independent-of-apps',
      severity: 'error',
      from: { path: '^packages/shared/' },
      to: { path: '^apps/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.base.json' },
    tsPreCompilationDeps: true,
  },
};
