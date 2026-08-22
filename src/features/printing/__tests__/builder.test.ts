import { EscPosBuilder, wrapText } from '../escpos/builder';
import { Codepage } from '../escpos/commands';
import { clampToWidth, encodeText, printedWidth } from '../escpos/encoding';
import { decodePrintable } from '../templates/receipt.template';

const profile58 = { charsPerLine: 32, codepage: Codepage.CP437 };
const profile80 = { charsPerLine: 48, codepage: Codepage.CP437 };

/** Renders builder output back to text, dropping the leading init sequence. */
function render(build: (b: EscPosBuilder) => void, profile = profile58): string[] {
  const builder = new EscPosBuilder(profile);
  builder.init();
  build(builder);
  return decodePrintable(builder.build()).split('\n');
}

describe('encoding', () => {
  it('passes ASCII through unchanged', () => {
    expect(Array.from(encodeText('ABC'))).toEqual([65, 66, 67]);
  });

  it('maps CP437 characters to their real byte', () => {
    // £ is 0x9C in CP437.
    expect(Array.from(encodeText('£'))).toEqual([0x9c]);
  });

  it('transliterates symbols no code page can print', () => {
    // ₹ has no CP437 byte, so it must degrade to readable ASCII rather than
    // printing as garbage — which is what the web app does today.
    expect(String.fromCharCode(...encodeText('₹'))).toBe('Rs');
  });

  it('drops emoji rather than emitting garbage bytes', () => {
    expect(encodeText('💙').length).toBe(0);
  });

  it('measures printed width in cells, not JS characters', () => {
    // One JS char, two printed cells.
    expect('₹'.length).toBe(1);
    expect(printedWidth('₹')).toBe(2);
    expect(printedWidth('💙')).toBe(0);
  });

  it('clamps by printed width', () => {
    expect(clampToWidth('ABCDEFGH', 3)).toBe('ABC');
    expect(clampToWidth('AB', 5)).toBe('AB');
  });
});

describe('EscPosBuilder layout', () => {
  it('emits a divider exactly one line wide', () => {
    const [line] = render((b) => b.divider());
    expect(line).toBe('-'.repeat(32));
    expect(line).toHaveLength(32);
  });

  it('centers text within the paper width', () => {
    const [line] = render((b) => b.centered('THANK YOU'));
    expect(line).toBe('           THANK YOU');
    // Left padding is floor(slack / 2), matching the web app's left-biased
    // centering for odd remainders.
    expect(line.indexOf('T')).toBe(Math.floor((32 - 9) / 2));
  });

  it('aligns a label/value row to exactly the paper width', () => {
    const [line] = render((b) => b.row('TOTAL:', 'Rs1210.00', 16));
    expect(line).toHaveLength(32);
    expect(line.startsWith('TOTAL:')).toBe(true);
    expect(line.endsWith('Rs1210.00')).toBe(true);
  });

  it('clamps a long value instead of overflowing the line', () => {
    // The web version reserves only (32 - 16) = 16 cells for the value, so a
    // 13-char invoice number plus a 10-char label pushes past the paper width.
    const [line] = render((b) => b.row('INVOICE #:', '1717257600000', 16));
    expect(line).toHaveLength(32);
    expect(line.startsWith('INVOICE #:')).toBe(true);
  });

  it('lays out fixed columns that sum to the paper width', () => {
    const [line] = render((b) =>
      b.columns([
        { text: 'ITEM', width: 16 },
        { text: 'QTY', width: 5 },
        { text: 'AMOUNT', width: 11, align: 'right' },
      ]),
    );
    expect(line).toHaveLength(32);
    expect(line.slice(0, 4)).toBe('ITEM');
    expect(line.endsWith('AMOUNT')).toBe(true);
  });

  it('right-aligns a column by padding on the left', () => {
    const [line] = render((b) =>
      b.columns([{ text: '360.00', width: 11, align: 'right' }]),
    );
    expect(line).toBe('     360.00');
  });

  it('never emits a line wider than the paper', () => {
    const lines = render((b) => b.line('X'.repeat(80)));
    expect(lines[0]).toHaveLength(32);
  });

  it('uses the full width on 80mm paper', () => {
    const [line] = render((b) => b.divider(), profile80);
    expect(line).toHaveLength(48);
  });
});

describe('wrapText', () => {
  it('wraps on word boundaries', () => {
    expect(wrapText('Coca Cola 1.5L Bottle', 16)).toEqual(['Coca Cola 1.5L', 'Bottle']);
  });

  it('hard-splits a word longer than the line', () => {
    expect(wrapText('ABCDEFGHIJ', 4)).toEqual(['ABCD', 'EFGH', 'IJ']);
  });

  it('never returns an empty array', () => {
    expect(wrapText('', 10)).toEqual(['']);
  });
});

describe('ESC/POS command emission', () => {
  it('starts every job with ESC @ so prior state cannot leak in', () => {
    const bytes = new EscPosBuilder(profile58).init().build();
    expect(Array.from(bytes.slice(0, 2))).toEqual([0x1b, 0x40]);
  });

  it('emits a partial cut', () => {
    const bytes = new EscPosBuilder(profile58).cut().build();
    // GS V 66 n — feed then partial cut.
    expect(Array.from(bytes.slice(0, 3))).toEqual([0x1d, 0x56, 66]);
  });

  it('encodes character size as packed width/height nibbles', () => {
    const bytes = new EscPosBuilder(profile58).size(2, 2).build();
    // GS ! n, with n = (1 << 4) | 1 for 2x/2x.
    expect(Array.from(bytes)).toEqual([0x1d, 0x21, 0x11]);
  });
});
