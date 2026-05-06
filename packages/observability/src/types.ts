export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogFields = Record<string, unknown> & {
  event: string;
};

export type LogBindings = Record<string, unknown>;

export type Logger = {
  debug(fields: LogFields, message?: string): void;
  info(fields: LogFields, message?: string): void;
  warn(fields: LogFields, message?: string): void;
  error(fields: LogFields, message?: string): void;
  child(bindings: LogBindings): Logger;
  flush?(): Promise<void> | void;
};

export type LoggerFactoryConfig = {
  enabled: boolean;
  level: LogLevel;
  filePath: string;
  console: boolean;
  seq: {
    enabled: boolean;
    url: string;
    apiKey?: string;
  };
};

export type MemoryLogRecord = {
  level: LogLevel;
  fields: LogFields;
  message?: string;
};
