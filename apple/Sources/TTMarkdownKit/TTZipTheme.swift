// SPDX-License-Identifier: MIT
//
// TTMarkdownKit: TTZipTheme design tokens system.

import SwiftUI

public enum TTZipTheme {
    // MARK: - 1. Color Palette Tokens
    public static let kintsugiGold = Color(red: 0.83, green: 0.69, blue: 0.22)   // #D4AF37
    public static let bambooGreen = Color(red: 0.18, green: 0.55, blue: 0.34)    // #2E8B57
    public static let cinnabarRed = Color(red: 0.78, green: 0.29, blue: 0.19)    // #C84B31
    public static let washiPaper = Color(red: 0.98, green: 0.98, blue: 0.99)     // #FBFBFD
    public static let deepGraphite = Color(red: 0.11, green: 0.11, blue: 0.12)   // #1C1C1E
    public static let inkBlack = Color(red: 0.04, green: 0.04, blue: 0.05)       // #0B0B0C
    public static let hairlineBorder = Color.primary.opacity(0.08)

    // MARK: - 2. Typography
    public enum Typography {
        public static let wsjHeadline = Font.system(size: 26, weight: .light, design: .serif)
        public static let wsjSubheadline = Font.system(size: 18, weight: .medium, design: .serif)
        public static let title = Font.system(size: 16, weight: .semibold, design: .default)
        public static let body = Font.system(size: 13, weight: .regular, design: .default)
        public static let caption = Font.system(size: 11, weight: .regular, design: .default)
        public static let mono = Font.system(size: 12, weight: .regular, design: .monospaced)
    }

    // MARK: - 3. Layout Grid
    public enum Layout {
        public static let headerBarHeight: CGFloat = 52.0
        public static let topBarOffset: CGFloat = 38.0
        public static let kintsugiGoldLineHeight: CGFloat = 1.5
        public static let sidebarDefaultWidth: CGFloat = 200.0
        public static let rightPanelDefaultWidth: CGFloat = 280.0
    }
}

public struct TTZipLiquidGlassModifier: ViewModifier {
    var cornerRadius: CGFloat
    @Environment(\.colorScheme) var colorScheme

    public init(cornerRadius: CGFloat = 12) {
        self.cornerRadius = cornerRadius
    }

    public func body(content: Content) -> some View {
        content
            .background(
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .fill(colorScheme == .dark ? Color.primary.opacity(0.04) : Color.white.opacity(0.70))
                    .overlay(
                        RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                            .stroke(colorScheme == .dark ? Color.white.opacity(0.08) : Color.black.opacity(0.06), lineWidth: 0.8)
                    )
            )
    }
}

public extension View {
    func ttzipLiquidGlass(cornerRadius: CGFloat = 12) -> some View {
        self.modifier(TTZipLiquidGlassModifier(cornerRadius: cornerRadius))
    }
}
