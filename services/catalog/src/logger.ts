export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogFields = Record<string, unknown>;

export interface Logger {
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
  child(fields: LogFields): Logger;
}

/** JSON lines to stdout, one object per entry, so CloudWatch Logs Insights can query fields. */
export function createLogger(
  base: LogFields = {},
  write: (line: string) => void = (line) => {
    console.log(line);
  },
): Logger {
  const log = (level: LogLevel, message: string, fields: LogFields = {}) => {
    write(JSON.stringify({ level, message, ...base, ...fields }));
  };
  return {
    info: (message, fields) => {
      log('info', message, fields);
    },
    warn: (message, fields) => {
      log('warn', message, fields);
    },
    error: (message, fields) => {
      log('error', message, fields);
    },
    child: (fields) => createLogger({ ...base, ...fields }, write),
  };
}

/** Error details for log entries, without leaking them into responses. */
export const errorFields = (error: unknown): LogFields =>
  error instanceof Error
    ? { error: { name: error.name, message: error.message, stack: error.stack } }
    : { error: String(error) };
