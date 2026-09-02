// SPDX-License-Identifier: BSD-3-Clause OR Apache-2.0
//
// Copyright (c) 2026 Witt Kung <witt.w.kung@gmail.com>
// All rights reserved.
//
// TTZip: High-performance native archiving and compression engine.

import SwiftUI
import TTMarkdownKit

/// Modal sheet for configuring Feishu OpenAPI credentials.
public struct LarkConfigSheet: View {
    @Bindable var store: LarkSyncStore
    @Binding var isPresented: Bool
    @Binding var showGuideSheet: Bool
    
    @State private var inputAppId: String = ""
    @State private var inputAppSecret: String = ""
    
    public init(store: LarkSyncStore, isPresented: Binding<Bool>, showGuideSheet: Binding<Bool>) {
        self.store = store
        self._isPresented = isPresented
        self._showGuideSheet = showGuideSheet
    }
    
    public var body: some View {
        VStack(spacing: 16) {
            HStack {
                Text("Configure Feishu OpenAPI Credentials")
                    .font(.system(size: 16, weight: .bold, design: .serif))
                Spacer()
                Button(action: {
                    showGuideSheet = true
                }) {
                    HStack(spacing: 4) {
                        Image(systemName: "book.pages.fill")
                            .font(.system(size: 10))
                        Text("📖 Setup Guide")
                            .font(.system(size: 11, weight: .medium))
                    }
                    .foregroundStyle(TTZipTheme.kintsugiGold)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(TTZipTheme.kintsugiGold.opacity(0.08))
                    .clipShape(Capsule())
                    .overlay(
                        Capsule()
                            .stroke(TTZipTheme.kintsugiGold, lineWidth: 0.8)
                    )
                }
                .buttonStyle(.plain)
                .help("View Feishu setup guide and permissions tutorial")
            }
            
            Text("Credentials are encrypted in macOS Keychain and accessed via tenant-scoped isolation.")
                .font(.system(size: 11))
                .foregroundStyle(.secondary)
            
            VStack(alignment: .leading, spacing: 6) {
                Text("App ID:")
                    .font(.system(size: 11, weight: .semibold))
                TextField("cli_xxxxxxxxxxxx", text: $inputAppId)
                    .textFieldStyle(.roundedBorder)
            }
            
            VStack(alignment: .leading, spacing: 6) {
                Text("App Secret:")
                    .font(.system(size: 11, weight: .semibold))
                SecureField("••••••••••••••••", text: $inputAppSecret)
                    .textFieldStyle(.roundedBorder)
            }
            
            HStack(spacing: 12) {
                Button("Cancel") {
                    isPresented = false
                }
                .buttonStyle(.plain)
                
                Spacer()
                
                Button("Save & Initialize") {
                    Task {
                        try? await store.saveCredentials(appId: inputAppId, appSecret: inputAppSecret)
                        isPresented = false
                    }
                }
                .buttonStyle(.borderedProminent)
                .tint(TTZipTheme.kintsugiGold)
                .disabled(inputAppId.isEmpty || inputAppSecret.isEmpty)
            }
            .padding(.top, 8)
        }
        .padding(24)
        .frame(width: 400)
        .task {
            let creds = await store.getCredentials()
            self.inputAppId = creds.appId
            self.inputAppSecret = creds.appSecret
        }
    }
}
