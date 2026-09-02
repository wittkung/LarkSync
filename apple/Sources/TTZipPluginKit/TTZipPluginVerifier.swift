// SPDX-License-Identifier: BSD-3-Clause OR Apache-2.0
//
// Copyright (c) 2026 Witt Kung <witt.w.kung@gmail.com>
// All rights reserved.
//
// TTZip: High-performance native archiving and compression engine.

import Foundation
import CryptoKit

/// Digital signature and SHA-256 integrity verifier (Ed25519 & Safe Hash).
public enum TTZipPluginVerifier {
    public enum VerificationError: Error, Sendable {
        case fileNotFound
        case invalidHash(expected: String, actual: String)
        case invalidSignature
        case invalidPublicKeyData
    }
    
    /// Verifies file SHA-256 digest against expected hex.
    public static func verifySHA256(fileURL: URL, expectedHex: String) throws {
        guard let data = try? Data(contentsOf: fileURL) else {
            throw VerificationError.fileNotFound
        }
        let digest = SHA256.hash(data: data)
        let actualHex = digest.map { String(format: "%02x", $0) }.joined()
        if actualHex.lowercased() != expectedHex.lowercased() {
            throw VerificationError.invalidHash(expected: expectedHex, actual: actualHex)
        }
    }
    
    /// Verifies Ed25519 digital signature against data buffer.
    public static func verifyEd25519Signature(
        data: Data,
        signatureData: Data,
        publicKeyBase64: String
    ) throws {
        guard let rawKeyData = Data(base64Encoded: publicKeyBase64),
              let publicKey = try? Curve25519.Signing.PublicKey(rawRepresentation: rawKeyData) else {
            throw VerificationError.invalidPublicKeyData
        }
        
        guard publicKey.isValidSignature(signatureData, for: data) else {
            throw VerificationError.invalidSignature
        }
    }
}
