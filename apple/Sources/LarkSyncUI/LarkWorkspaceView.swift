// SPDX-License-Identifier: BSD-3-Clause OR Apache-2.0
//
// Copyright (c) 2026 Witt Kung <witt.w.kung@gmail.com>
// All rights reserved.
//
// TTZip: High-performance native archiving and compression engine.

import SwiftUI
import TTMarkdownKit
import LarkSyncCore
import TTZipPluginKit

public struct LarkWorkspaceView: View {
    @State private var store: LarkSyncStore
    @State private var showConfigSheet: Bool = false
    @State private var showGuideSheet: Bool = false
    
    public init(store: LarkSyncStore? = nil) {
        self._store = State(initialValue: store ?? LarkSyncStore())
    }
    
    public var body: some View {
        Group {
            if !store.isConfigured {
                LarkOnboardingHeroView(store: store, showGuideSheet: $showGuideSheet)
            } else {
                mainWorkspaceContent
            }
        }
        .task {
            await store.loadCredentialsAndInitialize()
        }
        .onChange(of: store.selectedNodeToken) { _, newToken in
            if let token = newToken {
                Task {
                    await store.loadDocument(for: token)
                }
            }
        }
        .sheet(isPresented: $showConfigSheet) {
            LarkConfigSheet(store: store, isPresented: $showConfigSheet, showGuideSheet: $showGuideSheet)
        }
        .sheet(isPresented: $showGuideSheet) {
            LarkSetupGuideSheetView(isPresented: $showGuideSheet)
        }
    }
    
    private var mainWorkspaceContent: some View {
        VStack(spacing: 0) {
            // 1. WSJ 52pt header bar with Kintsugi gold accent line
            headerView
            
            // 2. Selective subtree sync scope banner
            subtreeScopeBanner
            
            // 3. Three-column Miller Columns workspace
            HSplitView {
                // Column 1: Wiki spaces list
                LarkSpacesColumnView(store: store, showConfigSheet: $showConfigSheet)
                    .frame(minWidth: 200, idealWidth: 220, maxWidth: 280)
                
                // Column 2: Wiki topological directory tree
                LarkWikiTreeColumnView(store: store)
                    .frame(minWidth: 240, idealWidth: 280, maxWidth: 380)
                
                // Column 3: Typora-like WYSIWYG editor or welcome state
                LarkEditorColumnView(store: store)
                    .frame(minWidth: 420, maxWidth: .infinity)
            }
            
            // 4. Bottom sync status bar with progress indicator
            bottomStatusBar
        }
    }
    
    // MARK: - Header Bar
    private var headerView: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 1) {
                    Text("FEISHU WIKI WORKSPACE")
                        .font(.system(size: 9, weight: .bold, design: .serif))
                        .tracking(2)
                        .foregroundStyle(TTZipTheme.kintsugiGold)
                    Text("飞书知识库增量工作区")
                        .font(.system(size: 16, weight: .bold, design: .serif))
                }
                
                Spacer()
                
                // Refresh spaces button
                Button(action: {
                    Task { await store.refreshSpaces() }
                }) {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 12, weight: .semibold))
                }
                .buttonStyle(.plain)
                .help("Refresh spaces list")
                .disabled(store.isSyncing || !store.isConfigured)
                
                // Credentials settings button
                Button(action: {
                    showConfigSheet = true
                }) {
                    HStack(spacing: 4) {
                        Image(systemName: "gearshape.fill")
                        Text("Credentials")
                            .font(.system(size: 11, weight: .medium))
                    }
                }
                .buttonStyle(.plain)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Color.primary.opacity(0.06))
                .clipShape(RoundedRectangle(cornerRadius: 5, style: .continuous))
                
                // Full space / selective subtree incremental sync button
                Button(action: {
                    if !store.isConfigured {
                        showConfigSheet = true
                    } else {
                        Task { await store.triggerIncrementalSync() }
                    }
                }) {
                    HStack(spacing: 6) {
                        Image(systemName: store.isSyncing ? "arrow.triangle.2.circlepath" : "arrow.triangle.2.circlepath.circle.fill")
                            .rotationEffect(.degrees(store.isSyncing ? 360 : 0))
                            .animation(store.isSyncing ? .linear(duration: 1).repeatForever(autoreverses: false) : .default, value: store.isSyncing)
                        Text(store.isSyncing ? "Syncing..." : (store.syncSubtreeTitle == nil ? "Incremental Sync" : "Sync Subtree"))
                            .font(.system(size: 12, weight: .medium))
                    }
                }
                .buttonStyle(.borderedProminent)
                .tint(TTZipTheme.kintsugiGold)
                .disabled(store.isSyncing)
            }
            .padding(.horizontal, 20)
            .frame(height: 52)
            
            Rectangle()
                .fill(TTZipTheme.kintsugiGold)
                .frame(height: 1.5)
        }
    }
    
    // MARK: - Subtree Scope Banner
    @ViewBuilder
    private var subtreeScopeBanner: some View {
        if let title = store.syncSubtreeTitle {
            HStack(spacing: 8) {
                Image(systemName: "folder.badge.gearshape")
                    .foregroundStyle(Color(red: 0.16, green: 0.50, blue: 0.36))
                Text("Sync scope restricted to: ")
                    .font(.system(size: 11, weight: .medium))
                Text(title)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(TTZipTheme.kintsugiGold)
                
                Spacer()
                
                Button("Reset to Full Sync") {
                    store.resetSyncScopeToFull()
                }
                .font(.system(size: 10, weight: .semibold))
                .buttonStyle(.plain)
                .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 6)
            .background(Color(red: 0.16, green: 0.50, blue: 0.36).opacity(0.08))
            .overlay(
                Rectangle()
                    .frame(height: 0.5)
                    .foregroundStyle(Color(red: 0.16, green: 0.50, blue: 0.36).opacity(0.3)),
                alignment: .bottom
            )
        }
    }
    
    // MARK: - Status Bar
    private var bottomStatusBar: some View {
        HStack(spacing: 12) {
            Circle()
                .fill(store.isSyncing ? Color.orange : (store.isConfigured ? Color(red: 0.16, green: 0.50, blue: 0.36) : Color.gray))
                .frame(width: 8, height: 8)
            
            Text(store.statusMessage)
                .font(.system(size: 11))
                .foregroundStyle(.secondary)
            
            if store.isSyncing {
                ProgressView(value: store.syncProgress)
                    .frame(width: 120)
            }
            
            Spacer()
            
            if let last = store.lastSyncTime {
                Text("Last sync: \(last.formatted(date: .omitted, time: .standard))")
                    .font(.system(size: 10, design: .monospaced))
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(.horizontal, 16)
        .frame(height: 28)
        .background(Color.primary.opacity(0.03))
    }
}
