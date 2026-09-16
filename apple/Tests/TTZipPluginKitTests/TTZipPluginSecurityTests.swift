// SPDX-License-Identifier: MIT
//
// TTZipPluginSecurityTests: Cryptographic verification and Zip Slip defense unit tests.

import Testing
import Foundation
import CryptoKit
@testable import TTZipPluginKit

@Suite("TTZip Plugin Security & Crypto Tests")
struct TTZipPluginSecurityTests {
    
    @Test("Test Ed25519 Signature Generation and Verification Flow")
    func testEd25519CryptoKitRoundtrip() throws {
        // 1. 生成真实 Ed25519 密钥对
        let privateKey = Curve25519.Signing.PrivateKey()
        let publicKey = privateKey.publicKey
        
        let testData = "TTZip Plugin Security Test Content".data(using: .utf8)!
        let signature = try privateKey.signature(for: testData)
        
        let pubBase64 = publicKey.rawRepresentation.base64EncodedString()
        let sigBase64 = signature.base64EncodedString()
        
        // 2. 写入临时文件测试
        let tempFile = FileManager.default.temporaryDirectory.appendingPathComponent("test-sec-\(UUID().uuidString).bin")
        try testData.write(to: tempFile)
        defer { try? FileManager.default.removeItem(at: tempFile) }
        
        // 3. 验证正确签名
        try TTZipPluginSecurity.verifyEd25519(
            archiveFileURL: tempFile,
            signatureBase64: sigBase64,
            trustedPublicKeyBase64: pubBase64
        )
        
        // 4. 篡改文件后验证必然失败
        let tamperedData = "Tampered Content".data(using: .utf8)!
        try tamperedData.write(to: tempFile)
        
        #expect(throws: TTZipPluginSecurity.SecurityError.self) {
            try TTZipPluginSecurity.verifyEd25519(
                archiveFileURL: tempFile,
                signatureBase64: sigBase64,
                trustedPublicKeyBase64: pubBase64
            )
        }
    }
    
    @Test("Test Real Production LarkSync Archive Ed25519 Verification")
    func testRealLarkSyncArchiveVerification() throws {
        let fallback = TTZipMarketplaceService.fallbackPlugin
        let zipURL = URL(fileURLWithPath: "/Users/kevintung/Documents/dev/studio-lab/larksync/dist/LarkSync-v\(fallback.version).ttplugin.zip")
        guard FileManager.default.fileExists(atPath: zipURL.path) else {
            return // 若本地未打包则跳过
        }
        
        // 1. 验证真实 SHA-256 哈希
        try TTZipPluginSecurity.verifyStreamingSHA256(fileURL: zipURL, expectedHex: fallback.sha256)

        
        // 2. 验证真实 Ed25519 签名
        try TTZipPluginSecurity.verifyEd25519(
            archiveFileURL: zipURL,
            signatureBase64: fallback.signature,
            trustedPublicKeyBase64: fallback.publicKey
        )
    }
    
    @Test("Test Zip Slip Path Traversal Defense")
    func testZipSlipDefense() throws {
        let stagingDir = FileManager.default.temporaryDirectory.appendingPathComponent("test-staging-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: stagingDir, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: stagingDir) }
        
        // 合法路径
        let safePath = "LarkSync.ttplugin/Contents/Info.plist"
        let safeURL = try TTZipPluginSecurity.validateSafeDestination(entryRelativePath: safePath, stagingRoot: stagingDir)
        #expect(safeURL.path.hasPrefix(stagingDir.path))
        
        // 恶意穿越路径
        let maliciousPath = "../../Applications/EvilApp.app"
        #expect(throws: TTZipPluginSecurity.SecurityError.self) {
            _ = try TTZipPluginSecurity.validateSafeDestination(entryRelativePath: maliciousPath, stagingRoot: stagingDir)
        }
    }
}
