import React from 'react';

interface AuditLogProps {
  logs: { time: string, message: string }[];
}

export const AuditLog: React.FC<AuditLogProps> = ({ logs }) => {
  return (
    <div className="glass-panel rounded-2xl overflow-hidden animate-slide-up" style={{ animationDelay: '0.2s' }}>
      <div className="px-6 py-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <svg className="w-4 h-4 text-fuchsia-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          Sync Audit Log
        </h2>
        <span className="text-[10px] uppercase tracking-wider text-vscode-description font-bold bg-white/5 px-2 py-1 rounded">Live</span>
      </div>
      <div className="p-6">
        <div className="bg-black/30 rounded-xl border border-white/10 h-64 overflow-y-auto font-mono text-[13px] p-4 shadow-inner relative">
          {logs.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-vscode-description/50">
              <svg className="w-8 h-8 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              No recent sync activity
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log, i) => (
                <div key={i} className={`flex gap-4 p-2 rounded-lg transition-colors hover:bg-white/5 ${i === 0 ? 'animate-slide-up' : ''}`}>
                  <span className="text-vscode-description/70 shrink-0 w-20">[{log.time}]</span>
                  <span className={`${
                    log.message.includes('Error') || log.message.includes('Failed') 
                      ? 'text-red-400 font-medium' 
                      : log.message.includes('完成') || log.message.includes('Success') || log.message.includes('变更')
                        ? 'text-emerald-400'
                        : 'text-vscode-editor-fg/90'
                  }`}>
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
