/**
 * Raw ESC/POS command bytes.
 *
 * The web app sends exactly one of these — ESC @ — and does everything else
 * with space padding. Mobile uses the real command set so receipts can be bold,
 * centered, cut, and carry a logo.
 *
 * Reference: Epson ESC/POS Command Reference. These are the commands supported
 * by essentially every generic 58/80 mm thermal printer.
 */

const ESC = 0x1b;
const GS = 0x1d;

export const Cmd = {
  /** ESC @ — initialize. Clears bold/align/size left over from a prior job. */
  INIT: Uint8Array.from([ESC, 0x40]),

  /** LF — print and line feed. */
  LF: Uint8Array.from([0x0a]),

  /** ESC a n — 0 left, 1 center, 2 right. */
  align(mode: 'left' | 'center' | 'right'): Uint8Array {
    const n = mode === 'center' ? 1 : mode === 'right' ? 2 : 0;
    return Uint8Array.from([ESC, 0x61, n]);
  },

  /** ESC E n — emphasized (bold) on/off. */
  bold(on: boolean): Uint8Array {
    return Uint8Array.from([ESC, 0x45, on ? 1 : 0]);
  },

  /** ESC - n — underline off / 1-dot / 2-dot. */
  underline(weight: 0 | 1 | 2): Uint8Array {
    return Uint8Array.from([ESC, 0x2d, weight]);
  },

  /**
   * GS ! n — character size. High nibble is the width multiplier, low nibble
   * the height multiplier, each 1..8 expressed as 0..7.
   *
   * NOTE: a width multiplier above 1 halves (or worse) the effective characters
   * per line, so never use it on a column-aligned row.
   */
  size(width: number, height: number): Uint8Array {
    const w = Math.max(1, Math.min(8, width)) - 1;
    const h = Math.max(1, Math.min(8, height)) - 1;
    return Uint8Array.from([GS, 0x21, (w << 4) | h]);
  },

  /** ESC t n — select character code table (codepage). */
  codepage(n: number): Uint8Array {
    return Uint8Array.from([ESC, 0x74, n]);
  },

  /** ESC 3 n — set line spacing to n dots (default is 30–34). */
  lineSpacing(dots: number): Uint8Array {
    return Uint8Array.from([ESC, 0x33, Math.max(0, Math.min(255, dots))]);
  },

  /** ESC 2 — restore default line spacing. */
  DEFAULT_LINE_SPACING: Uint8Array.from([ESC, 0x32]),

  /** ESC d n — feed n lines. Replaces the web version's literal '\n\n\n'. */
  feed(lines: number): Uint8Array {
    return Uint8Array.from([ESC, 0x64, Math.max(0, Math.min(255, lines))]);
  },

  /**
   * GS V m — cut. 66 ('B') is "feed then partial cut", the safest choice: a
   * full cut on a printer without a cutter is a no-op, but a cut without the
   * feed slices through the last printed line.
   */
  cut(feedDots = 3): Uint8Array {
    return Uint8Array.from([GS, 0x56, 66, Math.max(0, Math.min(255, feedDots))]);
  },

  /**
   * ESC p m t1 t2 — pulse the cash drawer kick-out connector.
   * m=0 is pin 2 (the common wiring); t1/t2 are on/off times in 2 ms units.
   */
  cashDrawer(): Uint8Array {
    return Uint8Array.from([ESC, 0x70, 0x00, 0x19, 0xfa]);
  },
} as const;

/**
 * Character code tables. CP437 is the universal default — every ESC/POS
 * printer supports it, and it covers £ and ¥ natively.
 */
export const Codepage = {
  CP437: 0,
  CP850: 2,
  CP858: 19,
  CP1252: 16,
} as const;

export type CodepageValue = (typeof Codepage)[keyof typeof Codepage];

/** Concatenates command/text chunks into a single buffer for one write. */
export function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}
