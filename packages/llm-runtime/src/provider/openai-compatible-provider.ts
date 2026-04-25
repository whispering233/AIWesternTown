import {
  capabilityFlagsFor,
  createProviderErrorResponse,
  type FetchLike,
  type LLMProvider,
  type ProviderCapability,
  type ProviderHealthResult,
  type ProviderRequest,
  type ProviderResponse
} from "./types.js";

export type OpenAICompatibleProviderOptions = {
  name: string;
  baseUrl: string;
  apiKey?: string;
  headers?: HeadersInit;
  fetchFn?: FetchLike;
  chatCompletionsPath?: string;
  healthPath?: string;
  capabilities?: Partial<ProviderCapability>;
};

type OpenAIChatChoice = {
  message?: {
    content?: string | null;
  };
  text?: string | null;
  finish_reason?: string | null;
};

type OpenAIChatCompletionPayload = {
  choices?: OpenAIChatChoice[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
};

const OPENAI_COMPATIBLE_CAPABILITIES: ProviderCapability = {
  supportsJsonObject: true,
  supportsSystemRole: true,
  supportsAssistantRole: true,
  recommendedTimeoutMs: 10_000
};

export class OpenAICompatibleProvider implements LLMProvider {
  readonly #options: OpenAICompatibleProviderOptions;
  readonly #capabilities: ProviderCapability;

  constructor(options: OpenAICompatibleProviderOptions) {
    this.#options = options;
    this.#capabilities = {
      ...OPENAI_COMPATIBLE_CAPABILITIES,
      ...options.capabilities
    };
  }

  getName(): string {
    return this.#options.name;
  }

  getCapabilities(): ProviderCapability {
    return this.#capabilities;
  }

  async invoke(request: ProviderRequest): Promise<ProviderResponse> {
    const fetchFn = resolveFetch(this.#options.fetchFn);

    if (!fetchFn) {
      return createProviderErrorResponse(
        request,
        this.getName(),
        "provider_fetch_unavailable",
        "Fetch API is not available in this runtime."
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, request.timeoutMs);

    try {
      const response = await fetchFn(
        joinProviderUrl(
          this.#options.baseUrl,
          this.#options.chatCompletionsPath ??
            getDefaultOpenAIPath(this.#options.baseUrl, "/chat/completions")
        ),
        {
          method: "POST",
          headers: this.#buildHeaders(),
          body: JSON.stringify(createChatCompletionBody(request)),
          signal: controller.signal
        }
      );
      const responseText = await response.text();

      if (!response.ok) {
        return createProviderErrorResponse(
          request,
          this.getName(),
          "provider_http_error",
          `Model service returned ${response.status} ${response.statusText}: ${responseText}`
        );
      }

      return this.#mapCompletionResponse(request, responseText);
    } catch (error) {
      if (isAbortError(error)) {
        return createProviderErrorResponse(
          request,
          this.getName(),
          "provider_timeout",
          `Model service timed out after ${request.timeoutMs}ms.`,
          "timeout"
        );
      }

      return createProviderErrorResponse(
        request,
        this.getName(),
        "provider_network_error",
        getErrorMessage(error)
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  async healthCheck(): Promise<ProviderHealthResult> {
    const fetchFn = resolveFetch(this.#options.fetchFn);

    if (!fetchFn) {
      return {
        providerName: this.getName(),
        ok: false,
        errorCode: "provider_fetch_unavailable",
        errorMessage: "Fetch API is not available in this runtime."
      };
    }

    const startedAt = Date.now();

    try {
      const response = await fetchFn(
        joinProviderUrl(
          this.#options.baseUrl,
          this.#options.healthPath ??
            getDefaultOpenAIPath(this.#options.baseUrl, "/models")
        ),
        {
          method: "GET",
          headers: this.#buildHeaders(false)
        }
      );
      const responseText = await response.text();
      const errorPayloadMessage = getOpenAIErrorPayloadMessage(responseText);
      const isHealthy = response.ok && !errorPayloadMessage;

      return {
        providerName: this.getName(),
        ok: isHealthy,
        latencyMs: Date.now() - startedAt,
        errorCode: isHealthy ? undefined : "provider_health_error",
        errorMessage: isHealthy
          ? undefined
          : errorPayloadMessage ??
            `Model service returned ${response.status} ${response.statusText}.`
      };
    } catch (error) {
      return {
        providerName: this.getName(),
        ok: false,
        latencyMs: Date.now() - startedAt,
        errorCode: "provider_network_error",
        errorMessage: getErrorMessage(error)
      };
    }
  }

  #mapCompletionResponse(
    request: ProviderRequest,
    responseText: string
  ): ProviderResponse {
    const payload = parseOpenAICompletionPayload(responseText);
    const firstChoice = payload?.choices?.[0];
    const rawText = firstChoice?.message?.content ?? firstChoice?.text;

    if (typeof rawText !== "string") {
      return createProviderErrorResponse(
        request,
        this.getName(),
        "provider_invalid_response",
        "Model service response did not include a text completion."
      );
    }

    return {
      requestId: request.requestId,
      providerName: this.getName(),
      modelRef: request.modelRef,
      finishReason: firstChoice?.finish_reason === "length" ? "length" : "stop",
      rawText,
      usage:
        payload?.usage &&
        (payload.usage.prompt_tokens !== undefined ||
          payload.usage.completion_tokens !== undefined)
          ? {
              inputTokens: payload.usage.prompt_tokens,
              outputTokens: payload.usage.completion_tokens
            }
          : undefined,
      capabilityFlags: capabilityFlagsFor(this.#capabilities)
    };
  }

  #buildHeaders(includeContentType = true): Headers {
    const headers = new Headers(this.#options.headers);

    if (includeContentType) {
      headers.set("content-type", "application/json");
    }

    if (this.#options.apiKey) {
      headers.set("authorization", `Bearer ${this.#options.apiKey}`);
    }

    return headers;
  }
}

function createChatCompletionBody(request: ProviderRequest): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: request.modelRef,
    messages: request.messages,
    max_tokens: request.maxOutputTokens,
    temperature: request.temperature,
    stream: false
  };

  if (request.topP !== undefined) {
    body.top_p = request.topP;
  }

  if (request.responseFormat === "json_object") {
    body.response_format = {
      type: "json_object"
    };
  }

  return body;
}

function parseOpenAICompletionPayload(
  responseText: string
): OpenAIChatCompletionPayload | undefined {
  try {
    const parsed: unknown = JSON.parse(responseText);

    if (!isRecord(parsed)) {
      return undefined;
    }

    return parsed as OpenAIChatCompletionPayload;
  } catch {
    return undefined;
  }
}

function joinProviderUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const normalizedPath = path.replace(/^\/+/, "");

  return new URL(normalizedPath, normalizedBase).toString();
}

function getDefaultOpenAIPath(baseUrl: string, resourcePath: string): string {
  const basePath = new URL(baseUrl).pathname.replace(/\/+$/, "");

  return basePath.endsWith("/v1") ? resourcePath : `/v1${resourcePath}`;
}

function resolveFetch(fetchFn: FetchLike | undefined): FetchLike | undefined {
  return fetchFn ?? globalThis.fetch;
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getOpenAIErrorPayloadMessage(responseText: string): string | undefined {
  try {
    const parsed: unknown = JSON.parse(responseText);

    if (!isRecord(parsed) || !("error" in parsed)) {
      return undefined;
    }

    const error = parsed.error;

    if (typeof error === "string") {
      return error;
    }

    if (isRecord(error) && typeof error.message === "string") {
      return error.message;
    }

    return "Model service returned an error payload.";
  } catch {
    return undefined;
  }
}
