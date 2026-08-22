/**
 * Text → printer bytes.
 *
 * Thermal printers do not speak UTF-8. They render one byte per glyph from the
 * selected code page, so a JS string has to be mapped down to single bytes.
 *
 * The web app never sets an encoding at all (QZ's `encoding` config is null),
 * which works only because the default PKR symbol is the ASCII-safe "Rs". Any
 * store on EUR/INR/JPY prints garbage there. Here, characters CP437 can render
 * are mapped to their real byte, and everything else is transliterated to ASCII
 * so the receipt stays readable instead of turning into noise.
 */

/** CP437 high range (0x80–0xFF) → the Unicode character each byte prints. */
const CP437_HIGH =
  'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒ' +
  'áíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐' +
  '└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀' +
  'αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ';

/** Unicode char → CP437 byte, built once from the table above. */
const CP437_MAP: Map<string, number> = new Map();
for (let i = 0; i < CP437_HIGH.length; i += 1) {
  CP437_MAP.set(CP437_HIGH[i], 0x80 + i);
}

/**
 * Characters no code page can render, mapped to an ASCII equivalent.
 * Currency symbols dominate here because they appear on every line of totals.
 */
const TRANSLITERATE: Record<string, string> = {
  '₹': 'Rs',
  '₨': 'Rs',
  '€': 'EUR',
  '₺': 'TL',
  '₦': 'N',
  '₱': 'P',
  '₩': 'W',
  '₪': 'ILS',
  '฿': 'THB',
  '₫': 'VND',
  '₴': 'UAH',
  '₸': 'KZT',
  '₼': 'AZN',
  '₾': 'GEL',
  '৳': 'BDT',
  '₵': 'GHS',
  '؋': 'AFN',
  '﷼': 'SAR',
  '“': '"',
  '”': '"',
  '‘': "'",
  '’': "'",
  '–': '-',
  '—': '-',
  '…': '...',
  ' ': ' ',
};

/**
 * Maps a single character to its printable byte(s).
 * Returns an empty array for characters that cannot be represented at all.
 */
function encodeChar(char: string): number[] {
  const code = char.charCodeAt(0);

  // ASCII passes through untouched.
  if (code >= 0x20 && code <= 0x7e) return [code];

  // Control characters we emit deliberately (LF, CR, tab).
  if (code === 0x0a || code === 0x0d || code === 0x09) return [code];

  const substitute = TRANSLITERATE[char];
  if (substitute !== undefined) {
    return Array.from(substitute, (c) => c.charCodeAt(0));
  }

  const cp437 = CP437_MAP.get(char);
  if (cp437 !== undefined) return [cp437];

  // Emoji and anything else unrepresentable. The web app's earlier receipt
  // version had a "Visit Again 💙" footer that was removed for exactly this
  // reason — emoji do not survive raw ESC/POS.
  return [];
}

/** Encodes a string to printer bytes for the active code page. */
export function encodeText(text: string): Uint8Array {
  const bytes: number[] = [];
  for (const char of text) {
    bytes.push(...encodeChar(char));
  }
  return Uint8Array.from(bytes);
}

/**
 * The width a string will occupy on paper, in character cells.
 *
 * This is NOT `text.length`: a transliterated '₹' becomes two cells ("Rs"), and
 * an emoji becomes zero. Column layout must measure with this or the padding
 * arithmetic silently drifts.
 */
export function printedWidth(text: string): number {
  let width = 0;
  for (const char of text) {
    width += encodeChar(char).length;
  }
  return width;
}

/**
 * Truncates to a maximum printed width, measuring the same way the printer
 * will. Used to clamp values that would otherwise overflow a column.
 */
export function clampToWidth(text: string, maxWidth: number): string {
  if (printedWidth(text) <= maxWidth) return text;

  let out = '';
  let width = 0;
  for (const char of text) {
    const charWidth = encodeChar(char).length;
    if (width + charWidth > maxWidth) break;
    out += char;
    width += charWidth;
  }
  return out;
}
