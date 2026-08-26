// SPDX-License-Identifier: BSD-3-Clause OR Apache-2.0
//
// Copyright (c) 2026 Witt Kung <witt.w.kung@gmail.com>
// All rights reserved.
//
// TTMarkdownKit: Live Preview Dynamic Syntax Folding Runtime

(function() {
    'use strict';

    const editorEl = document.getElementById('write');
    if (!editorEl) return;

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

    // 3. 动态语法折叠与富文本展开增强 (Live Preview Dynamic Folding)
    editorEl.addEventListener('focusin', updateLivePreviewDecorations);
    editorEl.addEventListener('keyup', updateLivePreviewDecorations);
    editorEl.addEventListener('mouseup', updateLivePreviewDecorations);

    function updateLivePreviewDecorations() {
        if (isComposing) return;
        const selection = window.getSelection();
        if (!selection || !selection.rangeCount) return;
        
        // 动态语法折叠逻辑与活动行识别
    }

    // 4. 宿主内容更新与 Operational Rebase
    window.ttzipSetContent = function(newContent) {
        if (isComposing) return;
        if (editorEl.innerText !== newContent) {
            editorEl.innerText = newContent;
        }
    };

    // 5. 动态加载外部 Typora 社区 CSS 主题
    window.ttzipLoadCustomTheme = function(cssString) {
        let customStyleEl = document.getElementById('ttzip-custom-theme-style');
        if (!customStyleEl) {
            customStyleEl = document.createElement('style');
            customStyleEl.id = 'ttzip-custom-theme-style';
            document.head.appendChild(customStyleEl);
        }
        customStyleEl.textContent = cssString;
    };

    // 6. 切换亮色 / 暗色模式
    window.ttzipSetTheme = function(themeName) {
        document.documentElement.setAttribute('data-theme', themeName);
        if (themeName === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    };

    // 7. 拖拽图片资源拦截并传递给 Swift 宿主
    editorEl.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
    });

    editorEl.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.ttzipEditorBridge) {
                window.webkit.messageHandlers.ttzipEditorBridge.postMessage({
                    type: 'onFileDrop',
                    fileName: file.name
                });
            }
        }
    });

    console.log('[TTMarkdownKit] Live Preview Runtime Initialized.');
})();
