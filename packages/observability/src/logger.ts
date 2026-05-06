import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import pino from "pino";

import type {
  LogBindings,
  LogFields,
  Logger,
  LoggerFactoryConfig,
  LogLevel,
  MemoryLogRecord
} from "./types.js";

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

export function createNoopLogger(): Logger {
  return {
    debug() {},
    info() {},
    warn() {},
    error() {},
    child() {
      return createNoopLogger();
    },
    flush() {}
  };
}

export function createMemoryLogger(
  options: {
    level?: LogLevel;
    bindings?: LogBindings;
  } = {}
): { logger: Logger; records: MemoryLogRecord[] } {
  const records: MemoryLogRecord[] = [];
  const level = options.level ?? "debug";

  const buildLogger = (bindings: LogBindings): Logger => ({
    debug(fields, message) {
      pushMemoryRecord(records, level, "debug", bindings, fields, message);
    },
    info(fields, message) {
      pushMemoryRecord(records, level, "info", bindings, fields, message);
    },
    warn(fields, message) {
      pushMemoryRecord(records, level, "warn", bindings, fields, message);
    },
    error(fields, message) {
      pushMemoryRecord(records, level, "error", bindings, fields, message);
    },
    child(nextBindings) {
      return buildLogger({
        ...bindings,
        ...nextBindings
      });
    },
    flush() {}
  });

  return {
    logger: buildLogger(options.bindings ?? {}),
    records
  };
}

export function createPinoLogger(config: LoggerFactoryConfig): Logger {
  if (!config.enabled) {
    return createNoopLogger();
  }

  mkdirSync(dirname(config.filePath), {
    recursive: true
  });
  const destination = pino.destination({
    dest: config.filePath,
    mkdir: true,
    sync: true
  });
  const streams = [
    {
      stream: destination
    },
    ...(config.console
      ? [
          {
            stream: process.stdout
          }
        ]
      : [])
  ];
  const base = pino(
    {
      level: config.level,
      base: undefined
    },
    pino.multistream(streams)
  );

  return wrapPinoLogger(base, () => {
    destination.flushSync();
  });
}

function wrapPinoLogger(
  base: pino.Logger,
  flush: () => void,
  bindings: LogBindings = {}
): Logger {
  const write = (
    level: LogLevel,
    fields: LogFields,
    message?: string
  ): void => {
    base[level](
      {
        ...bindings,
        ...fields
      },
      message
    );
  };

  return {
    debug(fields, message) {
      write("debug", fields, message);
    },
    info(fields, message) {
      write("info", fields, message);
    },
    warn(fields, message) {
      write("warn", fields, message);
    },
    error(fields, message) {
      write("error", fields, message);
    },
    child(nextBindings) {
      return wrapPinoLogger(
        base,
        flush,
        {
          ...bindings,
          ...nextBindings
        }
      );
    },
    flush
  };
}

function pushMemoryRecord(
  records: MemoryLogRecord[],
  minLevel: LogLevel,
  level: LogLevel,
  bindings: LogBindings,
  fields: LogFields,
  message?: string
): void {
  if (LEVEL_RANK[level] < LEVEL_RANK[minLevel]) {
    return;
  }

  records.push({
    level,
    fields: {
      ...bindings,
      ...fields
    },
    message
  });
}
