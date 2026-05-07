import type { LogFields, LogLevel } from "./types.js";

export type SeqSink = {
  write(level: LogLevel, fields: LogFields, message?: string): Promise<void>;
};

export type SeqSinkOptions = {
  url: string;
  apiKey?: string;
  fetchFn?: typeof fetch;
};

const SEQ_LEVELS: Record<LogLevel, string> = {
  debug: "Debug",
  info: "Information",
  warn: "Warning",
  error: "Error"
};

export function formatSeqEvent(
  level: LogLevel,
  fields: LogFields,
  message?: string
): Record<string, unknown> {
  return {
    "@t": new Date().toISOString(),
    "@mt": message ?? fields.event,
    "@l": SEQ_LEVELS[level],
    ...fields
  };
}

export function createSeqSink(options: SeqSinkOptions): SeqSink {
  const fetchFn = options.fetchFn ?? globalThis.fetch;
  const endpoint = new URL(
    "/ingest/clef",
    normalizeSeqUrl(options.url)
  ).toString();

  return {
    async write(level, fields, message) {
      const headers = new Headers({
        "content-type": "application/vnd.serilog.clef"
      });

      if (options.apiKey) {
        headers.set("x-seq-apikey", options.apiKey);
      }

      const response = await fetchFn(endpoint, {
        method: "POST",
        headers,
        body: `${JSON.stringify(formatSeqEvent(level, fields, message))}\n`
      });

      if (!response.ok) {
        const responseText = await response.text().catch(() => "");
        const suffix = responseText ? `: ${responseText}` : "";

        throw new Error(
          `Seq ingestion failed with ${response.status} ${response.statusText}${suffix}`
        );
      }
    }
  };
}

function normalizeSeqUrl(url: string): string {
  return url.endsWith("/") ? url : `${url}/`;
}
