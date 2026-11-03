// Copyright 2026 MetastudyLine. All rights reserved.
// Proprietary and confidential.

import XCTest
import Foundation
@testable import TTMarkdownKit

final class TTMarkdownKitTests: XCTestCase {
    func testThemeTokens() throws {
        XCTAssertEqual(MarkdownTheme.Layout.headerBarHeight, 52.0)
        XCTAssertEqual(MarkdownTheme.Layout.kintsugiGoldLineHeight, 1.5)
    }
}
