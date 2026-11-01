/**
 * Reading the store server's address from its setup QR, or from what a person
 * typed.
 *
 * Hand-parsed rather than through `URL`: React Native's URL polyfill throws
 * "not implemented" from getters like `hostname` and `searchParams`, while
 * jest runs on Node's complete one — so code using it would pass every test
 * and then fail on a phone.
 */

/** A store server to try, from the setup QR or typed by hand. */
export interface StoreServerAddress {
  /** API base, with the `/api` prefix: `https://192.168.1.20/api`. */
  baseUrl: string;
  /** The setup page on the cashier PC, which also offers the certificate. */
  setupUrl: string;
  storeId?: string;
  /** Lower-case hex, no separators. Null when the code carried none. */
  caSha256?: string | null;
}

export interface SetupQr extends StoreServerAddress {
  storeId: string;
  caSha256: string | null;
}

interface ParsedUrl {
  scheme: string;
  host: string;
  port?: number;
  path: string;
  query: Record<string, string>;
}

const URL_PATTERN = /^([a-z][a-z0-9+.-]*):\/\/([^/?#\s]+)([^?#\s]*)(\?[^#\s]*)?(#\S*)?$/i;
/** host[:port]. IPv6 literals don't match: a shop network hands out IPv4 addresses. */
const AUTHORITY_PATTERN = /^([^:@[\]]+)(?::(\d{1,5}))?$/;
const IPV4_PATTERN = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
/** A name announced on the Wi-Fi (mDNS), e.g. `cashier-pc.local`. */
const LOCAL_NAME_PATTERN = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+local$/;
const STORE_ID_PATTERN = /^[A-Za-z0-9-]{1,64}$/;

function decode(text: string): string | null {
  try {
    return decodeURIComponent(text.replace(/\+/g, ' '));
  } catch {
    return null;
  }
}

function parseQuery(search: string | undefined): Record<string, string> {
  const query: Record<string, string> = {};
  if (!search) return query;
  for (const part of search.slice(1).split('&')) {
    if (!part) continue;
    const eq = part.indexOf('=');
    const key = decode(eq < 0 ? part : part.slice(0, eq));
    const value = decode(eq < 0 ? '' : part.slice(eq + 1));
    // First one wins, so a second `store=` tacked on can't override the first.
    if (key !== null && value !== null && !(key in query)) query[key] = value;
  }
  return query;
}

function parseUrl(text: string): ParsedUrl | null {
  const match = URL_PATTERN.exec(text.trim());
  if (!match) return null;
  const [, scheme, authority, path, search] = match;

  const hostPort = AUTHORITY_PATTERN.exec(authority);
  if (!hostPort) return null;
  const port = hostPort[2] ? Number(hostPort[2]) : undefined;
  if (port !== undefined && (port < 1 || port > 65535)) return null;

  return {
    scheme: scheme.toLowerCase(),
    host: hostPort[1].toLowerCase().replace(/\.$/, ''),
    port,
    path: path || '/',
    query: parseQuery(search),
  };
}

/**
 * Only addresses inside the shop's own network: 10/8, 172.16/12, 192.168/16,
 * 169.254/16, localhost and `*.local`.
 *
 * This is what stops a stray QR code or a typo from sending staff passwords
 * to a machine on the internet.
 */
export function isPrivateHost(host: string): boolean {
  const name = host.trim().toLowerCase().replace(/\.$/, '');
  if (name === 'localhost') return true;

  const ip = IPV4_PATTERN.exec(name);
  if (ip) {
    const octets = ip.slice(1).map(Number);
    if (octets.some((octet) => octet > 255)) return false;
    const [a, b] = octets;
    return (
      a === 10 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254)
    );
  }

  return LOCAL_NAME_PATTERN.test(name);
}

/** `ab:CD:…` or `abcd…` → 64 lower-case hex characters, or null if it isn't a SHA-256. */
export function normalizeFingerprint(text: string | null | undefined): string | null {
  if (!text) return null;
  const hex = text.replace(/[\s:]/g, '').toLowerCase();
  return /^[0-9a-f]{64}$/.test(hex) ? hex : null;
}

/** For reading aloud against the phone's certificate screen: `AB:CD:EF:…`. */
export function formatFingerprint(text: string | null | undefined): string | null {
  const hex = normalizeFingerprint(text);
  return hex ? hex.toUpperCase().match(/.{2}/g)!.join(':') : null;
}

function apiBaseFor(host: string, port?: number): string {
  return `https://${host}${port && port !== 443 ? `:${port}` : ''}/api`;
}

/**
 * The setup QR on the cashier PC:
 * `http://<host>/setup?store=<storeId>&ca=<sha256>&port=<httpsPort>`.
 *
 * The QR points at a plain-HTTP page on purpose — a phone without the shop
 * certificate can still open it to download one. The API itself is HTTPS on
 * `port` (443 when omitted).
 */
export function parseSetupQr(text: string): SetupQr | null {
  const url = parseUrl(text);
  if (!url) return null;
  if (url.scheme !== 'http' && url.scheme !== 'https') return null;
  if (url.path.replace(/\/+$/, '') !== '/setup') return null;
  if (!isPrivateHost(url.host)) return null;

  const storeId = url.query.store?.trim();
  if (!storeId || !STORE_ID_PATTERN.test(storeId)) return null;

  // Optional so a server without a fingerprint configured still pairs, but a
  // value that is present and malformed means this is not our QR.
  let caSha256: string | null = null;
  if (url.query.ca) {
    caSha256 = normalizeFingerprint(url.query.ca);
    if (!caSha256) return null;
  }

  let port = 443;
  if (url.query.port) {
    if (!/^\d{1,5}$/.test(url.query.port)) return null;
    port = Number(url.query.port);
    if (port < 1 || port > 65535) return null;
  }

  return {
    baseUrl: apiBaseFor(url.host, port),
    setupUrl: text.trim(),
    storeId,
    caSha256,
  };
}

/**
 * An address typed by hand: `192.168.1.20`, `192.168.1.20:8443`,
 * `https://cashier-pc.local`, or the whole setup link.
 *
 * Always HTTPS — the store server has no plain-HTTP API, so `http://` typed
 * from the setup page means the same machine, on the default HTTPS port.
 */
export function parseServerAddress(text: string): StoreServerAddress | null {
  const input = text.trim();
  if (!input) return null;

  const qr = parseSetupQr(input);
  if (qr) return qr;

  const url = parseUrl(/^[a-z][a-z0-9+.-]*:\/\//i.test(input) ? input : `https://${input}`);
  if (!url) return null;
  if (url.scheme !== 'http' && url.scheme !== 'https') return null;
  if (!isPrivateHost(url.host)) return null;

  return {
    baseUrl: apiBaseFor(url.host, url.scheme === 'https' ? url.port : undefined),
    setupUrl: `http://${url.host}/setup`,
  };
}

/**
 * `/api` added to a bare server root (`https://192.168.1.20` from
 * /store-servers/discover), and nothing else changed. Null for anything that
 * is not an https address on the shop network.
 */
export function toStoreApiBase(serverUrl: string): string | null {
  const url = parseUrl(serverUrl);
  if (!url || url.scheme !== 'https' || !isPrivateHost(url.host)) return null;
  return apiBaseFor(url.host, url.port);
}

/** What to show people: `192.168.1.20` or `192.168.1.20:8443`. */
export function serverLabel(baseUrl: string): string {
  return baseUrl.replace(/^[a-z]+:\/\//i, '').replace(/\/+$/, '').replace(/\/api$/, '');
}
