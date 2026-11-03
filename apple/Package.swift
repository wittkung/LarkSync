// swift-tools-version: 6.0
// Copyright 2026 MetastudyLine. All rights reserved.
// Proprietary and confidential.

import PackageDescription

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
        .library(name: "LarkSyncUI", targets: ["LarkSyncUI"])
    ],
    dependencies: [],
    targets: [
        // 1. Mozilla UniFFI C-ABI Modulemap Target
        .target(
            name: "larksync_ffiFFI",
            path: "Sources/larksync_ffiFFI",
            publicHeadersPath: "include"
        ),

        // 2. LarkSyncCore (Mozilla UniFFI 生成的强类型 Swift 接口)
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

        // 3. 类 Typora 所见即所得 Markdown 引擎与主题渲染库
        .target(
            name: "TTMarkdownKit",
            path: "Sources/TTMarkdownKit",
            resources: [
                .process("Resources")
            ],
            swiftSettings: swiftSettings
        ),
        
        // 4. LarkSync 飞书知识库原生 UI 组件 (米勒列 / 检查器 / 编辑器)
        .target(
            name: "LarkSyncUI",
            dependencies: [
                "TTMarkdownKit",
                "LarkSyncCore"
            ],
            path: "Sources/LarkSyncUI",
            swiftSettings: swiftSettings
        ),
        
        // 5. 单元测试套件
        .testTarget(
            name: "TTMarkdownKitTests",
            dependencies: [
                "TTMarkdownKit"
            ],
            path: "Tests/TTMarkdownKitTests",
            swiftSettings: swiftSettings
        )
    ]
)
