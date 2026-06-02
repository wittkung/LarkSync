import * as vscode from 'vscode';

export enum LogLevel {
    DEBUG = 'DEBUG',
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR'
}

class Logger {
    private channel: vscode.OutputChannel;
    private static instance: Logger;

    private constructor() {
        this.channel = vscode.window.createOutputChannel('LarkSync');
    }

    public static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    public debug(msg: string) {
        this.log(LogLevel.DEBUG, msg);
    }

    public info(msg: string) {
        this.log(LogLevel.INFO, msg);
    }

    public warn(msg: string) {
        this.log(LogLevel.WARN, msg);
    }

    public error(msg: string, e?: any) {
        this.log(LogLevel.ERROR, msg);
        if (e) {
            if (e instanceof Error) {
                this.channel.appendLine(e.stack || e.message);
            } else {
                this.channel.appendLine(typeof e === 'string' ? e : String(e));
            }
        }
    }

    public show() {
        this.channel.show();
    }

    private log(level: LogLevel, msg: string) {
        // Only log DEBUG in development or if a config flag is set, but for now we log everything
        const time = new Date().toISOString();
        this.channel.appendLine(`[${time}] [${level}] ${msg}`);
    }
}

// Keep the export const logger for backwards compatibility, but use the singleton pattern internally
export const logger = Logger.getInstance();
