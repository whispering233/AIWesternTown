import {
  capabilityFlagsFor,
  type LLMProvider,
  type ProviderCapability,
  type ProviderHealthResult,
  type ProviderRequest,
  type ProviderResponse
} from "./types.js";
import {
  createNoopLogger,
  sanitizeLLMRequestBody,
  sanitizeLLMResponseText,
  type LLMLoggingConfig,
  type Logger
} from "@ai-western-town/observability";

export type MockProviderOptions = {
  name?: string;
  rawText?: string;
  finishReason?: ProviderResponse["finishReason"];
  usage?: ProviderResponse["usage"];
};

type MockProviderRuntimeOptions = MockProviderOptions & {
  logger?: Logger;
  llmLogging?: LLMLoggingConfig & {
    enabled: boolean;
  };
};

const MOCK_CAPABILITIES: ProviderCapability = {
  supportsJsonObject: true,
  supportsSystemRole: true,
  supportsAssistantRole: true,
  recommendedTimeoutMs: 1,
  supportsMockFallback: true
};
const DEFAULT_LLM_LOGGING_CONFIG: LLMLoggingConfig & { enabled: boolean } = {
  enabled: false,
  includeMessages: false,
  includeRawResponse: false,
  includeStack: false,
  maxTextLength: 20_000
};

export function createMockProvider(
  options: MockProviderRuntimeOptions = {}
): LLMProvider {
  return new MockProvider(options);
}

class MockProvider implements LLMProvider {
  readonly #name: string;
  readonly #options: MockProviderRuntimeOptions;

  constructor(options: MockProviderRuntimeOptions) {
    this.#name = options.name ?? "mock";
    this.#options = options;
  }

  getName(): string {
    return this.#name;
  }

  getCapabilities(): ProviderCapability {
    return MOCK_CAPABILITIES;
  }

  async invoke(request: ProviderRequest): Promise<ProviderResponse> {
    const logger = this.#options.logger ?? createNoopLogger();
    const llmLogging =
      this.#options.llmLogging ?? DEFAULT_LLM_LOGGING_CONFIG;
    const startedAt = Date.now();

    if (llmLogging.enabled) {
      logger.info({
        event: "llm.request",
        provider: this.#name,
        requestId: request.requestId,
        model: request.modelRef,
        ...sanitizeLLMRequestBody(
          {
            model: request.modelRef,
            messages: request.messages,
            responseFormat: request.responseFormat,
            maxInputTokens: request.maxInputTokens,
            maxOutputTokens: request.maxOutputTokens,
            temperature: request.temperature,
            topP: request.topP
          },
          llmLogging
        )
      });
    }

    const response = {
      requestId: request.requestId,
      providerName: this.#name,
      modelRef: request.modelRef,
      finishReason: this.#options.finishReason ?? "stop",
      rawText: this.#options.rawText ?? getDefaultMockText(request),
      usage: this.#options.usage,
      capabilityFlags: capabilityFlagsFor(MOCK_CAPABILITIES)
    };

    if (llmLogging.enabled) {
      logger.info({
        event: "llm.response",
        provider: this.#name,
        requestId: request.requestId,
        model: request.modelRef,
        durationMs: Date.now() - startedAt,
        finishReason: response.finishReason,
        usage: response.usage,
        ...sanitizeLLMResponseText(response.rawText, llmLogging)
      });
    }

    return response;
  }

  async healthCheck(): Promise<ProviderHealthResult> {
    return {
      providerName: this.#name,
      ok: true,
      latencyMs: 0
    };
  }
}

function getDefaultMockText(request: ProviderRequest): string {
  return request.responseFormat === "json_object" ? "{}" : "mock response";
}
