/**
 * What the row writers below need from a builder. Both EscPosBuilder (text
 * mode) and RasterBuilder (the page as one image) provide it.
 */
export interface LineWriter {
  text(value: string): LineWriter;
  line(value?: string): LineWriter;
  bold(on: boolean): LineWriter;
  size(width: number, height: number): LineWriter;
}

/**
 * The framed-document primitives shared by the cashier receipt and the
 * kitchen ticket, so both print as the same bordered form.
 */
/**
 * Box drawing, with the real line characters.
 *
 * Safe here because the pipeline controls both ends: init() selects the
 * profile's code page (CP437 by default) with ESC t, and encodeText maps each
 * of these Unicode characters to the single CP437 byte whose glyph is a solid
 * line. ASCII "+-|" would survive any code page but visibly is not a line —
 * which is exactly what made the receipt look home-made.
 */
const H = '\u2500'; // ─
const V_RULE = '\u2502'; // │
/**
 * Pass as `side` for a row with no vertical rules: the text keeps exactly the
 * framed layout, and the lines between rows are printed rules instead.
 */
export const OPEN_SIDE = ' ';
const TL = '\u250c'; // ┌
const TR = '\u2510'; // ┐
const BL = '\u2514'; // └
const BR = '\u2518'; // ┘
const TEE_L = '\u251c'; // ├
const TEE_R = '\u2524'; // ┤
const TEE_D = '\u252c'; // ┬
const TEE_U = '\u2534'; // ┴
const CROSS = '\u253c'; // ┼

export type RuleEdge = 'top' | 'mid' | 'bottom';

/** Character positions of the junctions a column layout puts on a rule. */
export function junctionsOf(cols?: FrameColumn[]): Set<number> {
  const out = new Set<number>();
  if (!cols) return out;
  let x = 0;
  for (let i = 0; i < cols.length - 1; i += 1) {
    x += cols[i].width + 1;
    out.add(x);
  }
  return out;
}

export interface FrameColumn {
  width: number;
  align?: 'left' | 'right';
}

/**
 * Blank columns either side of the frame, so the border sits inside the paper
 * rather than running edge to edge. Two on 80mm; the 58mm roll can spare only
 * one without losing a table column. Matches the web receipt.
 */
export function frameMargin(charsPerLine: number): number {
  return charsPerLine >= 48 ? 2 : 1;
}

/**
 * A horizontal rule that KNOWS what it sits between.
 *
 * The junction glyph at each column boundary depends on whether the boundary
 * continues above, below, or both — ┬ entering a table, ┼ inside it, ┴ leaving
 * it. Drawing every junction the same way is what makes an ASCII frame look
 * home-made; this is the detail that makes the table read as one printed form.
 */
export function boxRule(
  width: number,
  opts: { above?: FrameColumn[]; below?: FrameColumn[]; edge?: RuleEdge } = {},
): string {
  const edge = opts.edge ?? 'mid';
  const above = junctionsOf(opts.above);
  const below = junctionsOf(opts.below);

  const chars: string[] = new Array(width).fill(H);
  chars[0] = edge === 'top' ? TL : edge === 'bottom' ? BL : TEE_L;
  chars[width - 1] = edge === 'top' ? TR : edge === 'bottom' ? BR : TEE_R;

  for (let i = 1; i < width - 1; i += 1) {
    const up = above.has(i);
    const down = below.has(i);
    if (up && down) chars[i] = CROSS;
    else if (down) chars[i] = TEE_D;
    else if (up) chars[i] = TEE_U;
  }

  return chars.join('');
}

/** One cell, padded to exactly `width` with a gutter so text clears the rule. */
export function cell(text: string, width: number, align: 'left' | 'right' = 'left'): string {
  const room = Math.max(1, width - 1);
  let value = String(text ?? '');
  if (value.length > room) value = value.slice(0, room);
  return align === 'right' ? value.padStart(room) + ' ' : ' ' + value.padEnd(room);
}

export function tableRow(cols: FrameColumn[], values: string[], side = V_RULE): string {
  return side + cols.map((c, i) => cell(values[i] ?? '', c.width, c.align)).join(side) + side;
}

export function framed(width: number, text = '', side = V_RULE): string {
  return side + cell(text, width - 2) + side;
}

/** A framed line whose text is right-aligned. */
export function framedRight(width: number, text: string, side = V_RULE): string {
  return side + cell(text, width - 2, 'right') + side;
}

/**
 * A framed line with text pushed to both edges.
 *
 * Returns TWO stacked rows when the pair cannot fit side by side. A single row
 * would otherwise have to grow past the paper width, and one over-long row is
 * what tears the whole frame open — 58mm paper with a long order number and a
 * full timestamp hits this immediately.
 */
export function framedSplit(
  width: number,
  left: string,
  right: string,
  side = V_RULE,
): string[] {
  const room = width - 2;
  if (!right) return [framed(width, left, side)];
  if (left.length + right.length + 3 <= room) {
    const gap = room - left.length - right.length - 2;
    return [side + ' ' + left + ' '.repeat(gap) + right + ' ' + side];
  }
  return [framed(width, left, side), framedRight(width, right, side)];
}

/** Writes however many rows a split needed, each inset by the frame margin. */
export function writeSplit(
  builder: LineWriter,
  pad: string,
  width: number,
  left: string,
  right: string,
  side = V_RULE,
): void {
  for (const line of framedSplit(width, left, right, side)) builder.line(pad + line);
}

/**
 * A framed row whose right-hand value is printed double size, degrading to
 * normal size when it cannot fit doubled. Emphasis is worth losing; the
 * border is not.
 */
export function writeBig(
  builder: LineWriter,
  pad: string,
  width: number,
  left: string,
  big: string,
): void {
  const room = width - 2;
  if (left.length + big.length * 2 + 3 > room) {
    writeSplit(builder, pad, width, left, big);
    return;
  }
  const gap = room - left.length - big.length * 2 - 2;
  builder.text(pad + V_RULE + ' ' + left + ' '.repeat(gap));
  builder.bold(true).size(2, 2).text(big).size(1, 1).bold(false);
  builder.line(' ' + V_RULE);
}

/**
 * The row the customer is called by: "Order No: 42 … Customer Copy", the
 * number bold and double size, the copy label pushed to the right edge.
 *
 * The label is printed double HEIGHT so it stands as tall as the number —
 * a normal-height label beside it read as a small caption — but not double
 * width, which would cost the row ten columns it does not have.
 *
 * Degrades in steps rather than bursting the frame: the number drops to
 * normal size when it cannot fit doubled, and the three parts stack when even
 * that is too wide — a retail order's 13-digit number on 58mm paper hits
 * this. Emphasis is worth losing; the border is not.
 */
export function writeOrderRow(
  builder: LineWriter,
  pad: string,
  width: number,
  label: string,
  big: string,
  right: string,
  side = V_RULE,
): void {
  const room = width - 2;
  const doubledGap = room - label.length - big.length * 2 - right.length - 2;
  if (doubledGap >= 2) {
    builder.text(pad + side + ' ');
    builder.size(1, 2).text(label);
    builder.bold(true).size(2, 2).text(big).size(1, 1).bold(false);
    builder.line(' '.repeat(doubledGap) + right + ' ' + side);
    return;
  }
  const gap = room - label.length - big.length - right.length - 2;
  if (gap >= 1) {
    builder.text(pad + side + ' ' + label);
    builder.bold(true).text(big).bold(false);
    builder.line(' '.repeat(gap) + right + ' ' + side);
    return;
  }
  // "Order No: 129" on its own row, the copy label under it at the right edge.
  const fill = room - 1 - label.length - big.length;
  if (fill >= 0) {
    builder.text(pad + side + ' ' + label);
    builder.bold(true).text(big).bold(false);
    builder.line(' '.repeat(fill) + side);
    builder.line(pad + framedRight(width, right, side));
    return;
  }
  builder.line(pad + framed(width, label.trimEnd(), side));
  builder.line(pad + framedRight(width, big, side));
  builder.line(pad + framedRight(width, right, side));
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * "30-Aug-2026 9:09 PM".
 *
 * Spelled out rather than a locale format, which renders 8/30/2026 in one
 * locale and 30/8/2026 in another — on a printed bill that ambiguity is a
 * dispute waiting to happen.
 */
export function receiptStamp(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const hours = date.getHours();
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}-${MONTHS[date.getMonth()]}-${date.getFullYear()} ${h12}:${minutes} ${hours < 12 ? 'AM' : 'PM'}`;
}

/** Word-wraps a product name to the item column width. */
export function wrapName(name: string, width: number): string[] {
  const words = name.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= width) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word.length > width ? word.slice(0, width) : word;
    }
  }
  if (current) lines.push(current);

  return lines.length > 0 ? lines : [''];
}
