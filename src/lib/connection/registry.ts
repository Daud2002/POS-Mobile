import { storage, StorageKey } from '@/lib/storage';

import { normalizeFingerprint } from './qr';
import { normalizeBaseUrl } from './tokenScope';
import type { RegisteredStoreServer } from './types';

/**
 * The one store server this device knows, kept in MMKV so the app can look
 * for it before anything else at start-up — synchronously, before the first
 * request decides which server to ask.
 *
 * One per device is enough: a phone belongs to one shop. Pairing with another
 * shop's server replaces it.
 */
export function getRegisteredServer(): RegisteredStoreServer | null {
  const saved = storage.getObject<RegisteredStoreServer>(StorageKey.storeServer);
  if (!saved?.baseUrl || !saved.storeId) return null;
  return { ...saved, lanUrls: Array.isArray(saved.lanUrls) ? saved.lanUrls : [] };
}

export function saveRegisteredServer(server: RegisteredStoreServer): RegisteredStoreServer {
  const baseUrl = server.baseUrl.replace(/\/+$/, '');
  const entry: RegisteredStoreServer = {
    ...server,
    baseUrl,
    lanUrls: candidateUrls({ ...server, baseUrl }),
    caSha256: normalizeFingerprint(server.caSha256) ?? undefined,
  };
  storage.setObject(StorageKey.storeServer, entry);
  return entry;
}

export function clearRegisteredServer(): void {
  storage.remove(StorageKey.storeServer);
}

/** Every address to try, the one that worked last first, without repeats. */
export function candidateUrls(server: Pick<RegisteredStoreServer, 'baseUrl' | 'lanUrls'>): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const url of [server.baseUrl, ...server.lanUrls]) {
    const clean = url.replace(/\/+$/, '');
    const key = normalizeBaseUrl(clean);
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    urls.push(clean);
  }
  return urls;
}

/** True when `baseUrl` is one of this server's addresses. */
export function isServerAddress(server: RegisteredStoreServer | null, baseUrl: string): boolean {
  if (!server) return false;
  const key = normalizeBaseUrl(baseUrl);
  return candidateUrls(server).some((url) => normalizeBaseUrl(url) === key);
}
