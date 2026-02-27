# LarkSync for VS Code

LarkSync is a powerful Visual Studio Code extension designed to automatically sync your Feishu / Lark knowledge base (Wiki spaces) into a local workspace directory as pure Markdown (`.md`) files.

## High-Performance Architecture
- **Multi-threaded Conversion**: Utilizes Node.js `worker_threads` to offload CPU-intensive Feishu Markdown AST conversions without blocking the VS Code editor UI.
- **Concurrent Polling**: Integrates `p-limit` for highly efficient concurrent fetching from the Feishu API.
- **Incremental Sync**: Uses `.sync_state.json` cache logic to skip downloading files that haven't changed, significantly speeding up refresh cycles.
- **Silent Background Auto-Sync**: Includes an intelligent `setInterval` polling service that checks for downstream changes every few minutes and quietly synchronizes the changes directly into your VS Code interface.

## Quick Start
1. Add your Feishu credentials to your VS Code Settings:
   - `larksync.appId` (Your Feishu App ID)
   - `larksync.appSecret` (Your Feishu App Secret)
   - `larksync.spaceId` (The Wiki Space ID to sync)
   - `larksync.syncDirectory` (Target top level folder default is `LarkDocs`)
   - `larksync.pollingIntervalMinutes` (Default: 5 mins)
2. Open any Workspace.
3. Click the bottom-right status bar button `$(sync) LarkSync` or press `F1` and run `LarkSync: Start Sync`.
4. Wait for the `LarkDocs` folder to be populated with beautifully formatted Markdown documents matching your Feishu tree structure!

## Development
To test this extension locally:
- Run `npm install`
- Open this directory in VS Code and press `F5` to open the Extension Development Host window.