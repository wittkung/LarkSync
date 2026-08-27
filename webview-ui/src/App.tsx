import { useState, useEffect } from 'react'
import { vscode } from './utils/vscode'
import { Header } from './components/Header'
import { StatusCard } from './components/StatusCard'
import { ConfigPanel } from './components/ConfigPanel'
import { AuditLog } from './components/AuditLog'
import { SetupGuideModal } from './components/SetupGuideModal'

interface HealthState {
  tokenValid: boolean;
  appId?: string;
  appSecret?: string;
  hasAppId?: boolean;
  hasAppSecret?: boolean;
  spaceId: string;
  syncDir: string;
  lastSync: number | null;
}

function App() {
  const [health, setHealth] = useState<HealthState>({ 
    tokenValid: false, 
    appId: '',
    appSecret: '',
    hasAppId: false,
    hasAppSecret: false,
    spaceId: '', 
    syncDir: 'LarkDocs',
    lastSync: null
  });
  
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  const [syncState, setSyncState] = useState<{
    syncing: boolean;
    progress: number;
    message: string;
  }>({ syncing: false, progress: 0, message: '' });

  const [logs, setLogs] = useState<{time: string, message: string}[]>([]);

  useEffect(() => {
    // Listen for messages from the extension host
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      const payload = message.payload || message.data;
      
      switch (message.command) {
        case 'healthData':
          setHealth(prev => ({
            ...prev,
            ...payload
          }));
          break;
        case 'syncProgress':
          if (payload.type === 'start') {
            setSyncState({ syncing: true, progress: 0, message: 'Starting...' });
          } else if (payload.type === 'progress') {
            setSyncState({ 
              syncing: true, 
              progress: payload.percent, 
              message: payload.message 
            });
            setLogs(prev => [{ time: new Date().toLocaleTimeString(), message: payload.message }, ...prev].slice(0, 50));
          } else if (payload.type === 'complete' || payload.type === 'error') {
            setSyncState(prev => ({ ...prev, syncing: false, message: payload.type === 'error' ? 'Failed' : 'Complete' }));
            // Request fresh health data after sync cycle ends
            vscode.postMessage({ command: 'getHealth' });
          }
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    
    // Initial fetch of configuration and health data
    vscode.postMessage({ command: 'getHealth' });

    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleStartSync = () => {
    vscode.postMessage({ command: 'startSync' });
  };

  const handleOpenFolder = () => {
    vscode.postMessage({ command: 'openFolder' });
  };
  
  const handleConfigChange = (key: 'syncDir' | 'spaceId' | 'appId' | 'appSecret', value: string) => {
    setHealth(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveConfig = (key: string, value: string) => {
    vscode.postMessage({ command: 'saveConfig', payload: { key, value } });
  };

  const handleImportCache = () => {
    vscode.postMessage({ command: 'importCacheFiles' });
  };

  const handleLogin = () => {
    vscode.postMessage({ command: 'login' });
  };

  return (
    <div className="min-h-screen bg-vscode-editor-bg text-vscode-editor-fg font-sans relative overflow-y-auto overflow-x-hidden selection:bg-indigo-500/30">
      
      {/* Dynamic Background */}
      <div className="fixed inset-0 pointer-events-none bg-mesh-gradient opacity-30"></div>
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/10 via-vscode-editor-bg to-vscode-editor-bg"></div>

      <div className="relative max-w-5xl mx-auto space-y-8 p-8">
        
        <Header 
          onOpenFolder={handleOpenFolder} 
          onStartSync={handleStartSync} 
          onOpenGuide={() => setIsGuideOpen(true)}
          syncing={syncState.syncing} 
          tokenValid={health.tokenValid} 
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-8">
            <StatusCard 
              tokenValid={health.tokenValid} 
              lastSync={health.lastSync} 
              syncing={syncState.syncing} 
              progress={syncState.progress} 
              message={syncState.message} 
            />
            
            <AuditLog logs={logs} />
          </div>

          {/* Configuration Column */}
          <div className="space-y-8">
            <ConfigPanel 
              tokenValid={health.tokenValid}
              appId={health.appId}
              appSecret={health.appSecret}
              syncDir={health.syncDir}
              spaceId={health.spaceId}
              onConfigChange={handleConfigChange}
              onSaveConfig={handleSaveConfig}
              onImportCache={handleImportCache}
              onLogin={handleLogin}
              onOpenGuide={() => setIsGuideOpen(true)}
            />
          </div>
        </div>

      </div>

      {/* Setup Guide Modal */}
      <SetupGuideModal 
        isOpen={isGuideOpen} 
        onClose={() => setIsGuideOpen(false)} 
      />
    </div>
  );
}

export default App;
