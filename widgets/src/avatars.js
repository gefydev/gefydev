const MAX_BYTES = 12_000;
const TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

export async function fetchDataUri(url, { fetchImpl = globalThis.fetch, maxBytes = MAX_BYTES } = {}) {
  if (!url || !/^https:\/\/(avatars\.githubusercontent\.com|github\.com)\//.test(url)) return null;
  try {
    const res = await fetchImpl(url, { headers: { 'user-agent': 'profile-widgets' }, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const type = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!TYPES.has(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length || buf.length > maxBytes) return null;
    return `data:${type};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}
