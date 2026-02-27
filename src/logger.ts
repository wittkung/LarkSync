import * as vscode from 'vscode';

class Logger {
    private channel: vscode.OutputChannel;

    constructor() {
        this.channel = vscode.window.createOutputChannel('LarkSync');
    }

    public info(msg: string) {
        this.log('INFO', msg);
    }

    public warn(msg: string) {
        this.log('WARN', msg);
    }

    public error(msg: string, e?: any) {
        this.log('ERROR', msg);
        if (e) {
            this.channel.appendLine(typeof e === 'string' ? e : e.message || String(e));
        }
    }

    public show() {
        this.channel.show();
    }

    private log(level: string, msg: string) {
        const time = new Date().toLocaleTimeString();
        this.channel.appendLine(`[${time}] [${level}] ${msg}`);
    }
}

export const logger = new Logger();
