// Copyright 2026 MetastudyLine. All rights reserved.
// Proprietary and confidential.

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
