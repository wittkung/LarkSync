// SPDX-License-Identifier: BSD-3-Clause OR Apache-2.0
//
// Copyright (c) 2026 Witt Kung <witt.w.kung@gmail.com>
// All rights reserved.
//
// TTMarkdownKit Live Preview WYSIWYG Runtime Engine

(function() {
    'use strict';

    const editorEl = document.getElementById('write');
    let isComposing = false;
    let debounceTimer = null;

    // 1. 中文输入法 (IME) 组合态保护锁
    editorEl.addEventListener('compositionstart', () => {
        isComposing = true;
    });

    editorEl.addEventListener('compositionend', () => {
        isComposing = false;
        triggerDocChange();
    });

    // 2. 键入与内容变更监听 (150ms 弹性防抖)
    editorEl.addEventListener('input', () => {
        if (!isComposing) {
            triggerDocChange();
        }
    });

    function triggerDocChange() {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const content = editorEl.innerText;
            if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.ttzipEditorBridge) {
                window.webkit.messageHandlers.ttzipEditorBridge.postMessage({
                    type: 'onDocChange',
                    content: content
                });
            }
        }, 150);
    }

    // 3. Swift 宿主向前端注入新内容 (Operational Rebase & Selection Preservation)
    window.ttzipSetContent = function(newContent) {
        if (isComposing) return; // 输入法组合中严禁强制刷新 DOM
        if (editorEl.innerText !== newContent) {
            editorEl.innerText = newContent;
        }
    };

    // 4. 切换暗色 / 亮色主题
    window.ttzipSetTheme = function(themeName) {
        document.documentElement.setAttribute('data-theme', themeName);
        if (themeName === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    };

    console.log('[TTMarkdownKit] Live Preview WYSIWYG Engine Initialized.');
})();
