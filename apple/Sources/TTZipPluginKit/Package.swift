// swift-tools-version: 6.0
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Copyright (c) 2026 Witt Kung <witt.w.kung@gmail.com>
// All rights reserved.
//
// TTZip: High-performance native archiving and compression engine.

import PackageDescription

let package = Package(
    name: "TTZipPluginKit",
    platforms: [.macOS(.v14)],
    products: [
        .library(name: "TTZipPluginKit", type: .dynamic, targets: ["TTZipPluginKit"])
    ],
    targets: [
        .target(
            name: "TTZipPluginKit",
            path: ".",
            exclude: ["README.md", "README.zh-CN.md", "Package.swift"]
        )
    ]
)
