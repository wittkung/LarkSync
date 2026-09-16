// SPDX-License-Identifier: MIT
//
// LarkSyncUI: Pro Inspector View for Document Metadata and Diff status.

import SwiftUI
import TTZipPluginKit
import TTMarkdownKit

public struct LarkInspectorView: View {
    public let docTitle: String
    public let revision: Int
    public let localPath: String
    
    public init(docTitle: String = "01-系统全景架构.md", revision: Int = 42, localPath: String = "wiki/01-系统全景架构.md") {
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
                    Text("修订代数:")
                        .font(TTZipTheme.Typography.caption)
                        .foregroundStyle(.secondary)
                    Text("r\(revision)")
                        .font(TTZipTheme.Typography.mono)
                        .foregroundStyle(TTZipTheme.bambooGreen)
                }
                
                HStack {
                    Text("本地映射:")
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
