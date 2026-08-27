import React, { useState, useEffect } from 'react';
import { vscode } from '../utils/vscode';

interface SetupGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const REQUIRED_PERMISSIONS = [
  {
    scope: 'wiki:wiki:readonly',
    title: '知识库阅读权限 (Knowledge Base Read)',
    desc: '用于遍历知识库目录树与节点信息 (Query wiki spaces and node hierarchies)',
  },
  {
    scope: 'docx:document:readonly',
    title: '新版文档阅读权限 (DocX Read)',
    desc: '用于拉取 DocX 页面块级结构与富文本内容 (Fetch document blocks & rich-text body)',
  },
  {
    scope: 'drive:drive:readonly',
    title: '云空间查看权限 (Drive Meta Read)',
    desc: '用于增量元数据比对与更新时间戳检测 (Compare file metadata & modified timestamps)',
  },
  {
    scope: 'drive:file:readonly',
    title: '文件与附件下载权限 (File & Media Download)',
    desc: '用于下载文档中内嵌的图片、插图与多媒体资源 (Download embedded images & attachments)',
  },
];

const FAQ_ITEMS = [
  {
    question: '出现 403 Forbidden 权限不足报错怎么办？',
    answer:
      '请重点排查两点：1. 是否已将自建应用（机器人）添加至目标知识库的「成员与权限」列表中；2. 开通权限后是否在开放平台创建了新版本并点击「发布」，未发布版本权限不会生效。',
  },
  {
    question: '出现 429 Too Many Requests 接口请求限流？',
    answer:
      '飞书开放平台针对各 API 有 QPS 频率限制。LarkSync 内部已集成 p-limit 节流队列与指数退避重试机制，通常无需人工干预；若同步数据量极大，插件会自动分批稳健拉取。',
  },
  {
    question: '同步下来的 Markdown 中图片显示破损或无法下载？',
    answer:
      '请确认已开启 drive:file:readonly 与 drive:drive:readonly 权限，且包含该权限的应用版本已成功发布上线。若此前未开启，更新发布后重新执行同步即可自动重试下载。',
  },
  {
    question: '如何区分 Space ID 与 Node Token / URL？',
    answer:
      'Space ID 是整个知识库的唯一数字标识（如 7183020484...），可在知识库网页版 URL 或知识库设置中获取；Node Token / Document Token 则是单个文档或页面的标识符。插件配置需填入 Space ID。',
  },
];

export const SetupGuideModal: React.FC<SetupGuideModalProps> = ({ isOpen, onClose }) => {
  const [openSteps, setOpenSteps] = useState<Record<number, boolean>>({
    1: true,
    2: true,
    3: true,
    4: true,
    5: true,
  });
  const [openFaq, setOpenFaq] = useState<Record<number, boolean>>({});
  const [copiedScope, setCopiedScope] = useState<string | null>(null);

  // Close modal on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const toggleStep = (stepId: number) => {
    setOpenSteps((prev) => ({ ...prev, [stepId]: !prev[stepId] }));
  };

  const toggleFaq = (index: number) => {
    setOpenFaq((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const toggleAllSteps = (expand: boolean) => {
    setOpenSteps({
      1: expand,
      2: expand,
      3: expand,
      4: expand,
      5: expand,
    });
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedScope(text);
    setTimeout(() => {
      setCopiedScope((current) => (current === text ? null : current));
    }, 2000);
  };

  const handleOpenExternal = (url: string) => {
    vscode.postMessage({ command: 'openExternalUrl', payload: url });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-md animate-fade-in overflow-y-auto">
      {/* Modal Container */}
      <div
        className="relative w-full max-w-3xl max-h-[90vh] flex flex-col bg-vscode-editor-bg/95 border border-white/15 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden text-vscode-editor-fg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/10 bg-white/5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center shadow-md shadow-indigo-500/20 text-white font-bold">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-vscode-editor-fg">飞书开放平台配置教学指引</h2>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-indigo-500/20 text-indigo-300 rounded-full border border-indigo-500/30">
                  5 步快速上手
                </span>
              </div>
              <p className="text-xs text-vscode-description mt-0.5">
                根据以下步骤创建企业自建应用，即可实现飞书知识库向 VS Code 本地 Markdown 的双向同步
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleAllSteps(true)}
              className="px-2.5 py-1 text-xs font-medium text-vscode-description hover:text-vscode-editor-fg hover:bg-white/5 rounded-lg transition-colors"
            >
              全部展开
            </button>
            <button
              onClick={() => toggleAllSteps(false)}
              className="px-2.5 py-1 text-xs font-medium text-vscode-description hover:text-vscode-editor-fg hover:bg-white/5 rounded-lg transition-colors"
            >
              全部收起
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-vscode-description hover:text-vscode-editor-fg hover:bg-white/10 rounded-lg transition-all ml-1"
              title="关闭 (Esc)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Step 1 */}
          <div className="border border-white/10 rounded-xl bg-white/[0.03] overflow-hidden transition-all duration-200">
            <button
              onClick={() => toggleStep(1)}
              className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-white/[0.04] transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 font-bold text-xs border border-indigo-500/40">
                  1
                </span>
                <span className="font-semibold text-sm">创建企业自建应用</span>
                <span className="text-xs text-vscode-description">登录飞书开放平台创建应用</span>
              </div>
              <svg
                className={`w-4 h-4 text-vscode-description transition-transform duration-200 ${
                  openSteps[1] ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {openSteps[1] && (
              <div className="px-5 pb-4 pt-1 text-xs text-vscode-description border-t border-white/5 space-y-2.5">
                <p>
                  访问飞书开放平台「开发者后台」，点击「创建自建应用」，输入应用名称（如 <code className="text-indigo-300 bg-indigo-500/10 px-1 py-0.5 rounded">LarkSync</code>）与描述并创建。
                </p>
                <div className="pt-1">
                  <button
                    onClick={() => handleOpenExternal('https://open.feishu.cn/app')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/80 hover:bg-indigo-600 text-white font-medium rounded-lg text-xs transition-colors shadow-sm"
                  >
                    <span>直达飞书开放平台</span>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Step 2 */}
          <div className="border border-white/10 rounded-xl bg-white/[0.03] overflow-hidden transition-all duration-200">
            <button
              onClick={() => toggleStep(2)}
              className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-white/[0.04] transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 font-bold text-xs border border-indigo-500/40">
                  2
                </span>
                <span className="font-semibold text-sm">获取 App ID 与 App Secret</span>
                <span className="text-xs text-vscode-description">凭证与基础信息</span>
              </div>
              <svg
                className={`w-4 h-4 text-vscode-description transition-transform duration-200 ${
                  openSteps[2] ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {openSteps[2] && (
              <div className="px-5 pb-4 pt-1 text-xs text-vscode-description border-t border-white/5 space-y-2">
                <p>
                  在自建应用的左侧菜单进入 <strong className="text-vscode-editor-fg">「凭证与基础信息」</strong>，复制 <code className="text-indigo-300 bg-indigo-500/10 px-1 py-0.5 rounded">App ID</code> (形如 cli_a1b2c3...) 与 <code className="text-indigo-300 bg-indigo-500/10 px-1 py-0.5 rounded">App Secret</code>。
                </p>
                <p>
                  将复制的凭据填入下方插件面板的 <strong className="text-vscode-editor-fg">App ID</strong> 和 <strong className="text-vscode-editor-fg">App Secret</strong> 输入框中即可自动保存。
                </p>
              </div>
            )}
          </div>

          {/* Step 3 */}
          <div className="border border-white/10 rounded-xl bg-white/[0.03] overflow-hidden transition-all duration-200">
            <button
              onClick={() => toggleStep(3)}
              className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-white/[0.04] transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 font-bold text-xs border border-indigo-500/40">
                  3
                </span>
                <span className="font-semibold text-sm">开通 4 大核心权限</span>
                <span className="text-xs text-vscode-description">开发配置 ➔ 权限管理</span>
              </div>
              <svg
                className={`w-4 h-4 text-vscode-description transition-transform duration-200 ${
                  openSteps[3] ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {openSteps[3] && (
              <div className="px-5 pb-4 pt-1 text-xs text-vscode-description border-t border-white/5 space-y-3">
                <p>
                  进入应用后台左侧 <strong className="text-vscode-editor-fg">「开发配置」➔「权限管理」</strong>，在搜索框中逐一检索并开通以下 4 项只读权限：
                </p>
                <div className="grid grid-cols-1 gap-2.5">
                  {REQUIRED_PERMISSIONS.map((perm) => (
                    <div
                      key={perm.scope}
                      className="p-2.5 rounded-lg bg-black/20 border border-white/5 flex items-center justify-between gap-3"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <code className="text-indigo-300 font-mono text-[11px] font-semibold bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                            {perm.scope}
                          </code>
                          <span className="text-vscode-editor-fg font-medium text-xs">{perm.title}</span>
                        </div>
                        <p className="text-[11px] text-vscode-description">{perm.desc}</p>
                      </div>
                      <button
                        onClick={() => handleCopy(perm.scope)}
                        className={`shrink-0 px-2.5 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 transition-all ${
                          copiedScope === perm.scope
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-white/5 hover:bg-white/10 text-vscode-editor-fg border border-white/10'
                        }`}
                      >
                        {copiedScope === perm.scope ? (
                          <>
                            <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            已复制
                          </>
                        ) : (
                          <>
                            <svg className="w-3 h-3 text-vscode-description" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            复制权限
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Step 4 */}
          <div className="border border-white/10 rounded-xl bg-white/[0.03] overflow-hidden transition-all duration-200">
            <button
              onClick={() => toggleStep(4)}
              className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-white/[0.04] transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 font-bold text-xs border border-indigo-500/40">
                  4
                </span>
                <span className="font-semibold text-sm">创建版本并提交发布</span>
                <span className="text-xs text-vscode-description">版本管理与发布</span>
              </div>
              <svg
                className={`w-4 h-4 text-vscode-description transition-transform duration-200 ${
                  openSteps[4] ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {openSteps[4] && (
              <div className="px-5 pb-4 pt-1 text-xs text-vscode-description border-t border-white/5 space-y-2">
                <p>
                  权限开通后必须发布应用新版本才能生效。进入应用左侧 <strong className="text-vscode-editor-fg">「应用发布」➔「版本管理与发布」</strong>。
                </p>
                <p>
                  点击「创建版本」，填写版本号（如 <code className="text-indigo-300 bg-indigo-500/10 px-1 py-0.5 rounded">1.0.0</code>）与更新说明，提交发布。
                </p>
                <div className="p-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[11px] flex items-center gap-2">
                  <svg className="w-4 h-4 shrink-0 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>企业自建应用发布通常免管理员审批，提交后秒级生效。</span>
                </div>
              </div>
            )}
          </div>

          {/* Step 5 */}
          <div className="border border-amber-500/30 rounded-xl bg-amber-500/[0.04] overflow-hidden transition-all duration-200">
            <button
              onClick={() => toggleStep(5)}
              className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-amber-500/[0.08] transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-bold text-xs border border-amber-500/40">
                  5
                </span>
                <span className="font-semibold text-sm text-amber-200">核心避坑：将应用机器人加入知识库</span>
                <span className="text-xs text-amber-300/70">知识库设置 ➔ 成员与权限</span>
              </div>
              <svg
                className={`w-4 h-4 text-amber-400 transition-transform duration-200 ${
                  openSteps[5] ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {openSteps[5] && (
              <div className="px-5 pb-4 pt-1 text-xs text-vscode-description border-t border-amber-500/20 space-y-2.5">
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs leading-relaxed space-y-1.5">
                  <div className="font-bold flex items-center gap-1.5 text-amber-300">
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    为什么必须执行此步？
                  </div>
                  <p>
                    飞书知识库具备独立的数据隔离机制。即使应用开通了全局权限，若未将该应用加入到具体知识库的成员名单中，调用接口时仍会返回 <code className="bg-black/40 px-1 py-0.5 rounded text-red-300 font-mono">403 Forbidden</code>。
                  </p>
                </div>

                <div className="space-y-1 text-vscode-editor-fg">
                  <p className="font-semibold text-xs">具体操作步骤：</p>
                  <ol className="list-decimal list-inside space-y-1 text-vscode-description pl-1">
                    <li>打开飞书网页端或桌面客户端，进入你需要同步的知识库；</li>
                    <li>点击左侧边栏底部的「知识库设置」（或右上角「更多设置」）➔「成员与权限」；</li>
                    <li>点击「添加成员」，搜索你在第 1 步中创建的自建应用名称，将其添加为「管理员」或「可阅读」；</li>
                    <li>从知识库网页链接中复制 <code className="text-indigo-300 bg-indigo-500/10 px-1 py-0.5 rounded font-mono">Space ID</code>（例如 URL 为 <span className="font-mono text-white/70">https://xxx.feishu.cn/wiki/settings/7183020484...</span> 时，末尾的数字即为 Space ID），填入插件设置即可开始同步。</li>
                  </ol>
                </div>
              </div>
            )}
          </div>

          {/* FAQ / Troubleshooting Section */}
          <div className="pt-2">
            <div className="border border-white/10 rounded-xl bg-white/[0.02] overflow-hidden">
              <div className="px-5 py-3 border-b border-white/5 bg-white/[0.02] flex items-center gap-2">
                <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="font-bold text-sm text-vscode-editor-fg">常见问题诊断 (FAQ & Troubleshooting)</h3>
              </div>

              <div className="divide-y divide-white/5">
                {FAQ_ITEMS.map((faq, index) => (
                  <div key={index} className="transition-colors">
                    <button
                      onClick={() => toggleFaq(index)}
                      className="w-full px-5 py-3 flex items-center justify-between text-left hover:bg-white/[0.03] transition-colors"
                    >
                      <span className="text-xs font-semibold text-vscode-editor-fg">{faq.question}</span>
                      <svg
                        className={`w-3.5 h-3.5 text-vscode-description transition-transform duration-200 shrink-0 ml-2 ${
                          openFaq[index] ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {openFaq[index] && (
                      <div className="px-5 pb-3.5 pt-0.5 text-xs text-vscode-description leading-relaxed">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-white/5 flex items-center justify-between shrink-0">
          <span className="text-xs text-vscode-description">
            配置完成后，在控制台点击「Start Sync」即可开始拉取。
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-400 hover:to-blue-400 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-500/25 transition-all active:scale-95"
          >
            完成并关闭
          </button>
        </div>
      </div>
    </div>
  );
};
