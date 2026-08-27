import React, { useState } from 'react';

interface ConfigPanelProps {
  tokenValid: boolean;
  appId?: string;
  appSecret?: string;
  syncDir: string;
  spaceId: string;
  onConfigChange: (key: 'syncDir' | 'spaceId' | 'appId' | 'appSecret', value: string) => void;
  onSaveConfig: (key: string, value: string) => void;
  onImportCache: () => void;
  onLogin: () => void;
  onOpenGuide: () => void;
}

export const ConfigPanel: React.FC<ConfigPanelProps> = ({ 
  tokenValid, 
  appId = '', 
  appSecret = '', 
  syncDir, 
  spaceId, 
  onConfigChange, 
  onSaveConfig, 
  onImportCache, 
  onLogin,
  onOpenGuide
}) => {
  const [showSecret, setShowSecret] = useState(false);

  return (
    <div className="glass-panel rounded-2xl overflow-hidden sticky top-6 animate-slide-up" style={{ animationDelay: '0.3s' }}>
      <div className="px-6 py-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Configuration
        </h2>
        <button
          onClick={onOpenGuide}
          className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium transition-colors hover:underline"
        >
          <span>📖 查看配置指引</span>
        </button>
      </div>

      <div className="p-6 space-y-5">
        {/* App ID */}
        <div className="space-y-1.5 group">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold text-vscode-description uppercase tracking-wider group-focus-within:text-indigo-400 transition-colors">
              App ID
            </label>
            <span className="text-[10px] text-vscode-description/70">cli_xxx</span>
          </div>
          <input 
            type="text" 
            value={appId}
            onChange={(e) => onConfigChange('appId', e.target.value)}
            onBlur={(e) => onSaveConfig('larksync.appId', e.target.value)}
            className="w-full bg-black/20 border border-white/10 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all font-mono"
            placeholder="cli_a1b2c3d4e5..."
          />
        </div>

        {/* App Secret */}
        <div className="space-y-1.5 group">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold text-vscode-description uppercase tracking-wider group-focus-within:text-indigo-400 transition-colors">
              App Secret
            </label>
            <button
              type="button"
              onClick={() => setShowSecret(!showSecret)}
              className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              {showSecret ? '隐藏' : '显示'}
            </button>
          </div>
          <div className="relative">
            <input 
              type={showSecret ? 'text' : 'password'}
              value={appSecret}
              onChange={(e) => onConfigChange('appSecret', e.target.value)}
              onBlur={(e) => onSaveConfig('larksync.appSecret', e.target.value)}
              className="w-full bg-black/20 border border-white/10 rounded-lg pl-3.5 pr-9 py-2 text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all font-mono"
              placeholder="••••••••••••••••••••"
            />
            <button
              type="button"
              onClick={() => setShowSecret(!showSecret)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-vscode-description hover:text-vscode-editor-fg transition-colors"
              title={showSecret ? 'Hide secret' : 'Show secret'}
            >
              {showSecret ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Space ID */}
        <div className="space-y-1.5 group">
          <label className="text-[11px] font-bold text-vscode-description uppercase tracking-wider group-focus-within:text-indigo-400 transition-colors">
            Space ID / Token
          </label>
          <input 
            type="text" 
            value={spaceId || ''}
            onChange={(e) => onConfigChange('spaceId', e.target.value)}
            onBlur={(e) => onSaveConfig('larksync.spaceId', e.target.value)}
            className="w-full bg-black/20 border border-white/10 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all font-mono"
            placeholder="e.g. 7183020484..."
          />
        </div>

        {/* Sync Directory */}
        <div className="space-y-1.5 group">
          <label className="text-[11px] font-bold text-vscode-description uppercase tracking-wider group-focus-within:text-indigo-400 transition-colors">
            Sync Directory
          </label>
          <input 
            type="text" 
            value={syncDir || ''}
            onChange={(e) => onConfigChange('syncDir', e.target.value)}
            onBlur={(e) => onSaveConfig('larksync.syncDirectory', e.target.value)}
            className="w-full bg-black/20 border border-white/10 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all font-mono"
            placeholder="e.g. LarkDocs"
          />
        </div>
        
        {/* Action Buttons */}
        <div className="pt-3 border-t border-white/10 space-y-2.5">
          <button 
            onClick={onOpenGuide}
            className="w-full py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 rounded-lg transition-all text-xs font-semibold flex justify-center items-center gap-1.5 border border-indigo-500/20"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            查看 5 步配置指引
          </button>

          <button 
            onClick={onImportCache}
            className="w-full py-2 bg-white/5 hover:bg-white/10 text-vscode-editor-fg rounded-lg transition-all text-xs font-medium flex justify-center items-center gap-1.5 border border-white/10 hover:border-white/20"
          >
            <svg className="w-3.5 h-3.5 text-vscode-description" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import Cache JSONs
          </button>
        </div>
        
        {!tokenValid && (
          <div className="pt-1">
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg blur opacity-30 group-hover:opacity-60 transition duration-500"></div>
              <button 
                onClick={onLogin}
                className="relative w-full py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white rounded-lg transition-all text-xs font-bold flex justify-center items-center shadow-lg border border-amber-400/50"
              >
                Connect to Feishu (OAuth)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
