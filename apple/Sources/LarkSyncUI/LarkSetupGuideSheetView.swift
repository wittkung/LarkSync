// SPDX-License-Identifier: BSD-3-Clause OR Apache-2.0
//
// Copyright (c) 2026 Witt Kung <witt.w.kung@gmail.com>
// All rights reserved.

import AppKit
import SwiftUI
import TTMarkdownKit

/// Interactive Feishu/Lark Open Platform setup guide sheet view conforming to TTZip UI design specifications.
@MainActor
public struct LarkSetupGuideSheetView: View {
    @Binding private var isPresented: Bool
    @Environment(\.dismiss) private var dismiss
    
    @State private var copiedPermission: String?
    @State private var copiedAllPermissions: Bool = false
    
    // MARK: - Core Scope Definitions
    private struct PermissionScope: Identifiable {
        let id: String
        let scope: String
        let name: String
        let description: String
        let isCritical: Bool
    }
    
    private let scopes: [PermissionScope] = [
        PermissionScope(
            id: "wiki",
            scope: "wiki:wiki:readonly",
            name: "知识库只读权限",
            description: "用于读取飞书知识库空间列表与目录拓扑树节点结构",
            isCritical: true
        ),
        PermissionScope(
            id: "docx",
            scope: "docx:document:readonly",
            name: "DocX 文档只读权限",
            description: "用于获取 DocX 块级结构并高保真转换为 Markdown",
            isCritical: true
        ),
        PermissionScope(
            id: "drive_space",
            scope: "drive:drive:readonly",
            name: "云空间只读权限",
            description: "用于获取云盘空间根路径及空间挂载点元数据",
            isCritical: false
        ),
        PermissionScope(
            id: "drive_file",
            scope: "drive:file:readonly",
            name: "云文档与素材只读权限",
            description: "用于下载文档内嵌入的高清图片与二进制素材附件",
            isCritical: false
        )
    ]
    
    public init(isPresented: Binding<Bool>? = nil) {
        if let binding = isPresented {
            self._isPresented = binding
        } else {
            self._isPresented = .constant(true)
        }
    }
    
    public var body: some View {
        VStack(spacing: 0) {
            // 1. WSJ Editorial 52pt Header Bar with Kintsugi Gold Line
            headerBar
            
            // 2. Scrollable 5-Step Tutorial Content Area
            ScrollView(.vertical, showsIndicators: true) {
                VStack(spacing: 18) {
                    step1CreateAppView
                    step2CredentialsView
                    step3PermissionsView
                    step4PublishView
                    step5SpaceAuthAndIdView
                }
                .padding(.horizontal, 24)
                .padding(.vertical, 20)
            }
            
            // 3. Persistent Bottom Sticky Action Bar with Bamboo Green Capsule Button
            bottomActionBar
        }
        .frame(minWidth: 640, idealWidth: 680, maxWidth: 740, minHeight: 600, idealHeight: 680, maxHeight: 780)
        .background(TTZipTheme.washiPaper.opacity(0.15))
    }
    
    // MARK: - 1. WSJ Editorial Header Bar (52pt)
    private var headerBar: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("FEISHU OPEN PLATFORM SETUP GUIDE")
                        .font(.system(size: 9, weight: .bold, design: .serif))
                        .tracking(2)
                        .foregroundStyle(TTZipTheme.kintsugiGold)
                    
                    Text("飞书开放平台配置教学指引")
                        .font(.system(size: 16, weight: .bold, design: .serif))
                        .foregroundStyle(.primary)
                }
                
                Spacer()
                
                // Status Badge
                HStack(spacing: 5) {
                    Image(systemName: "sparkles")
                        .font(.system(size: 10))
                        .foregroundStyle(TTZipTheme.bambooGreen)
                    Text("5 步快速开通")
                        .font(.system(size: 11, weight: .bold, design: .monospaced))
                        .foregroundStyle(TTZipTheme.bambooGreen)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .background(TTZipTheme.bambooGreen.opacity(0.12))
                .clipShape(Capsule())
            }
            .padding(.horizontal, 24)
            .frame(height: 52)
            
            Rectangle()
                .fill(TTZipTheme.kintsugiGold)
                .frame(height: 1.5)
        }
        .background(Color.primary.opacity(0.02))
    }
    
    // MARK: - Step 1: Create Enterprise Custom App
    private var step1CreateAppView: some View {
        VStack(alignment: .leading, spacing: 12) {
            stepHeader(number: "01", title: "创建飞书企业自建应用", icon: "app.badge.checkmark")
            
            Text("前往飞书开放平台开发者控制台，使用企业管理员或开发者账号登录，点击「创建企业自建应用」，填写应用基本信息（如应用名称设为 “LarkSync”）。")
                .font(.system(size: 12))
                .foregroundStyle(.secondary)
                .lineSpacing(3)
            
            HStack {
                Button(action: openFeishuOpenPlatform) {
                    HStack(spacing: 6) {
                        Image(systemName: "arrow.up.right.square.fill")
                            .font(.system(size: 11))
                        Text("直达飞书开放平台开发者后台")
                            .font(.system(size: 12, weight: .semibold))
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 7)
                    .background(TTZipTheme.kintsugiGold.opacity(0.15))
                    .foregroundStyle(TTZipTheme.kintsugiGold)
                    .clipShape(Capsule())
                    .overlay(
                        Capsule()
                            .stroke(TTZipTheme.kintsugiGold, lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)
                
                Spacer()
            }
        }
        .padding(18)
        .ttzipLiquidGlass(cornerRadius: 14)
    }
    
    // MARK: - Step 2: Retrieve App Credentials
    private var step2CredentialsView: some View {
        VStack(alignment: .leading, spacing: 12) {
            stepHeader(number: "02", title: "获取开发者凭证 (App ID & Secret)", icon: "key.horizontal.fill")
            
            Text("进入刚创建的应用详情页，点击左侧导航栏的「凭证与基础信息」，即可查看并复制以下两项关键凭证：")
                .font(.system(size: 12))
                .foregroundStyle(.secondary)
                .lineSpacing(3)
            
            VStack(spacing: 8) {
                credentialFieldHint(
                    key: "App ID",
                    format: "以 cli_ 开头，如 cli_a1b2c3d4e5f6g7h8",
                    icon: "person.badge.key.fill"
                )
                credentialFieldHint(
                    key: "App Secret",
                    format: "32位随机字母与数字组合，具有最高管理权限",
                    icon: "lock.shield.fill"
                )
            }
            
            // Security Note Callout
            HStack(alignment: .top, spacing: 8) {
                Image(systemName: "shield.checkered")
                    .font(.system(size: 12))
                    .foregroundStyle(TTZipTheme.bambooGreen)
                    .padding(.top, 1)
                
                Text("安全说明：TTZip 原生端会将 App Secret 加密保存在 macOS Keychain 安全钥匙串中，所有网络请求均在本地与飞书 OpenAPI 建立安全信道，严禁提交凭证至公共代码仓库。")
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
            }
            .padding(10)
            .background(TTZipTheme.bambooGreen.opacity(0.06))
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        }
        .padding(18)
        .ttzipLiquidGlass(cornerRadius: 14)
    }
    
    // MARK: - Step 3: Configure 4 Core Scopes with Copy Interaction
    private var step3PermissionsView: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                stepHeader(number: "03", title: "开通 4 大只读核心权限", icon: "lock.open.trianglebadge.exclamationmark.fill")
                Spacer()
                
                // Copy All Button
                Button(action: copyAllScopes) {
                    HStack(spacing: 4) {
                        Image(systemName: copiedAllPermissions ? "checkmark" : "doc.on.doc.fill")
                            .font(.system(size: 10, weight: .bold))
                        Text(copiedAllPermissions ? "已全部复制" : "一键复制全部 4 项")
                            .font(.system(size: 11, weight: .semibold))
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(copiedAllPermissions ? TTZipTheme.bambooGreen.opacity(0.2) : TTZipTheme.kintsugiGold.opacity(0.12))
                    .foregroundStyle(copiedAllPermissions ? TTZipTheme.bambooGreen : TTZipTheme.kintsugiGold)
                    .clipShape(Capsule())
                    .overlay(
                        Capsule()
                            .stroke(copiedAllPermissions ? TTZipTheme.bambooGreen : TTZipTheme.kintsugiGold, lineWidth: 0.8)
                    )
                }
                .buttonStyle(.plain)
            }
            
            Text("进入「开发配置」->「权限管理」->「API 权限」，在搜索框中逐一搜索并开通以下 4 个只读 Scope（点击条目右侧按钮即可快速复制）：")
                .font(.system(size: 12))
                .foregroundStyle(.secondary)
                .lineSpacing(3)
            
            VStack(spacing: 8) {
                ForEach(scopes) { item in
                    permissionRow(item: item)
                }
            }
        }
        .padding(18)
        .ttzipLiquidGlass(cornerRadius: 14)
    }
    
    // MARK: - Step 4: Publish App Version
    private var step4PublishView: some View {
        VStack(alignment: .leading, spacing: 12) {
            stepHeader(number: "04", title: "创建并发布应用版本", icon: "paperplane.circle.fill")
            
            Text("开通权限后，必须发布版本才能使权限正式生效：")
                .font(.system(size: 12))
                .foregroundStyle(.secondary)
                .lineSpacing(3)
            
            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .top, spacing: 8) {
                    Text("1.")
                        .font(.system(size: 11, weight: .bold, design: .monospaced))
                        .foregroundStyle(TTZipTheme.kintsugiGold)
                    Text("点击左侧导航栏「应用发布」->「版本管理与发布」->「创建版本」。")
                        .font(.system(size: 11))
                        .foregroundStyle(.primary)
                }
                HStack(alignment: .top, spacing: 8) {
                    Text("2.")
                        .font(.system(size: 11, weight: .bold, design: .monospaced))
                        .foregroundStyle(TTZipTheme.kintsugiGold)
                    Text("输入应用版本号（例如 1.0.0）与更新说明，点击「申请发布」。")
                        .font(.system(size: 11))
                        .foregroundStyle(.primary)
                }
                HStack(alignment: .top, spacing: 8) {
                    Text("3.")
                        .font(.system(size: 11, weight: .bold, design: .monospaced))
                        .foregroundStyle(TTZipTheme.kintsugiGold)
                    Text("若企业开启了审批流，请通知企业租户管理员在飞书管理后台通过该应用版本审核。")
                        .font(.system(size: 11))
                        .foregroundStyle(.primary)
                }
            }
            .padding(12)
            .background(Color.primary.opacity(0.025))
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        }
        .padding(18)
        .ttzipLiquidGlass(cornerRadius: 14)
    }
    
    // MARK: - Step 5: Space Bot Authorization & Space ID Pitfall Guide
    private var step5SpaceAuthAndIdView: some View {
        VStack(alignment: .leading, spacing: 14) {
            stepHeader(number: "05", title: "知识库空间授权与 Space ID 提取 (避坑指南)", icon: "exclamationmark.triangle.fill")
            
            VStack(alignment: .leading, spacing: 10) {
                // Section A: Bot Authorization
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 6) {
                        Circle()
                            .fill(TTZipTheme.kintsugiGold)
                            .frame(width: 5, height: 5)
                        Text("第一步：将应用机器人添加至知识库空间")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(.primary)
                    }
                    
                    Text("打开目标飞书知识库 -> 点击右上角「...」更多菜单 -> 选择「空间设置」-> 点击「节点权限/机器人」->「添加应用/机器人」-> 搜索并选择刚才创建的应用并授权。")
                        .font(.system(size: 11))
                        .foregroundStyle(.secondary)
                        .lineSpacing(2)
                        .padding(.leading, 11)
                }
                
                // Section B: Space ID Extraction Guide
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 6) {
                        Circle()
                            .fill(TTZipTheme.kintsugiGold)
                            .frame(width: 5, height: 5)
                        Text("第二步：如何正确提取 Space ID (数字空间唯一标识)")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(.primary)
                    }
                    
                    Text("Space ID 必须从知识库空间首页或空间设置的浏览器 URL 中提取纯数字 ID：")
                        .font(.system(size: 11))
                        .foregroundStyle(.secondary)
                        .padding(.leading, 11)
                    
                    HStack(spacing: 6) {
                        Text("例如 URL:")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(.tertiary)
                        Text("https://example.feishu.cn/wiki/settings/space/")
                            .font(.system(size: 10, design: .monospaced))
                            .foregroundStyle(.secondary)
                        + Text("7201234567890123456")
                            .font(.system(size: 10, weight: .bold, design: .monospaced))
                            .foregroundStyle(TTZipTheme.kintsugiGold)
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(Color.primary.opacity(0.04))
                    .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                    .padding(.leading, 11)
                }
                
                // Section C: Pitfall warning
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: "xmark.octagon.fill")
                        .font(.system(size: 12))
                        .foregroundStyle(TTZipTheme.cinnabarRed)
                        .padding(.top, 1)
                    
                    VStack(alignment: .leading, spacing: 2) {
                        Text("常见避坑注意点：")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(TTZipTheme.cinnabarRed)
                        Text("1. 绝不要使用单篇文档的 Token (如 wikcnXXXXXX) 代替 Space ID。\n2. 若未将应用添加到空间机器人中，拉取知识库将直接抛出 131005 (Permission Denied) 鉴权错误。")
                            .font(.system(size: 10.5))
                            .foregroundStyle(.secondary)
                            .lineSpacing(2)
                    }
                }
                .padding(10)
                .background(TTZipTheme.cinnabarRed.opacity(0.06))
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            }
        }
        .padding(18)
        .ttzipLiquidGlass(cornerRadius: 14)
    }
    
    // MARK: - 3. Bottom Sticky Action Bar
    private var bottomActionBar: some View {
        VStack(spacing: 0) {
            Divider()
                .overlay(TTZipTheme.hairlineBorder)
            
            HStack {
                Text("配置完成后，请返回工作区输入 App ID 与 App Secret 开始增量同步。")
                    .font(.system(size: 11))
                    .foregroundStyle(.tertiary)
                
                Spacer()
                
                Button(action: {
                    isPresented = false
                    dismiss()
                }) {
                    HStack(spacing: 6) {
                        Image(systemName: "checkmark")
                            .font(.system(size: 11, weight: .bold))
                        Text("完成指引 (↵)")
                            .font(.system(size: 12, weight: .bold))
                    }
                    .padding(.horizontal, 22)
                    .padding(.vertical, 8)
                    .background(TTZipTheme.bambooGreen)
                    .foregroundStyle(Color.white)
                    .clipShape(Capsule())
                    .shadow(color: TTZipTheme.bambooGreen.opacity(0.3), radius: 4, x: 0, y: 2)
                }
                .buttonStyle(.plain)
                .keyboardShortcut(.defaultAction)
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 14)
            .background(Color.primary.opacity(0.02))
        }
    }
    
    // MARK: - Helper Views & Components
    private func stepHeader(number: String, title: String, icon: String) -> some View {
        HStack(spacing: 10) {
            HStack(spacing: 4) {
                Text("STEP")
                    .font(.system(size: 9, weight: .bold, design: .serif))
                    .tracking(1)
                Text(number)
                    .font(.system(size: 10, weight: .bold, design: .monospaced))
            }
            .foregroundStyle(TTZipTheme.kintsugiGold)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(TTZipTheme.kintsugiGold.opacity(0.12))
            .clipShape(Capsule())
            
            Image(systemName: icon)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(TTZipTheme.kintsugiGold)
            
            Text(title)
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(.primary)
        }
    }
    
    private func credentialFieldHint(key: String, format: String, icon: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 12))
                .foregroundStyle(TTZipTheme.kintsugiGold)
                .frame(width: 16)
            
            Text(key)
                .font(.system(size: 11, weight: .bold, design: .monospaced))
                .foregroundStyle(.primary)
                .frame(width: 85, alignment: .leading)
            
            Text(format)
                .font(.system(size: 11))
                .foregroundStyle(.secondary)
            
            Spacer()
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 7)
        .background(Color.primary.opacity(0.03))
        .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
    }
    
    private func permissionRow(item: PermissionScope) -> some View {
        let isCopied = copiedPermission == item.scope
        
        return HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(item.scope)
                        .font(.system(size: 11, weight: .bold, design: .monospaced))
                        .foregroundStyle(TTZipTheme.kintsugiGold)
                    
                    Text("• " + item.name)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(.primary)
                }
                
                Text(item.description)
                    .font(.system(size: 10.5))
                    .foregroundStyle(.secondary)
            }
            
            Spacer()
            
            Button(action: {
                copySingleScope(item.scope)
            }) {
                HStack(spacing: 4) {
                    Image(systemName: isCopied ? "checkmark" : "doc.on.doc")
                        .font(.system(size: 10))
                    Text(isCopied ? "已复制" : "复制")
                        .font(.system(size: 10.5, weight: .semibold))
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(isCopied ? TTZipTheme.bambooGreen.opacity(0.18) : Color.primary.opacity(0.05))
                .foregroundStyle(isCopied ? TTZipTheme.bambooGreen : .primary)
                .clipShape(Capsule())
                .overlay(
                    Capsule()
                        .stroke(isCopied ? TTZipTheme.bambooGreen : Color.primary.opacity(0.12), lineWidth: 0.8)
                )
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Color.primary.opacity(0.025))
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
    }
    
    // MARK: - Actions
    private func openFeishuOpenPlatform() {
        if let url = URL(string: "https://open.feishu.cn/app") {
            NSWorkspace.shared.open(url)
        }
    }
    
    private func copySingleScope(_ scope: String) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(scope, forType: .string)
        
        withAnimation(.easeInOut(duration: 0.2)) {
            copiedPermission = scope
        }
        
        Task {
            try? await Task.sleep(for: .seconds(1.5))
            if copiedPermission == scope {
                withAnimation(.easeInOut(duration: 0.2)) {
                    copiedPermission = nil
                }
            }
        }
    }
    
    private func copyAllScopes() {
        let allScopesString = scopes.map { $0.scope }.joined(separator: " ")
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(allScopesString, forType: .string)
        
        withAnimation(.easeInOut(duration: 0.2)) {
            copiedAllPermissions = true
        }
        
        Task {
            try? await Task.sleep(for: .seconds(2.0))
            withAnimation(.easeInOut(duration: 0.2)) {
                copiedAllPermissions = false
            }
        }
    }
}
