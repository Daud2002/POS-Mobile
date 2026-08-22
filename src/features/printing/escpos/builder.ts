import { Cmd, CodepageValue, concatBytes } from './commands';
import { clampToWidth, encodeText, printedWidth } from './encoding';

export type Align = 'left' | 'center' | 'right';

export interface BuilderProfile {
  /** 32 for 58 mm paper, 48 for 80 mm. */
  charsPerLine: number;
  codepage: CodepageValue;
}

export interface Column {
  text: string;
  /** Width in character cells. */
  width: number;
  align?: Align;
}

/**
 * Fluent ESC/POS receipt builder.
 *
 * Pure — no native dependencies, no I/O — so the whole receipt layout is unit
 * testable and can be rendered to an on-screen preview without a printer.
 *
 * Layout is done in software (space padding) rather than with the printer's
 * own column features, because that is what makes the preview truthful and
 * keeps behaviour identical across printer models.
 */
export class EscPosBuilder {
  private readonly chunks: Uint8Array[] = [];
  private readonly width: number;

  constructor(private readonly profile: BuilderProfile) {
    this.width = profile.charsPerLine;
  }

  /** Reset the printer and select the code page. Always call this first. */
  init(): this {
    this.chunks.push(Cmd.INIT);
    this.chunks.push(Cmd.codepage(this.profile.codepage));
    return this;
  }

  raw(bytes: Uint8Array): this {
    this.chunks.push(bytes);
    return this;
  }

  align(mode: Align): this {
    this.chunks.push(Cmd.align(mode));
    return this;
  }

  bold(on: boolean): this {
    this.chunks.push(Cmd.bold(on));
    return this;
  }

  underline(weight: 0 | 1 | 2): this {
    this.chunks.push(Cmd.underline(weight));
    return this;
  }

  /** Character size multipliers, 1..8. Avoid width > 1 on column-aligned rows. */
  size(width: number, height: number): this {
    this.chunks.push(Cmd.size(width, height));
    return this;
  }

  /** Writes text with no trailing newline. */
  text(value: string): this {
    this.chunks.push(encodeText(value));
    return this;
  }

  newline(count = 1): this {
    for (let i = 0; i < count; i += 1) this.chunks.push(Cmd.LF);
    return this;
  }

  /** Writes one line, clamped to the paper width so it can never wrap. */
  line(value = ''): this {
    return this.text(clampToWidth(value, this.width)).newline();
  }

  /**
   * Word-wraps long text across as many lines as it needs.
   *
   * The web app instead truncates product names to 15 characters
   * (`item.name.substring(0, 15)`), which silently loses information on any
   * real product name.
   */
  wrapped(value: string): this {
    for (const wrappedLine of wrapText(value, this.width)) {
      this.line(wrappedLine);
    }
    return this;
  }

  /** A full-width rule, e.g. `--------------------------------`. */
  divider(char = '-'): this {
    return this.line(char.repeat(this.width));
  }

  /**
   * Label left, value right, on one line.
   *
   * Unlike the web version, the value is clamped to the space actually
   * available: `row('INVOICE #:', '1717257600000')` is 10 + 13 = 23 cells, but
   * the web code reserves only `width - labelWidth` (16) for it, so anything
   * longer pushes the line past the paper width and wraps badly.
   */
  row(label: string, value: string, labelWidth?: number): this {
    const reserved = labelWidth ?? Math.min(printedWidth(label) + 1, this.width - 1);
    const valueWidth = Math.max(0, this.width - reserved);

    const clampedValue = clampToWidth(value, valueWidth);
    const clampedLabel = clampToWidth(label, reserved);

    const labelPad = ' '.repeat(Math.max(0, reserved - printedWidth(clampedLabel)));
    const valuePad = ' '.repeat(Math.max(0, valueWidth - printedWidth(clampedValue)));

    return this.line(`${clampedLabel}${labelPad}${valuePad}${clampedValue}`);
  }

  /** Centers text within the paper width. */
  centered(value: string): this {
    const clamped = clampToWidth(value, this.width);
    const slack = this.width - printedWidth(clamped);
    const left = Math.floor(slack / 2);
    return this.line(`${' '.repeat(left)}${clamped}`);
  }

  /**
   * A fixed-width column row, e.g. `ITEM(16) QTY(5) AMOUNT(11)`.
   * Overflowing cells are clamped rather than pushing the row wider.
   */
  columns(columns: Column[]): this {
    let out = '';
    for (const column of columns) {
      const clamped = clampToWidth(column.text, column.width);
      const pad = ' '.repeat(Math.max(0, column.width - printedWidth(clamped)));
      out += column.align === 'right' ? `${pad}${clamped}` : `${clamped}${pad}`;
    }
    return this.line(out);
  }

  feed(lines: number): this {
    this.chunks.push(Cmd.feed(lines));
    return this;
  }

  cut(): this {
    this.chunks.push(Cmd.cut());
    return this;
  }

  openCashDrawer(): this {
    this.chunks.push(Cmd.cashDrawer());
    return this;
  }

  build(): Uint8Array {
    return concatBytes(this.chunks);
  }
}

/**
 * Word wrap at a printed-cell width.
 * Words longer than the line are hard-split rather than left to overflow.
 */
export function wrapText(value: string, width: number): string[] {
  if (width <= 0) return [value];

  const lines: string[] = [];
  let current = '';

  for (const word of value.split(/\s+/).filter(Boolean)) {
    const candidate = current ? `${current} ${word}` : word;

    if (printedWidth(candidate) <= width) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
      current = '';
    }

    // A single word wider than the line — split it across lines.
    let remainder = word;
    while (printedWidth(remainder) > width) {
      const head = clampToWidth(remainder, width);
      lines.push(head);
      remainder = remainder.slice(head.length);
    }
    current = remainder;
  }

  if (current) lines.push(current);
  return lines.length > 0 ? lines : [''];
}
