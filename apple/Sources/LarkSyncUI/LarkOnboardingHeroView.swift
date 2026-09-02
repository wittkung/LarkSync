// SPDX-License-Identifier: BSD-3-Clause OR Apache-2.0
//
// Copyright (c) 2026 Witt Kung <witt.w.kung@gmail.com>
// All rights reserved.
//
// TTZip: High-performance native archiving and compression engine.

import SwiftUI
import TTMarkdownKit

/// Welcome onboarding hero view for unconfigured state.
public struct LarkOnboardingHeroView: View {
    @Bindable var store: LarkSyncStore
    @Binding var showGuideSheet: Bool
    
    @State private var inputAppId: String = ""
    @State private var inputAppSecret: String = ""
    
    public init(store: LarkSyncStore, showGuideSheet: Binding<Bool>) {
        self.store = store
        self._showGuideSheet = showGuideSheet
    }
    
    public var body: some View {
        VStack(spacing: 24) {
            Spacer()
            
            VStack(spacing: 12) {
                Image(systemName: "doc.text.below.ecg.fill")
                    .font(.system(size: 48, weight: .light))
                    .foregroundStyle(TTZipTheme.kintsugiGold)
                
                Text("LarkSync Setup Guide")
                    .font(.system(size: 22, weight: .bold, design: .serif))
                
                Text("Connect to Feishu Open Platform to enable block-level bidirectional sync and immersive Markdown editing.")
                    .font(.system(size: 13))
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 420)
            }
            
            VStack(spacing: 16) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("App ID:")
                        .font(.system(size: 12, weight: .semibold))
                    TextField("e.g. cli_a1b2c3d4e5", text: $inputAppId)
                        .textFieldStyle(.roundedBorder)
                }
                
                VStack(alignment: .leading, spacing: 6) {
                    Text("App Secret:")
                        .font(.system(size: 12, weight: .semibold))
                    SecureField("••••••••••••••••••••••••", text: $inputAppSecret)
                        .textFieldStyle(.roundedBorder)
                }
                
                HStack(spacing: 10) {
                    Button(action: {
                        showGuideSheet = true
                    }) {
                        HStack(spacing: 5) {
                            Image(systemName: "book.pages.fill")
                                .font(.system(size: 11))
                            Text("📖 Setup Guide")
                                .font(.system(size: 11, weight: .medium))
                        }
                        .foregroundStyle(TTZipTheme.kintsugiGold)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(TTZipTheme.kintsugiGold.opacity(0.08))
                        .clipShape(Capsule())
                        .overlay(
                            Capsule()
                                .stroke(TTZipTheme.kintsugiGold, lineWidth: 1)
                        )
                    }
                    .buttonStyle(.plain)
                    .help("View Feishu setup guide and permissions tutorial")
                    
                    Spacer()
                    
                    Button("Connect & Initialize") {
                        Task {
                            try? await store.saveCredentials(appId: inputAppId, appSecret: inputAppSecret)
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(TTZipTheme.kintsugiGold)
                    .disabled(inputAppId.isEmpty || inputAppSecret.isEmpty)
                }
            }
            .padding(24)
            .frame(width: 440)
            .background(Color.primary.opacity(0.03))
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(Color.primary.opacity(0.08), lineWidth: 0.8)
            )
            
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.primary.opacity(0.01))
    }
}
