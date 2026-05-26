import React from 'react';

interface ConfigPanelProps {
  tokenValid: boolean;
  syncDir: string;
  spaceId: string;
  onConfigChange: (key: 'syncDir' | 'spaceId', value: string) => void;
  onSaveConfig: (key: string, value: string) => void;
  onImportCache: () => void;
  onLogin: () => void;
}

export const ConfigPanel: React.FC<ConfigPanelProps> = ({ 
  tokenValid, syncDir, spaceId, onConfigChange, onSaveConfig, onImportCache, onLogin 
}) => {
  return (
    <div className="glass-panel rounded-2xl overflow-hidden sticky top-6 animate-slide-up" style={{ animationDelay: '0.3s' }}>
      <div className="px-6 py-4 border-b border-white/5 bg-white/5">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          Configuration
        </h2>
      </div>
      <div className="p-6 space-y-6">
        
        <div className="space-y-2 group">
          <label className="text-[11px] font-bold text-vscode-description uppercase tracking-wider group-focus-within:text-indigo-400 transition-colors">Sync Directory</label>
          <input 
            type="text" 
            value={syncDir || ''}
            onChange={(e) => onConfigChange('syncDir', e.target.value)}
            onBlur={(e) => onSaveConfig('larksync.syncDirectory', e.target.value)}
            className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all shadow-inner"
            placeholder="e.g. LarkDocs"
          />
        </div>
        
        <div className="space-y-2 group">
          <label className="text-[11px] font-bold text-vscode-description uppercase tracking-wider group-focus-within:text-indigo-400 transition-colors">Space ID / Token</label>
          <input 
            type="text" 
            value={spaceId || ''}
            onChange={(e) => onConfigChange('spaceId', e.target.value)}
            onBlur={(e) => onSaveConfig('larksync.spaceId', e.target.value)}
            className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all shadow-inner"
            placeholder="e.g. 7183020484..."
          />
        </div>
        
        <div className="pt-5 mt-2 border-t border-white/10">
          <button 
            onClick={onImportCache}
            className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-vscode-editor-fg rounded-lg transition-all text-sm font-semibold flex justify-center items-center gap-2 border border-white/10 hover:border-white/20 hover:shadow-lg hover:shadow-white/5"
          >
            <svg className="w-4 h-4 text-vscode-description" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            Import Cache JSONs
          </button>
        </div>
        
        {!tokenValid && (
          <div className="pt-2">
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg blur opacity-30 group-hover:opacity-60 transition duration-500"></div>
              <button 
                onClick={onLogin}
                className="relative w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white rounded-lg transition-all text-sm font-bold flex justify-center items-center shadow-lg border border-amber-400/50"
              >
                Connect to Feishu
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
