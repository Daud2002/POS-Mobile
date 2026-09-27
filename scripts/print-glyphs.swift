// Rasterises a monospace font into the 1-bit glyph cells of
// src/features/printing/escpos/glyphs.ts. macOS only (CoreText).
//
// Usage: print-glyphs <font.ttf> <cellWidth> <cellHeight> <baselineFromTop>
// Prints the glyphs as one base64 string.
import Foundation
import CoreText
import CoreGraphics

let fontPath = CommandLine.arguments[1]
let cellW = Int(CommandLine.arguments[2])!, cellH = Int(CommandLine.arguments[3])!
let baseline = Double(CommandLine.arguments[4])!
let desc = CTFontManagerCreateFontDescriptorsFromURL(URL(fileURLWithPath: fontPath) as CFURL) as! [CTFontDescriptor]
// Monospace advance is 0.6 em, so the em that fills a cell exactly is cellW / 0.6.
let font = CTFontCreateWithFontDescriptor(desc[0], CGFloat(Double(cellW) / 0.6), nil)
let codes = Array(0x20...0x7E) + Array(0xA0...0xFF)
let stride = (cellW + 7) / 8
var out = [UInt8]()
for code in codes {
  let ctx = CGContext(data: nil, width: cellW, height: cellH, bitsPerComponent: 8, bytesPerRow: cellW,
                      space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue)!
  ctx.setFillColor(gray: 1, alpha: 1); ctx.fill(CGRect(x: 0, y: 0, width: cellW, height: cellH))
  ctx.setShouldAntialias(true)
  var ch = UniChar(code); var glyph = CGGlyph(0)
  CTFontGetGlyphsForCharacters(font, &ch, &glyph, 1)
  ctx.setFillColor(gray: 0, alpha: 1)
  var pos = CGPoint(x: 0, y: Double(cellH) - baseline)
  CTFontDrawGlyphs(font, &glyph, &pos, 1, ctx)
  let px = ctx.data!.bindMemory(to: UInt8.self, capacity: cellW * cellH)
  for y in 0..<cellH {
    var row = [UInt8](repeating: 0, count: stride)
    for x in 0..<cellW where px[y * cellW + x] < 128 { row[x >> 3] |= 0x80 >> UInt8(x & 7) }
    out += row
  }
}
print(Data(out).base64EncodedString())
