// Renders the 1024pt app icon: the design's route glyph in lime and mint on
// the Nightglass background. Run: swift scripts/make-icon.swift <output.png>
import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

let size = 1024
let space = CGColorSpace(name: CGColorSpace.sRGB)!
let ctx = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: 0, space: space, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!

func color(_ hex: UInt32, _ a: CGFloat = 1) -> CGColor {
    CGColor(srgbRed: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: a)
}

// Background: deep night with a soft cool glow from the top.
ctx.setFillColor(color(0x0A0D11))
ctx.fill(CGRect(x: 0, y: 0, width: size, height: size))
let glow = CGGradient(colorsSpace: space, colors: [color(0x2A3B4C), color(0x0A0D11, 0)] as CFArray, locations: [0, 1])!
ctx.drawRadialGradient(glow, startCenter: CGPoint(x: 512, y: 860), startRadius: 0, endCenter: CGPoint(x: 512, y: 860), endRadius: 760, options: [])

// Flip to SVG-like coordinates (origin top-left), 24-unit grid scaled up.
ctx.translateBy(x: 0, y: CGFloat(size))
ctx.scaleBy(x: 1, y: -1)
let scale: CGFloat = 1024 / 24 * 0.72
let offset = (CGFloat(size) - 24 * scale) / 2
ctx.translateBy(x: offset, y: offset)
ctx.scaleBy(x: scale, y: scale)

// Route: M8.5 18 H15 a3 3 0 0 0 0-6 H9 a3 3 0 0 1 0-6 h6.5
let route = CGMutablePath()
route.move(to: CGPoint(x: 8.5, y: 18))
route.addLine(to: CGPoint(x: 15, y: 18))
route.addArc(center: CGPoint(x: 15, y: 15), radius: 3, startAngle: .pi / 2, endAngle: -.pi / 2, clockwise: true)
route.addLine(to: CGPoint(x: 9, y: 12))
route.addArc(center: CGPoint(x: 9, y: 9), radius: 3, startAngle: .pi / 2, endAngle: -.pi / 2, clockwise: false)
route.addLine(to: CGPoint(x: 15.5, y: 6))

ctx.setLineCap(.round)
ctx.setLineJoin(.round)
ctx.setShadow(offset: .zero, blur: 1.2, color: color(0xD4F54A, 0.55))
ctx.setStrokeColor(color(0xD4F54A))
ctx.setLineWidth(1.9)
ctx.addPath(route)
ctx.strokePath()

ctx.setShadow(offset: .zero, blur: 1.2, color: color(0x3DF5A8, 0.6))
ctx.setStrokeColor(color(0x3DF5A8))
ctx.setLineWidth(1.9)
ctx.strokeEllipse(in: CGRect(x: 6 - 2.5, y: 18 - 2.5, width: 5, height: 5))
ctx.setShadow(offset: .zero, blur: 1.2, color: color(0xD4F54A, 0.55))
ctx.setFillColor(color(0xD4F54A))
ctx.fillEllipse(in: CGRect(x: 18 - 2.5, y: 6 - 2.5, width: 5, height: 5))

let image = ctx.makeImage()!
let url = URL(fileURLWithPath: CommandLine.arguments[1])
let dest = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil)!
CGImageDestinationAddImage(dest, image, nil)
CGImageDestinationFinalize(dest)
print("wrote \(url.path)")
