// SPDX-License-Identifier: BSD-3-Clause OR Apache-2.0
//
// Copyright (c) 2026 Witt Kung <witt.w.kung@gmail.com>
// All rights reserved.
//
// TTZip: High-performance native archiving and compression engine.

import SwiftUI
import LarkSyncCore
import TTMarkdownKit

/// Spaces list column view for LarkSync workspace.
public struct LarkSpacesColumnView: View {
    @Bindable var store: LarkSyncStore
    @Binding var showConfigSheet: Bool
    
    public init(store: LarkSyncStore, showConfigSheet: Binding<Bool>) {
        self.store = store
        self._showConfigSheet = showConfigSheet
    }
    
    public var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("WIKI SPACES")
                    .font(.system(size: 10, weight: .bold, design: .serif))
                    .tracking(1.5)
                    .foregroundStyle(.secondary)
                Spacer()
            }
            .padding(.horizontal, 12)
            .padding(.top, 10)
            .padding(.bottom, 6)
            
            if !store.isConfigured {
                VStack(spacing: 12) {
                    Image(systemName: "key.fill")
                        .font(.system(size: 26))
                        .foregroundStyle(TTZipTheme.kintsugiGold)
                    Text("Credentials Required")
                        .font(.system(size: 13, weight: .semibold))
                    Text("Configure App ID & Secret to connect Feishu Open Platform")
                        .font(.system(size: 11))
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                    
                    Button("Configure") {
                        showConfigSheet = true
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(TTZipTheme.kintsugiGold)
                    .font(.system(size: 11, weight: .medium))
                }
                .padding(16)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if store.spaces.isEmpty {
                VStack(spacing: 10) {
                    ProgressView()
                        .scaleEffect(0.8)
                    Text("Loading Wiki spaces...")
                        .font(.system(size: 11))
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 4) {
                        ForEach(store.spaces, id: \.spaceId) { (space: WikiSpaceItem) in
                            let isSelected = store.selectedSpaceId == space.spaceId
                            Button(action: {
                                store.selectedSpaceId = space.spaceId
                                store.resetSyncScopeToFull()
                                Task { await store.refreshNodes(spaceId: space.spaceId) }
                            }) {
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(space.name)
                                        .font(.system(size: 13, weight: isSelected ? .semibold : .medium))
                                        .foregroundStyle(isSelected ? TTZipTheme.kintsugiGold : .primary)
                                    Text(space.description.isEmpty ? "Feishu Wiki Space" : space.description)
                                        .font(.system(size: 11))
                                        .foregroundStyle(.secondary)
                                        .lineLimit(1)
                                }
                                .padding(.horizontal, 10)
                                .padding(.vertical, 6)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(isSelected ? Color.primary.opacity(0.08) : Color.clear)
                                .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(8)
                }
            }
        }
        .background(Color.primary.opacity(0.02))
    }
}
