// Enhanced logging utility for Google Sheets integration
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogContext {
  module?: string;
  action?: string;
  userId?: string;
  projectId?: string;
  spreadsheetId?: string;
  duration?: number;
  [key: string]: any;
}

class Logger {
  private logLevel: LogLevel = LogLevel.DEBUG;
  private enabledModules: Set<string> = new Set(['*']); // '*' means all modules enabled

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  enableModule(module: string): void {
    this.enabledModules.add(module);
  }

  disableModule(module: string): void {
    this.enabledModules.delete(module);
  }

  private shouldLog(level: LogLevel, module?: string): boolean {
    if (level < this.logLevel) return false;
    if (!module) return true;
    return this.enabledModules.has('*') || this.enabledModules.has(module);
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const levelName = LogLevel[level];
    const module = context?.module ? `[${context.module}]` : '';
    const action = context?.action ? `{${context.action}}` : '';
    
    return `${timestamp} ${levelName} ${module}${action} ${message}`;
  }

  private formatContext(context?: LogContext): any {
    if (!context) return {};
    
    // Remove module and action as they're already in the message
    const { module, action, ...rest } = context;
    return rest;
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.DEBUG, context?.module)) {
      console.debug(this.formatMessage(LogLevel.DEBUG, message, context), this.formatContext(context));
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.INFO, context?.module)) {
      console.info(this.formatMessage(LogLevel.INFO, message, context), this.formatContext(context));
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.WARN, context?.module)) {
      console.warn(this.formatMessage(LogLevel.WARN, message, context), this.formatContext(context));
    }
  }

  error(message: string, error?: Error, context?: LogContext): void {
    if (this.shouldLog(LogLevel.ERROR, context?.module)) {
      const errorContext = error ? { ...this.formatContext(context), error: error.message, stack: error.stack } : this.formatContext(context);
      console.error(this.formatMessage(LogLevel.ERROR, message, context), errorContext);
    }
  }

  // Performance measurement utilities
  time(label: string): void {
    console.time(label);
  }

  timeEnd(label: string): void {
    console.timeEnd(label);
  }

  // API call logging with performance tracking
  async logApiCall<T>(
    apiName: string,
    operation: () => Promise<T>,
    context?: LogContext
  ): Promise<T> {
    const startTime = Date.now();
    const logContext = { ...context, module: 'GoogleAPI', action: apiName };
    
    this.debug(`Starting API call: ${apiName}`, logContext);
    
    try {
      const result = await operation();
      const duration = Date.now() - startTime;
      
      this.info(`API call successful: ${apiName}`, {
        ...logContext,
        duration,
        success: true,
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.error(`API call failed: ${apiName}`, error as Error, {
        ...logContext,
        duration,
        success: false,
      });
      
      throw error;
    }
  }

  // Authentication flow logging
  logAuthEvent(event: string, context?: LogContext): void {
    this.info(`Auth event: ${event}`, {
      ...context,
      module: 'Auth',
      action: 'authenticate',
    });
  }

  // Sync operation logging
  logSyncEvent(event: string, context?: LogContext): void {
    this.info(`Sync event: ${event}`, {
      ...context,
      module: 'Sync',
      action: 'sync',
    });
  }

  // Data transformation logging
  logDataTransform(operation: string, itemCount: number, context?: LogContext): void {
    this.debug(`Data transform: ${operation}`, {
      ...context,
      module: 'DataTransform',
      action: operation,
      itemCount,
    });
  }
}

// Global logger instance
export const logger = new Logger();

// Environment-based configuration
if (import.meta.env.DEV) {
  logger.setLogLevel(LogLevel.DEBUG);
} else {
  logger.setLogLevel(LogLevel.WARN);
}

// Allow runtime configuration via window object for debugging
if (typeof window !== 'undefined') {
  (window as any).timelineLogger = {
    setLevel: (level: string) => {
      const levelMap: Record<string, LogLevel> = {
        debug: LogLevel.DEBUG,
        info: LogLevel.INFO,
        warn: LogLevel.WARN,
        error: LogLevel.ERROR,
      };
      logger.setLogLevel(levelMap[level] || LogLevel.INFO);
    },
    enableModule: (module: string) => logger.enableModule(module),
    disableModule: (module: string) => logger.disableModule(module),
    logger,
  };
}