// SPDX-License-Identifier: BSD-3-Clause OR Apache-2.0
//
// Copyright (c) 2026 Witt Kung <witt.w.kung@gmail.com>
// All rights reserved.

#if !SWIFT_PACKAGE
import Foundation

private class BundleFinder {}

extension Foundation.Bundle {
    /// Non-SPM / Bazel fallback accessor for module resources.
    static let module: Bundle = {
        let bundleName = "TTMarkdownKit"
        let candidates = [
            Bundle.main.resourceURL,
            Bundle(for: BundleFinder.self).resourceURL,
            Bundle.main.bundleURL,
        ]
        for candidate in candidates {
            if let candidate = candidate {
                let subBundle = candidate.appendingPathComponent("\(bundleName).bundle")
                if let bundle = Bundle(url: subBundle) {
                    return bundle
                }
            }
        }
        return Bundle(for: BundleFinder.self)
    }()
}
#endif
