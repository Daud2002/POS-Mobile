import {
  formatFingerprint,
  isPrivateHost,
  normalizeFingerprint,
  parseServerAddress,
  parseSetupQr,
  serverLabel,
  toStoreApiBase,
} from '../qr';

const STORE = '6f1c2a9e-1b2c-4d5e-8f90-123456789abc';
const CA = 'ab'.repeat(32);

describe('parseSetupQr', () => {
  it('reads the cashier PC setup QR into an HTTPS API base', () => {
    expect(parseSetupQr(`http://192.168.1.20/setup?store=${STORE}&ca=${CA}`)).toEqual({
      baseUrl: 'https://192.168.1.20/api',
      setupUrl: `http://192.168.1.20/setup?store=${STORE}&ca=${CA}`,
      storeId: STORE,
      caSha256: CA,
    });
  });

  it('uses the HTTPS port from the query, not the port of the HTTP page', () => {
    expect(parseSetupQr(`http://10.0.0.5:8080/setup?store=${STORE}&ca=${CA}&port=8443`)?.baseUrl).toBe(
      'https://10.0.0.5:8443/api',
    );
    expect(parseSetupQr(`http://10.0.0.5/setup?store=${STORE}&ca=${CA}&port=443`)?.baseUrl).toBe(
      'https://10.0.0.5/api',
    );
  });

  it('accepts a fingerprint written with colons or in capitals', () => {
    const spaced = CA.toUpperCase().match(/.{2}/g)!.join(':');
    expect(parseSetupQr(`http://192.168.1.20/setup?store=${STORE}&ca=${spaced}`)?.caSha256).toBe(CA);
  });

  it('pairs without a fingerprint, but not with a malformed one', () => {
    expect(parseSetupQr(`http://192.168.1.20/setup?store=${STORE}`)?.caSha256).toBeNull();
    expect(parseSetupQr(`http://192.168.1.20/setup?store=${STORE}&ca=1234`)).toBeNull();
  });

  it('accepts every private range, localhost and .local names', () => {
    for (const host of ['10.1.2.3', '172.16.0.9', '172.31.255.1', '192.168.0.1', '169.254.3.4', 'localhost', 'cashier-pc.local']) {
      expect(parseSetupQr(`http://${host}/setup?store=${STORE}&ca=${CA}`)?.baseUrl).toBe(`https://${host}/api`);
    }
  });

  it('refuses anything that would send passwords off the shop network', () => {
    for (const host of ['8.8.8.8', '172.32.0.1', '172.15.0.1', '192.169.1.1', 'api.tapntrade.store', 'evil.com', 'local', 'x.local.evil.com']) {
      expect(parseSetupQr(`http://${host}/setup?store=${STORE}&ca=${CA}`)).toBeNull();
    }
  });

  it('refuses codes that are not a setup link', () => {
    expect(parseSetupQr('')).toBeNull();
    expect(parseSetupQr('hello')).toBeNull();
    expect(parseSetupQr('4006381333931')).toBeNull(); // a product barcode
    expect(parseSetupQr(`http://192.168.1.20/other?store=${STORE}`)).toBeNull();
    expect(parseSetupQr(`ftp://192.168.1.20/setup?store=${STORE}`)).toBeNull();
    expect(parseSetupQr('http://192.168.1.20/setup')).toBeNull();
    expect(parseSetupQr('http://192.168.1.20/setup?store=bad%20id')).toBeNull();
    expect(parseSetupQr(`http://192.168.1.20/setup?store=${STORE}&port=99999`)).toBeNull();
    expect(parseSetupQr(`http://192.168.1.20/setup?store=${STORE}&port=abc`)).toBeNull();
    expect(parseSetupQr(`http://user@192.168.1.20/setup?store=${STORE}`)).toBeNull();
  });

  it('keeps the first store when one is repeated', () => {
    expect(parseSetupQr(`http://192.168.1.20/setup?store=${STORE}&store=other`)?.storeId).toBe(STORE);
  });
});

describe('isPrivateHost', () => {
  it('rejects addresses that are not IPv4', () => {
    expect(isPrivateHost('192.168.1.300')).toBe(false);
    expect(isPrivateHost('192.168.1')).toBe(false);
    expect(isPrivateHost('')).toBe(false);
  });

  it('ignores case and a trailing dot', () => {
    expect(isPrivateHost('Cashier-PC.LOCAL.')).toBe(true);
    expect(isPrivateHost('LOCALHOST')).toBe(true);
  });
});

describe('parseServerAddress', () => {
  it('turns a typed IP or name into an HTTPS API base', () => {
    expect(parseServerAddress(' 192.168.1.20 ')?.baseUrl).toBe('https://192.168.1.20/api');
    expect(parseServerAddress('192.168.1.20:8443')?.baseUrl).toBe('https://192.168.1.20:8443/api');
    expect(parseServerAddress('https://cashier-pc.local/')?.baseUrl).toBe('https://cashier-pc.local/api');
    expect(parseServerAddress('https://192.168.1.20/api')?.baseUrl).toBe('https://192.168.1.20/api');
  });

  it('treats a typed http:// address as the same machine on HTTPS', () => {
    expect(parseServerAddress('http://192.168.1.20:8080')?.baseUrl).toBe('https://192.168.1.20/api');
  });

  it('points certificate help at the setup page', () => {
    expect(parseServerAddress('192.168.1.20')?.setupUrl).toBe('http://192.168.1.20/setup');
  });

  it('accepts the whole setup link too', () => {
    expect(parseServerAddress(`http://192.168.1.20/setup?store=${STORE}&ca=${CA}`)).toMatchObject({
      baseUrl: 'https://192.168.1.20/api',
      storeId: STORE,
    });
  });

  it('refuses public and malformed addresses', () => {
    expect(parseServerAddress('')).toBeNull();
    expect(parseServerAddress('api.tapntrade.store')).toBeNull();
    expect(parseServerAddress('8.8.8.8')).toBeNull();
    expect(parseServerAddress('192.168.1.20:0')).toBeNull();
    expect(parseServerAddress('not an address')).toBeNull();
  });
});

describe('toStoreApiBase', () => {
  it('adds /api to the server roots the cloud reports', () => {
    expect(toStoreApiBase('https://192.168.1.20')).toBe('https://192.168.1.20/api');
    expect(toStoreApiBase('https://192.168.1.20:8443/')).toBe('https://192.168.1.20:8443/api');
  });

  it('drops anything that is not https on the shop network', () => {
    expect(toStoreApiBase('http://192.168.1.20')).toBeNull();
    expect(toStoreApiBase('https://203.0.113.7')).toBeNull();
  });
});

describe('fingerprints and labels', () => {
  it('normalises and formats a SHA-256', () => {
    expect(normalizeFingerprint(`AB:${'cd'.repeat(31)}`)).toBe(`ab${'cd'.repeat(31)}`);
    expect(normalizeFingerprint('abc')).toBeNull();
    expect(formatFingerprint(CA)).toBe(Array(32).fill('AB').join(':'));
    expect(formatFingerprint(null)).toBeNull();
  });

  it('shows the address people recognise', () => {
    expect(serverLabel('https://192.168.1.20/api')).toBe('192.168.1.20');
    expect(serverLabel('https://192.168.1.20:8443/api/')).toBe('192.168.1.20:8443');
  });
});
