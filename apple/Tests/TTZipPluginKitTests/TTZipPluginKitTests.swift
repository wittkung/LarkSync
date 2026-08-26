// SPDX-License-Identifier: MIT
//
// TTZipPluginKitTests: Unit tests for Plugin Registry and Extensions.

import Testing
import Foundation
@testable import TTZipPluginKit
@testable import TTMarkdownKit

@Suite("TTZip Plugin Kit Tests")
struct TTZipPluginKitTests {
    
    @Test("Test Plugin Manifest Validation")
    func testPluginManifest() {
        let manifest = TTZipPluginManifest(
            id: "com.test.plugin",
            name: "Test Plugin",
            version: "1.0.0",
            author: "Tester",
            description: "A test plugin",
            iconSystemName: "star.fill",
            permissions: [.networkAccess, .keychainAccess]
        )
        
        #expect(manifest.id == "com.test.plugin")
        #expect(manifest.permissions.count == 2)
        #expect(manifest.permissions.contains(.networkAccess))
    }
    
    @Test("Test Theme Tokens Integrity")
    func testThemeTokens() {
        #expect(TTZipTheme.Layout.headerBarHeight == 52.0)
        #expect(TTZipTheme.Layout.kintsugiGoldLineHeight == 1.5)
    }
}
