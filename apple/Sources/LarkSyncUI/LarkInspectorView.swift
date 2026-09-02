// SPDX-License-Identifier: BSD-3-Clause OR Apache-2.0
//
// Copyright (c) 2026 Witt Kung <witt.w.kung@gmail.com>
// All rights reserved.
//
// TTZip: High-performance native archiving and compression engine.

import SwiftUI
import TTZipPluginKit
import TTMarkdownKit

public struct LarkInspectorView: View {
    public let docTitle: String
    public let revision: Int
    public let localPath: String
    
    public init(docTitle: String = "01-Architecture-Overview.md", revision: Int = 42, localPath: String = "wiki/01-Architecture-Overview.md") {
        self.docTitle = docTitle
        self.revision = revision
        self.localPath = localPath
    }
    
    public var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("PRO INSPECTOR")
                .font(.system(size: 9, weight: .bold, design: .serif))
                .tracking(2)
                .foregroundStyle(TTZipTheme.kintsugiGold)
            
            VStack(alignment: .leading, spacing: 8) {
                Text(docTitle)
                    .font(TTZipTheme.Typography.title)
                
                HStack {
                    Text("Revision:")
                        .font(TTZipTheme.Typography.caption)
                        .foregroundStyle(.secondary)
                    Text("r\(revision)")
                        .font(TTZipTheme.Typography.mono)
                        .foregroundStyle(TTZipTheme.bambooGreen)
                }
                
                HStack {
                    Text("Local Path:")
                        .font(TTZipTheme.Typography.caption)
                        .foregroundStyle(.secondary)
                    Text(localPath)
                        .font(TTZipTheme.Typography.caption)
                        .lineLimit(1)
                }
            }
            .padding(12)
            .ttzipLiquidGlass()
            
            Spacer()
        }
        .padding(14)
        .frame(width: TTZipTheme.Layout.rightPanelDefaultWidth)
    }
}
