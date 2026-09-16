// swift-tools-version: 6.0
// SPDX-License-Identifier: BSD-3-Clause OR Apache-2.0
//
// Copyright (c) 2026 Witt Kung <witt.w.kung@gmail.com>
// All rights reserved.
//
// LarkSync: Mozilla UniFFI + Swift 6 native architecture.

import PackageDescription
import Foundation

let packageDir = URL(fileURLWithPath: #filePath).deletingLastPathComponent().path
let targetReleaseDir = "\(packageDir)/target/release"
let targetDebugDir = "\(packageDir)/target/debug"

let swiftSettings: [SwiftSetting] = [
    .enableUpcomingFeature("StrictConcurrency")
]

let package = Package(
    name: "LarkSync",
    defaultLocalization: "zh-Hans",
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
        .package(path: "apple/Sources/TTZipPluginKit")
    ],
    targets: [
        // 1. Mozilla UniFFI C-ABI Modulemap Target
        .target(
            name: "larksync_ffiFFI",
            path: "apple/Sources/larksync_ffiFFI",
            publicHeadersPath: "include"
        ),

        // 2. LarkSyncCore (Mozilla UniFFI 生成的强类型 Swift 接口)
        .target(
            name: "LarkSyncCore",
            dependencies: ["larksync_ffiFFI"],
            path: "apple/Sources/LarkSyncCore",
            exclude: [
                "larksync_ffiFFI.h",
                "larksync_ffiFFI.modulemap"
            ],
            swiftSettings: swiftSettings,
            linkerSettings: [
                .unsafeFlags([
                    "-L", targetReleaseDir,
                    "-L", targetDebugDir,
                    "-llarksync_ffi"
                ])
            ]
        ),

        // 3. 类 Typora 所见即所得 Markdown 引擎与主题渲染库
        .target(
            name: "TTMarkdownKit",
            dependencies: [.product(name: "TTZipPluginKit", package: "TTZipPluginKit")],
            path: "apple/Sources/TTMarkdownKit",
            resources: [
                .process("Resources")
            ],
            swiftSettings: swiftSettings
        ),
        
        // 4. LarkSync 飞书知识库原生 UI 组件 (米勒列 / 检查器 / 编辑器)
        .target(
            name: "LarkSyncUI",
            dependencies: [.product(name: "TTZipPluginKit", package: "TTZipPluginKit"), "TTMarkdownKit", "LarkSyncCore"],
            path: "apple/Sources/LarkSyncUI",
            swiftSettings: swiftSettings
        ),
        
        // 5. LarkSync 官方标杆插件入口
        .target(
            name: "LarkSyncPlugin",
            dependencies: [.product(name: "TTZipPluginKit", package: "TTZipPluginKit"), "TTMarkdownKit", "LarkSyncCore", "LarkSyncUI"],
            path: "apple/Sources/LarkSyncPlugin",
            swiftSettings: swiftSettings,
            linkerSettings: [
                .unsafeFlags([
                    "-Xlinker", "-rpath", "-Xlinker", "@loader_path/../Frameworks",
                    "-Xlinker", "-rpath", "-Xlinker", "@executable_path/../Frameworks"
                ])
            ]
        ),
        
        // 6. 单元测试套件
        .testTarget(
            name: "TTZipPluginKitTests",
            dependencies: [.product(name: "TTZipPluginKit", package: "TTZipPluginKit"), "TTMarkdownKit"],
            path: "apple/Tests/TTZipPluginKitTests",
            swiftSettings: swiftSettings
        )
    ]
)
