import React from 'react';

interface HeaderProps {
  onOpenFolder: () => void;
  onStartSync: () => void;
  syncing: boolean;
  tokenValid: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onOpenFolder, onStartSync, syncing, tokenValid }) => {
  return (
    <header className="flex items-center justify-between pb-6 border-b border-vscode-panel-border/30">
      <div className="flex items-center gap-5">
        <div className="relative group cursor-default">
          <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-fuchsia-500 rounded-2xl blur opacity-25 group-hover:opacity-60 transition duration-1000 group-hover:duration-200"></div>
          <div className="relative h-12 w-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30 border border-white/10 overflow-hidden">
             {/* Dynamic background effect inside icon */}
            <div className="absolute inset-0 bg-white/10 translate-y-12 group-hover:translate-y-0 transition-transform duration-500 ease-out"></div>
            <svg className="w-6 h-6 text-white relative z-10 animate-float" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
        </div>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-vscode-editor-fg to-indigo-400 drop-shadow-sm">
            LarkSync Dashboard
          </h1>
          <p className="text-sm text-vscode-description mt-1 opacity-80">Manage your Feishu Knowledge Base synchronisation</p>
        </div>
      </div>
      <div className="flex gap-3">
        <button 
          onClick={onOpenFolder}
          className="px-5 py-2.5 glass-panel hover:bg-vscode-button-secondaryHoverBg text-vscode-button-secondaryFg rounded-xl transition-all duration-300 text-sm font-semibold active:scale-95"
        >
          Open Folder
        </button>
        <button 
          onClick={onStartSync}
          disabled={syncing || !tokenValid}
          className={`relative overflow-hidden px-6 py-2.5 rounded-xl transition-all duration-300 text-sm font-bold flex items-center gap-2 active:scale-95 group
            ${syncing || !tokenValid ? 
              'bg-vscode-button-bg/30 text-vscode-description cursor-not-allowed border border-vscode-panel-border/30' : 
              'bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-400 hover:to-blue-400 text-white shadow-lg shadow-indigo-500/25 border border-indigo-400/30'}`}
        >
          {syncing && (
            <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%)] bg-[length:250%_250%] animate-[shimmer_2s_infinite]"></div>
          )}
          
          <span className="relative z-10 flex items-center gap-2">
            {syncing ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Syncing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Start Sync
              </>
            )}
          </span>
        </button>
      </div>
    </header>
  );
};
