// SPDX-License-Identifier: BSD-3-Clause OR Apache-2.0
//
// Copyright (c) 2026 Witt Kung <witt.w.kung@gmail.com>
// All rights reserved.
//
// TTZip: High-performance native archiving and compression engine.

import Foundation
import WebKit
import AppKit

@MainActor
public final class WebKitExportRenderer: NSObject, WKNavigationDelegate {
    private var webView: WKWebView?
    private var loadContinuation: CheckedContinuation<Void, Error>?
    
    public override init() {
        super.init()
    }
    
    private func setupWebView() {
        let configuration = WKWebViewConfiguration()
        let webView = WKWebView(frame: CGRect(x: 0, y: 0, width: 860, height: 1200), configuration: configuration)
        webView.navigationDelegate = self
        self.webView = webView
    }
    
    public func loadHTML(htmlContent: String) async throws {
        setupWebView()
        guard let webView = self.webView else { throw CocoaError(.coderInvalidValue) }
        
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            self.loadContinuation = continuation
            webView.loadHTMLString(htmlContent, baseURL: nil)
        }
        
        _ = try? await webView.evaluateJavaScript("document.fonts.ready.then(() => true);")
    }
    
    // MARK: - WKNavigationDelegate
    public func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        loadContinuation?.resume(returning: ())
        loadContinuation = nil
    }
    
    public func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        loadContinuation?.resume(throwing: error)
        loadContinuation = nil
    }
    
    /// Exports HTML document as PDF binary data.
    public func exportPDF() async throws -> Data {
        guard let webView = self.webView else { throw CocoaError(.coderInvalidValue) }
        let pdfConfiguration = WKPDFConfiguration()
        return try await webView.pdf(configuration: pdfConfiguration)
    }
    
    /// Exports HTML document as full-length snapshot image (Retina 2x).
    public func exportFullLengthImage(scale: CGFloat = 2.0) async throws -> NSImage {
        guard let webView = self.webView else { throw CocoaError(.coderInvalidValue) }
        
        let heightResult = try await webView.evaluateJavaScript("document.documentElement.scrollHeight || document.body.scrollHeight")
        let totalHeight = (heightResult as? CGFloat) ?? 1200.0
        
        webView.frame = CGRect(x: 0, y: 0, width: 860, height: totalHeight)
        
        let snapshotConfig = WKSnapshotConfiguration()
        snapshotConfig.snapshotWidth = NSNumber(value: Double(860 * scale))
        
        return try await webView.takeSnapshot(configuration: snapshotConfig)
    }
}
