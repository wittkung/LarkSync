// SPDX-License-Identifier: BSD-3-Clause OR Apache-2.0
//
// Copyright (c) 2026 Witt Kung <witt.w.kung@gmail.com>
// All rights reserved.
//
// TTZip: High-performance native archiving and compression engine.

import SwiftUI
import WebKit

/// Typora-like WYSIWYG Markdown editor component.
public struct TTZipEditorView: NSViewRepresentable {
    @Binding public var text: String
    public var isEditable: Bool
    public var customThemeCSS: String?
    public var baseDirectoryURL: URL?
    public var onDocChange: (@Sendable (String) -> Void)?
    
    @Environment(\.colorScheme) private var colorScheme
    
    public init(
        text: Binding<String>,
        isEditable: Bool = true,
        customThemeCSS: String? = nil,
        baseDirectoryURL: URL? = nil,
        onDocChange: (@Sendable (String) -> Void)? = nil
    ) {
        self._text = text
        self.isEditable = isEditable
        self.customThemeCSS = customThemeCSS
        self.baseDirectoryURL = baseDirectoryURL
        self.onDocChange = onDocChange
    }
    
    public func makeNSView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        let controller = WKUserContentController()
        
        controller.add(context.coordinator, name: "ttzipEditorBridge")
        config.userContentController = controller
        
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.underPageBackgroundColor = .clear
        webView.navigationDelegate = context.coordinator
        
        let htmlTemplate = generateEditorHTML(initialMarkdown: text, isEditable: isEditable)
        webView.loadHTMLString(htmlTemplate, baseURL: baseDirectoryURL)
        
        return webView
    }
    
    public func updateNSView(_ nsView: WKWebView, context: Context) {
        // 1. Bidirectional content sync
        if context.coordinator.cachedText != text {
            context.coordinator.cachedText = text
            nsView.callAsyncJavaScript(
                "if (window.ttzipSetContent) { window.ttzipSetContent(newContent); }",
                arguments: ["newContent": text],
                in: nil,
                in: .page,
                completionHandler: nil
            )
        }
        
        // 2. Responsive theme mode (Dark / Light)
        let themeName = colorScheme == .dark ? "dark" : "light"
        nsView.callAsyncJavaScript(
            "if (window.ttzipSetTheme) { window.ttzipSetTheme(themeName); }",
            arguments: ["themeName": themeName],
            in: nil,
            in: .page,
            completionHandler: nil
        )
        
        // 3. Dynamic custom CSS theme injection
        if let css = customThemeCSS, !css.isEmpty {
            nsView.callAsyncJavaScript(
                "if (window.ttzipLoadCustomTheme) { window.ttzipLoadCustomTheme(customCSS); }",
                arguments: ["customCSS": css],
                in: nil,
                in: .page,
                completionHandler: nil
            )
        }
    }
    
    public func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }
    
    public final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
        var parent: TTZipEditorView
        var cachedText: String = ""
        
        init(_ parent: TTZipEditorView) {
            self.parent = parent
            self.cachedText = parent.text
        }
        
        public func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "ttzipEditorBridge",
                  let body = message.body as? [String: Any],
                  let type = body["type"] as? String else { return }
            
            if type == "onDocChange", let newContent = body["content"] as? String {
                self.cachedText = newContent
                Task { @MainActor in
                    self.parent.text = newContent
                    self.parent.onDocChange?(newContent)
                }
            }
        }
    }
    
    private func generateEditorHTML(initialMarkdown: String, isEditable: Bool) -> String {
        let cssURL = Bundle.module.url(forResource: "theme-tokens", withExtension: "css")
        let cssContent = (try? String(contentsOf: cssURL!)) ?? ""
        
        let bundleURL = Bundle.module.url(forResource: "editor.bundle", withExtension: "js")
        let bundleContent = (try? String(contentsOf: bundleURL!)) ?? ""
        
        let escapedMarkdown = initialMarkdown
            .replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
        
        return """
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                \(cssContent)
            </style>
        </head>
        <body>
            <div id="write" contenteditable="\(isEditable ? "true" : "false")">
                \(escapedMarkdown)
            </div>
            <script>
                \(bundleContent)
            </script>
        </body>
        </html>
        """
    }
}
