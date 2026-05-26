import React from 'react';

interface StatusCardProps {
  tokenValid: boolean;
  lastSync: number | null;
  syncing: boolean;
  progress: number;
  message: string;
}

export const StatusCard: React.FC<StatusCardProps> = ({ tokenValid, lastSync, syncing, progress, message }) => {
  return (
    <div className="glass-panel rounded-2xl overflow-hidden animate-slide-up group" style={{ animationDelay: '0.1s' }}>
      <div className="px-6 py-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
        <h2 className="text-sm font-semibold flex items-center gap-3">
          <div className="relative flex h-3 w-3">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${tokenValid ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
            <span className={`relative inline-flex rounded-full h-3 w-3 ${tokenValid ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]' : 'bg-amber-500'}`}></span>
          </div>
          System Health
        </h2>
      </div>
      
      <div className="p-6 space-y-5">
        <div className="flex justify-between items-center p-4 rounded-xl bg-vscode-editor-bg/40 border border-white/5 hover:border-white/10 transition-colors">
          <span className="text-sm font-medium text-vscode-description">Feishu Authentication</span>
          {tokenValid ? 
            <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold tracking-wide border border-emerald-500/20 shadow-[inset_0_0_10px_rgba(16,185,129,0.1)]">Active</span> :
            <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-bold tracking-wide border border-amber-500/20">Needs Login</span>
          }
        </div>
        
        <div className="flex justify-between items-center p-4 rounded-xl bg-vscode-editor-bg/40 border border-white/5 hover:border-white/10 transition-colors">
          <span className="text-sm font-medium text-vscode-description">Last Sync Time</span>
          <span className="text-sm font-bold text-vscode-editor-fg">{lastSync ? new Date(lastSync).toLocaleString() : 'Never synced'}</span>
        </div>
        
        {syncing && (
          <div className="mt-6 p-5 rounded-xl bg-gradient-to-br from-indigo-500/10 to-fuchsia-500/5 border border-indigo-500/20 animate-pulse-glow">
            <div className="flex justify-between text-xs font-bold mb-3">
              <span className="text-indigo-300">Sync Progress</span>
              <span className="text-fuchsia-300">{progress}%</span>
            </div>
            <div className="w-full bg-black/20 rounded-full h-2.5 overflow-hidden backdrop-blur-sm border border-white/5">
              <div 
                className="bg-gradient-to-r from-indigo-500 via-purple-500 to-fuchsia-500 h-2.5 rounded-full transition-all duration-300 ease-out shadow-[0_0_10px_rgba(168,85,247,0.5)]" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-xs text-vscode-description mt-3 truncate animate-pulse">{message}</p>
          </div>
        )}
      </div>
    </div>
  );
};
