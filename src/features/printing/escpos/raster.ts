import { Align } from './builder';
import { Cmd, concatBytes } from './commands';
import { printedWidth, transliterate } from './encoding';
import { GlyphSet, LARGE_GLYPHS, SMALL_GLYPHS } from './glyphs';

/** Font A cell in printer dots — the grid every template lays out on. */
const CELL_W = 12;
const CELL_H = 24;
/** Stroke of a box-drawing line, in dots. */
const LINE_DOTS = 2;
/** Rows per GS v 0 command. Long single images overrun cheap printers' buffers. */
const BAND_ROWS = 240;

/** Box-drawing character → which of its four arms it draws. */
const BOX: Record<string, { l?: 1; r?: 1; u?: 1; d?: 1 }> = {
  '─': { l: 1, r: 1 }, // ─
  '│': { u: 1, d: 1 }, // │
  '┌': { r: 1, d: 1 }, // ┌
  '┐': { l: 1, d: 1 }, // ┐
  '└': { r: 1, u: 1 }, // └
  '┘': { l: 1, u: 1 }, // ┘
  '├': { r: 1, u: 1, d: 1 }, // ├
  '┤': { l: 1, u: 1, d: 1 }, // ┤
  '┬': { l: 1, r: 1, d: 1 }, // ┬
  '┴': { l: 1, r: 1, u: 1 }, // ┴
  '┼': { l: 1, r: 1, u: 1, d: 1 }, // ┼
};

interface Run {
  text: string;
  bold: boolean;
  width: number;
  height: number;
}

interface Row {
  align: Align;
  runs: Run[];
  /** A drawn rule rather than text: thickness and inset in dots. */
  rule?: { thickness: number; inset: number };
}

const decoded = new Map<GlyphSet, Uint8Array>();

function glyphBytes(set: GlyphSet): Uint8Array {
  let bytes = decoded.get(set);
  if (!bytes) {
    bytes = decodeBase64(set.data);
    decoded.set(set, bytes);
  }
  return bytes;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Hermes' atob is not on every React Native version this app supports. */
function decodeBase64(text: string): Uint8Array {
  const clean = text.replace(/=+$/, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let o = 0;
  for (let i = 0; i < clean.length; i += 1) {
    buffer = (buffer << 6) | B64.indexOf(clean[i]);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o] = (buffer >> bits) & 0xff;
      o += 1;
    }
  }
  return out;
}

/** Index of a character in the glyph sets, or -1 when it has none. */
function glyphIndex(char: string): number {
  const code = char.charCodeAt(0);
  if (code >= 0x20 && code <= 0x7e) return code - 0x20;
  if (code >= 0xa0 && code <= 0xff) return 95 + code - 0xa0;
  return -1;
}

/**
 * Expands a string into the characters that will occupy cells, the same way
 * the printer's text mode would: transliterations widen, the unprintable drop
 * out, and anything else CP437 carries prints as '?' so the columns hold.
 */
function cellsOf(text: string): string[] {
  const out: string[] = [];
  for (const char of text) {
    const substitute = transliterate(char);
    if (substitute !== undefined) out.push(...substitute);
    else if (BOX[char] || glyphIndex(char) >= 0) out.push(char);
    else if (printedWidth(char) > 0) out.push('?');
  }
  return out;
}

/**
 * Prints a document as ONE picture instead of as text.
 *
 * Same surface as EscPosBuilder, so a template written against it lays out
 * exactly as before — but every character, and every box-drawing line, is
 * drawn into a bitmap here and sent with GS v 0. Nothing depends on the
 * printer's code page or font: box lines join into solid borders on every
 * printer, including the kitchen one that printed ┌─┐ as rows of boxes.
 *
 * Rows sit edge to edge with no line spacing, so a │ in one row meets the │
 * in the next and the frame reads as one unbroken border.
 */
export class RasterBuilder {
  private readonly rows: Row[] = [];
  private readonly widthDots: number;
  private runs: Run[] = [];
  private alignMode: Align = 'left';
  private isBold = false;
  private sizeW = 1;
  private sizeH = 1;
  private feedLines = 0;
  private cutPaper = false;

  constructor(profile: { charsPerLine: number }) {
    this.widthDots = profile.charsPerLine * CELL_W;
  }

  init(): this {
    this.alignMode = 'left';
    this.isBold = false;
    this.sizeW = 1;
    this.sizeH = 1;
    return this;
  }

  align(mode: Align): this {
    this.alignMode = mode;
    return this;
  }

  bold(on: boolean): this {
    this.isBold = on;
    return this;
  }

  size(width: number, height: number): this {
    this.sizeW = Math.max(1, Math.min(8, width));
    this.sizeH = Math.max(1, Math.min(8, height));
    return this;
  }

  text(value: string): this {
    if (value) {
      this.runs.push({ text: value, bold: this.isBold, width: this.sizeW, height: this.sizeH });
    }
    return this;
  }

  newline(count = 1): this {
    for (let i = 0; i < count; i += 1) {
      this.rows.push({ align: this.alignMode, runs: this.runs });
      this.runs = [];
    }
    return this;
  }

  line(value = ''): this {
    return this.text(value).newline();
  }

  /** A solid line across the paper, `inset` character cells in from each edge. */
  rule(thickness = 2, inset = 0): this {
    this.rows.push({ align: 'left', runs: [], rule: { thickness, inset: inset * CELL_W } });
    return this;
  }

  feed(lines: number): this {
    this.feedLines += lines;
    return this;
  }

  cut(): this {
    this.cutPaper = true;
    return this;
  }

  /** The document as plain text, one row per line — for tests and previews. */
  toText(): string {
    const width = this.widthDots / CELL_W;
    return this.rows
      .map((row) => {
        if (row.rule) return '─'.repeat(width - (row.rule.inset * 2) / CELL_W);
        const text = row.runs.map((run) => cellsOf(run.text).join('')).join('');
        const cells = row.runs.reduce((sum, run) => sum + cellsOf(run.text).length * run.width, 0);
        const slack = Math.max(0, width - cells);
        const lead = row.align === 'center' ? Math.floor(slack / 2) : row.align === 'right' ? slack : 0;
        return ' '.repeat(lead) + text;
      })
      .join('\n');
  }

  /** The whole document as one 1-bit bitmap, `widthDots` wide, MSB first. */
  toBitmap(): { width: number; height: number; data: Uint8Array } {
    const stride = this.widthDots >> 3;
    const heights = this.rows.map((row) =>
      row.rule
        ? row.rule.thickness + 6
        : CELL_H * Math.max(1, ...row.runs.map((run) => run.height)),
    );
    const height = heights.reduce((sum, h) => sum + h, 0);
    const data = new Uint8Array(stride * height);

    const fill = (x0: number, y0: number, x1: number, y1: number) => {
      for (let y = Math.max(0, y0); y < Math.min(height, y1); y += 1) {
        for (let x = Math.max(0, x0); x < Math.min(this.widthDots, x1); x += 1) {
          data[y * stride + (x >> 3)] |= 0x80 >> (x & 7);
        }
      }
    };

    let top = 0;
    this.rows.forEach((row, index) => {
      const rowHeight = heights[index];
      if (row.rule) {
        fill(row.rule.inset, top + 3, this.widthDots - row.rule.inset, top + 3 + row.rule.thickness);
        top += rowHeight;
        return;
      }

      const cells = row.runs.map((run) => ({ run, chars: cellsOf(run.text) }));
      const usedDots = cells.reduce((sum, c) => sum + c.chars.length * CELL_W * c.run.width, 0);
      const slack = Math.max(0, this.widthDots - usedDots);
      let x = row.align === 'center' ? Math.floor(slack / 2) : row.align === 'right' ? slack : 0;

      for (const { run, chars } of cells) {
        const cellW = CELL_W * run.width;
        for (const char of chars) {
          if (x + cellW > this.widthDots) break;
          const box = BOX[char];
          if (box) {
            // Arms span the whole row, so they meet the lines above and below.
            const cx = x + (cellW >> 1) - (LINE_DOTS >> 1);
            const cy = top + (rowHeight >> 1) - (LINE_DOTS >> 1);
            if (box.l) fill(x, cy, cx + LINE_DOTS, cy + LINE_DOTS);
            if (box.r) fill(cx, cy, x + cellW, cy + LINE_DOTS);
            if (box.u) fill(cx, top, cx + LINE_DOTS, cy + LINE_DOTS);
            if (box.d) fill(cx, cy, cx + LINE_DOTS, top + rowHeight);
          } else {
            this.drawGlyph(data, stride, char, run, x, top + rowHeight - CELL_H * run.height);
          }
          x += cellW;
        }
      }
      top += rowHeight;
    });

    return { width: this.widthDots, height, data };
  }

  /** Draws one character, scaled to its run's size and sitting on the row's floor. */
  private drawGlyph(data: Uint8Array, stride: number, char: string, run: Run, x0: number, y0: number) {
    const index = glyphIndex(char);
    if (index < 0 || char === ' ') return;
    // Tall text comes from the large set even at single width: a small glyph
    // stretched to double height looks smeared, a large one narrowed stays crisp.
    const set = run.height >= 2 ? LARGE_GLYPHS : SMALL_GLYPHS;
    const bytes = glyphBytes(set);
    const glyphStride = (set.width + 7) >> 3;
    const base = index * set.height * glyphStride;
    // Target cell, and how many target dots each glyph dot covers.
    const outW = CELL_W * run.width;
    const outH = CELL_H * run.height;

    for (let y = 0; y < outH; y += 1) {
      const gy = Math.floor((y * set.height) / outH);
      for (let x = 0; x < outW; x += 1) {
        const gx = Math.floor((x * set.width) / outW);
        let on = bytes[base + gy * glyphStride + (gx >> 3)] & (0x80 >> (gx & 7));
        // Bold: the glyph struck twice, one dot apart — what the printer's ESC E does.
        if (!on && run.bold && x > 0) {
          const bx = Math.floor(((x - 1) * set.width) / outW);
          on = bytes[base + gy * glyphStride + (bx >> 3)] & (0x80 >> (bx & 7));
        }
        if (on) {
          const px = x0 + x;
          const py = y0 + y;
          if (px < this.widthDots) data[py * stride + (px >> 3)] |= 0x80 >> (px & 7);
        }
      }
    }
  }

  build(): Uint8Array {
    const { width, height, data } = this.toBitmap();
    const stride = width >> 3;
    const chunks: Uint8Array[] = [Cmd.INIT];

    for (let top = 0; top < height; top += BAND_ROWS) {
      const rows = Math.min(BAND_ROWS, height - top);
      const band = new Uint8Array(8 + stride * rows);
      band.set([0x1d, 0x76, 0x30, 0, stride & 0xff, stride >> 8, rows & 0xff, rows >> 8]);
      band.set(data.subarray(top * stride, (top + rows) * stride), 8);
      chunks.push(band);
    }

    if (this.feedLines) chunks.push(Cmd.feed(this.feedLines));
    if (this.cutPaper) chunks.push(Cmd.cut());
    return concatBytes(chunks);
  }
}
