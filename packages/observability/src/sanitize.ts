export type LLMLoggingConfig = {
  includeMessages: boolean;
  includeRawResponse: boolean;
  includeStack: boolean;
  maxTextLength: number;
};

export function sanitizeLLMRequestBody(
  body: Record<string, unknown>,
  config: LLMLoggingConfig
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(body)) {
    if (key === "messages" && !config.includeMessages) {
      continue;
    }

    sanitized[key] = sanitizeValue(value, config.maxTextLength);
  }

  return sanitized;
}

export function sanitizeLLMResponseText(
  rawText: string,
  config: LLMLoggingConfig
): Record<string, unknown> {
  if (!config.includeRawResponse) {
    return {
      rawTextLength: rawText.length
    };
  }

  const value = truncateString(rawText, config.maxTextLength);

  return value.truncated
    ? {
        rawText: value.text,
        rawTextLength: rawText.length,
        truncated: true
      }
    : {
        rawText
      };
}

export function serializeError(
  error: unknown,
  includeStack: boolean
): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message,
      ...(includeStack && error.stack ? { stack: error.stack } : {})
    };
  }

  return {
    errorName: "UnknownError",
    errorMessage: String(error)
  };
}

function sanitizeValue(value: unknown, maxTextLength: number): unknown {
  if (typeof value === "string") {
    return truncateString(value, maxTextLength).text;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValue(entry, maxTextLength));
  }

  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        sanitizeValue(nestedValue, maxTextLength)
      ])
    );
  }

  return value;
}

function truncateString(
  value: string,
  maxTextLength: number
): { text: string; truncated: boolean } {
  if (value.length <= maxTextLength) {
    return {
      text: value,
      truncated: false
    };
  }

  return {
    text: value.slice(0, maxTextLength),
    truncated: true
  };
}
