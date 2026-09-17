// SPDX-License-Identifier: MIT
//
// TTZipPluginKitTests: Unit tests for Plugin Registry and Extensions.

import XCTest
import Foundation
@testable import TTZipPluginKit
@testable import TTMarkdownKit

final class TTZipPluginKitTests: XCTestCase {
    
    func testPluginManifest() throws {
        let manifest = TTZipPluginManifest(
            id: "com.test.plugin",
            name: "Test Plugin",
            version: "1.0.0",
            author: "Tester",
            description: "A test plugin",
            iconSystemName: "star.fill",
            permissions: [.networkAccess, .keychainAccess]
        )
        
        XCTAssertEqual(manifest.id, "com.test.plugin")
        XCTAssertEqual(manifest.permissions.count, 2)
        XCTAssertTrue(manifest.permissions.contains(.networkAccess))
    }
    
    func testThemeTokens() throws {
        XCTAssertEqual(TTZipTheme.Layout.headerBarHeight, 52.0)
        XCTAssertEqual(TTZipTheme.Layout.kintsugiGoldLineHeight, 1.5)
    }
}
