export function readClientEnvironment(source: Record<string, unknown>) {
  const apiBaseUrl = source.VITE_API_BASE_URL ?? 'http://127.0.0.1:3001/api';
  try {
    const url = new URL(String(apiBaseUrl));
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || !url.pathname.endsWith('/api')) throw new Error();
  } catch {
    throw new Error('Revisa VITE_API_BASE_URL: debe ser la URL pública HTTP(S) de /api.');
  }
  const size = source.VITE_MAX_FILE_SIZE_MB ?? '10';
  if (String(size) !== '10') throw new Error('VITE_MAX_FILE_SIZE_MB debe ser 10.');
  return Object.freeze({ apiBaseUrl: String(apiBaseUrl), maxFileSizeBytes: 10 * 1024 * 1024 });
}
