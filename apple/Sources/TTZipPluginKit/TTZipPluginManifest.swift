// SPDX-License-Identifier: BSD-3-Clause OR Apache-2.0
//
// Copyright (c) 2026 Witt Kung <witt.w.kung@gmail.com>
// All rights reserved.
//
// TTZip: High-performance native archiving and compression engine.

import Foundation

/// Declarative Plugin Manifest
public struct TTZipPluginManifest: Sendable, Codable, Identifiable {
    public let id: String
    public let name: String
    public let version: String
    public let author: String
    public let description: String
    public let iconSystemName: String
    public let homepage: URL?
    public let permissions: [TTZipPluginPermission]
    
    public init(
        id: String,
        name: String,
        version: String,
        author: String,
        description: String,
        iconSystemName: String,
        homepage: URL? = nil,
        permissions: [TTZipPluginPermission] = []
    ) {
        self.id = id
        self.name = name
        self.version = version
        self.author = author
        self.description = description
        self.iconSystemName = iconSystemName
        self.homepage = homepage
        self.permissions = permissions
    }
}

/// Object-Capability Security Permissions
public enum TTZipPluginPermission: String, Sendable, Codable {
    case networkAccess = "permission.network"
    case keychainAccess = "permission.keychain"
    case fileSystemRead = "permission.fs.read"
    case fileSystemWrite = "permission.fs.write"
    case archiveEngine = "permission.archive"
}
