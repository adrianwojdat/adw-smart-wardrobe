/** Explicit deployment allowlist only: never trust a client-supplied Host header. */
export function allowedOrigins(primary: string, additional = '') {
  const origins = new Set<string>();

  for (const value of [primary, ...additional.split(',')].map((s) => s.trim()).filter(Boolean)) {
    const url = new URL(value);

    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    )
      throw Error('Allowed origins must be HTTP(S) origins without paths or credentials.');
    origins.add(url.origin);
  }

  return origins;
}
