/**
 * Generates every app icon and splash asset from a single source logo.
 *
 *   node scripts/generate-icons.js
 *
 * Written against Node's zlib rather than sharp/ImageMagick, neither of which
 * is available here — so re-running this after the logo changes needs no
 * extra tooling.
 *
 * Source: assets/pos_logo.png (transparent background).
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ASSETS = path.join(__dirname, '..', 'assets');
const SOURCE = path.join(ASSETS, 'pos_logo.png');

/** Brand background. The mark is dark navy, so it needs a light ground. */
const WHITE = { r: 255, g: 255, b: 255, a: 255 };

// ----------------------------------------------------------------- decoding

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function readChunks(buf) {
  const chunks = [];
  let off = 8;
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    chunks.push({ type, data: buf.subarray(off + 8, off + 8 + len) });
    off += 12 + len;
    if (type === 'IEND') break;
  }
  return chunks;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

/** Decodes an 8-bit RGBA PNG into { width, height, data }. */
function decodePng(file) {
  const buf = fs.readFileSync(file);
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const bitDepth = buf[24];
  const colorType = buf[25];

  if (bitDepth !== 8 || colorType !== 6) {
    throw new Error(`Expected 8-bit RGBA PNG, got bitDepth=${bitDepth} colorType=${colorType}`);
  }

  const idat = readChunks(buf).filter((c) => c.type === 'IDAT').map((c) => c.data);
  const raw = zlib.inflateSync(Buffer.concat(idat));

  const bpp = 4;
  const stride = width * bpp;
  const out = Buffer.alloc(height * stride);

  // Reverse the per-scanline filters (PNG spec 9.2).
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    const cur = out.subarray(y * stride, (y + 1) * stride);

    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= bpp ? prev[x - bpp] : 0;
      let value = line[x];

      if (filter === 1) value += a;
      else if (filter === 2) value += b;
      else if (filter === 3) value += (a + b) >> 1;
      else if (filter === 4) value += paeth(a, b, c);

      cur[x] = value & 0xff;
    }
  }

  return { width, height, data: out };
}

// ----------------------------------------------------------------- encoding

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng({ width, height, data }) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  // 10..12 = compression, filter, interlace — all 0.

  const stride = width * 4;
  const rawWithFilters = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    rawWithFilters[y * (stride + 1)] = 0; // filter: None
    data.copy(rawWithFilters, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(rawWithFilters, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- resampling

/** Bilinear resize. Good enough for the modest upscale this logo needs. */
function resize(src, targetW, targetH) {
  const out = Buffer.alloc(targetW * targetH * 4);
  const xRatio = src.width / targetW;
  const yRatio = src.height / targetH;

  for (let y = 0; y < targetH; y++) {
    const sy = Math.min(src.height - 1, (y + 0.5) * yRatio - 0.5);
    const y0 = Math.max(0, Math.floor(sy));
    const y1 = Math.min(src.height - 1, y0 + 1);
    const wy = sy - y0;

    for (let x = 0; x < targetW; x++) {
      const sx = Math.min(src.width - 1, (x + 0.5) * xRatio - 0.5);
      const x0 = Math.max(0, Math.floor(sx));
      const x1 = Math.min(src.width - 1, x0 + 1);
      const wx = sx - x0;

      for (let ch = 0; ch < 4; ch++) {
        const p00 = src.data[(y0 * src.width + x0) * 4 + ch];
        const p10 = src.data[(y0 * src.width + x1) * 4 + ch];
        const p01 = src.data[(y1 * src.width + x0) * 4 + ch];
        const p11 = src.data[(y1 * src.width + x1) * 4 + ch];
        const top = p00 + (p10 - p00) * wx;
        const bottom = p01 + (p11 - p01) * wx;
        out[(y * targetW + x) * 4 + ch] = Math.round(top + (bottom - top) * wy);
      }
    }
  }

  return { width: targetW, height: targetH, data: out };
}

// --------------------------------------------------------------- composition

/**
 * Centres `logo` on a square canvas.
 *
 * `background` null keeps the canvas transparent — required for the Android
 * adaptive foreground, where the system draws its own background layer.
 */
function compose(logo, size, fillRatio, background) {
  const out = Buffer.alloc(size * size * 4);

  if (background) {
    for (let i = 0; i < size * size; i++) {
      out[i * 4] = background.r;
      out[i * 4 + 1] = background.g;
      out[i * 4 + 2] = background.b;
      out[i * 4 + 3] = background.a;
    }
  }

  // fillRatio 0 means "background only" — used for the blank splash and the
  // adaptive background layer. Without this guard the scale collapses to zero
  // and the Math.max(1, …) below still stamps a single stray logo pixel.
  if (fillRatio <= 0) return { width: size, height: size, data: out };

  // Fit the logo inside `fillRatio` of the canvas, preserving aspect.
  const box = Math.round(size * fillRatio);
  const scale = Math.min(box / logo.width, box / logo.height);
  const w = Math.max(1, Math.round(logo.width * scale));
  const h = Math.max(1, Math.round(logo.height * scale));
  const scaled = resize(logo, w, h);

  const ox = Math.floor((size - w) / 2);
  const oy = Math.floor((size - h) / 2);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 4;
      const d = ((y + oy) * size + (x + ox)) * 4;
      const alpha = scaled.data[s + 3] / 255;
      if (alpha === 0) continue;

      // Source-over: needed because the logo has soft, anti-aliased edges that
      // would otherwise show a hard fringe against the background.
      for (let ch = 0; ch < 3; ch++) {
        out[d + ch] = Math.round(scaled.data[s + ch] * alpha + out[d + ch] * (1 - alpha));
      }
      out[d + 3] = Math.max(out[d + 3], scaled.data[s + 3]);
    }
  }

  return { width: size, height: size, data: out };
}

function write(name, image) {
  const file = path.join(ASSETS, name);
  fs.writeFileSync(file, encodePng(image));
  const kb = (fs.statSync(file).size / 1024).toFixed(0);
  console.log(`  ${name.padEnd(32)} ${image.width}x${image.height}  ${kb} KB`);
}

// ---------------------------------------------------------------------- main

const logo = decodePng(SOURCE);
console.log(`Source: pos_logo.png ${logo.width}x${logo.height}\n`);

if (logo.width < 512 || logo.height < 512) {
  console.log('⚠  Source is under 512px. Icons are upscaled and will look slightly');
  console.log('   soft at large sizes — supply a 1024x1024 logo for a crisp result.\n');
}

// iOS/general icon: must be opaque — iOS composites alpha onto black.
write('icon.png', compose(logo, 1024, 0.7, WHITE));

// Android adaptive icon. The outer ~25% is cropped by the system mask, so the
// mark sits inside a 60% safe zone; the foreground stays transparent.
write('android-icon-foreground.png', compose(logo, 1024, 0.6, null));
write('android-icon-background.png', compose(logo, 1024, 0, WHITE));
write('android-icon-monochrome.png', compose(logo, 1024, 0.6, null));

// Splash artwork keeps its transparency; the background colour comes from
// app.config.ts so the native splash and the animated one match exactly.
write('splash-icon.png', compose(logo, 512, 0.9, null));

write('favicon.png', compose(logo, 64, 0.85, WHITE));

/**
 * Deliberately blank.
 *
 * The native splash is configured with this so a cold start shows the brand
 * background and nothing else — the logo is then animated up from the bottom
 * by AnimatedSplash. Pointing the native splash at the real artwork would draw
 * the logo centred first, and the animation would visibly jump.
 */
write('splash-blank.png', compose(logo, 16, 0, null));

console.log('\n✨ Icons generated.');
