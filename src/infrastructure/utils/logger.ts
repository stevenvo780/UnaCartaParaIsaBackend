/* eslint-disable no-console */

type LogLevel = "info" | "warn" | "error" | "debug";

class Logger {
  private isDevelopment(): boolean {
    return process.env.NODE_ENV !== "production";
  }

  private formatMessage(
    level: LogLevel,
    message: string,
    ...args: unknown[]
  ): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    return args.length > 0
      ? `${prefix} ${message} ${JSON.stringify(args)}`
      : `${prefix} ${message}`;
  }

  info(message: string, ...args: unknown[]): void {
    if (this.isDevelopment()) {
      console.log(this.formatMessage("info", message, ...args));
    }
  }

  warn(message: string, ...args: unknown[]): void {
    console.warn(this.formatMessage("warn", message, ...args));
  }

  error(message: string, ...args: unknown[]): void {
    console.error(this.formatMessage("error", message, ...args));
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.isDevelopment()) {
      console.debug(this.formatMessage("debug", message, ...args));
    }
  }
}

export const logger = new Logger();
