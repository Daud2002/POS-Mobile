import { API_BASE_URL } from '@/constants/config';

/** Compares API bases the way a person would: case, spaces and trailing slashes don't count. */
export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '').toLowerCase();
}

/** FNV-1a (32-bit) as 8 hex characters. Stable across app versions, which is all a key suffix needs. */
function shortHash(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * The suffix that keeps one server's tokens apart from another's in secure
 * storage.
 *
 * Needed because sessions are per server: a store server signs its own tokens,
 * so a cloud token sent there (or the reverse) is just a 401, and the refresh
 * that follows would spend the other server's refresh token. The build's own
 * server keeps the original unsuffixed keys, so installs that predate store
 * servers stay signed in after the update.
 *
 * Only letters, digits and `_` come out of this: SecureStore rejects other
 * characters in a key.
 */
export function tokenScopeFor(baseUrl: string, cloudBaseUrl: string = API_BASE_URL): string {
  const key = normalizeBaseUrl(baseUrl);
  if (key === normalizeBaseUrl(cloudBaseUrl)) return '';
  return `_${shortHash(key)}`;
}
