// swift-tools-version: 6.0
// SPDX-License-Identifier: BSD-3-Clause OR Apache-2.0
//
// Copyright (c) 2026 Witt Kung <witt.w.kung@gmail.com>
// All rights reserved.
//
// LarkSync: Mozilla UniFFI + Swift 6 native architecture.

import PackageDescription

let swiftSettings: [SwiftSetting] = [
    .enableUpcomingFeature("StrictConcurrency")
]

let package = Package(
    name: "LarkSync",
    defaultLocalization: "en",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .library(name: "TTMarkdownKit", targets: ["TTMarkdownKit"]),
        .library(name: "LarkSyncCore", targets: ["LarkSyncCore"]),
        .library(name: "LarkSyncUI", targets: ["LarkSyncUI"]),
        .library(name: "LarkSyncPlugin", type: .dynamic, targets: ["LarkSyncPlugin"])
    ],
    dependencies: [
        .package(path: "Sources/TTZipPluginKit")
    ],
    targets: [
        // 1. Mozilla UniFFI C-ABI Modulemap Target
        .target(
            name: "larksync_ffiFFI",
            path: "Sources/larksync_ffiFFI",
            publicHeadersPath: "include"
        ),

        // 2. LarkSyncCore (Mozilla UniFFI generated Swift interface)
        .target(
            name: "LarkSyncCore",
            dependencies: ["larksync_ffiFFI"],
            path: "Sources/LarkSyncCore",
            exclude: [
                "larksync_ffiFFI.h",
                "larksync_ffiFFI.modulemap"
            ],
            swiftSettings: swiftSettings,
            linkerSettings: [
                .unsafeFlags([
                    "-L", "../target/release",
                    "-L", "../target/debug",
                    "-llarksync_ffi"
                ])
            ]
        ),

        // 3. WYSIWYG Markdown engine and theme rendering kit
        .target(
            name: "TTMarkdownKit",
            dependencies: [.product(name: "TTZipPluginKit", package: "TTZipPluginKit")],
            path: "Sources/TTMarkdownKit",
            resources: [
                .process("Resources")
            ],
            swiftSettings: swiftSettings
        ),
        
        // 4. LarkSync native UI components (Miller columns / inspector / editor)
        .target(
            name: "LarkSyncUI",
            dependencies: [.product(name: "TTZipPluginKit", package: "TTZipPluginKit"), "TTMarkdownKit", "LarkSyncCore"],
            path: "Sources/LarkSyncUI",
            swiftSettings: swiftSettings
        ),
        
        // 5. LarkSync plugin dynamic entry
        .target(
            name: "LarkSyncPlugin",
            dependencies: [.product(name: "TTZipPluginKit", package: "TTZipPluginKit"), "TTMarkdownKit", "LarkSyncCore", "LarkSyncUI"],
            path: "Sources/LarkSyncPlugin",
            swiftSettings: swiftSettings,
            linkerSettings: [
                .unsafeFlags([
                    "-Xlinker", "-rpath", "-Xlinker", "@loader_path/../Frameworks",
                    "-Xlinker", "-rpath", "-Xlinker", "@executable_path/../Frameworks"
                ])
            ]
        ),
        
        // 6. Unit test suite
        .testTarget(
            name: "TTZipPluginKitTests",
            dependencies: [.product(name: "TTZipPluginKit", package: "TTZipPluginKit"), "TTMarkdownKit"],
            path: "Tests/TTZipPluginKitTests",
            swiftSettings: swiftSettings
        )
    ]
)
