import {
  capabilityFlagsFor,
  type LLMProvider,
  type ProviderCapability,
  type ProviderHealthResult,
  type ProviderRequest,
  type ProviderResponse
} from "./types.js";

export type MockProviderOptions = {
  name?: string;
  rawText?: string;
  finishReason?: ProviderResponse["finishReason"];
  usage?: ProviderResponse["usage"];
};

const MOCK_CAPABILITIES: ProviderCapability = {
  supportsJsonObject: true,
  supportsSystemRole: true,
  supportsAssistantRole: true,
  recommendedTimeoutMs: 1,
  supportsMockFallback: true
};

export function createMockProvider(
  options: MockProviderOptions = {}
): LLMProvider {
  return new MockProvider(options);
}

class MockProvider implements LLMProvider {
  readonly #name: string;
  readonly #options: MockProviderOptions;

  constructor(options: MockProviderOptions) {
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
    return {
      requestId: request.requestId,
      providerName: this.#name,
      modelRef: request.modelRef,
      finishReason: this.#options.finishReason ?? "stop",
      rawText: this.#options.rawText ?? getDefaultMockText(request),
      usage: this.#options.usage,
      capabilityFlags: capabilityFlagsFor(MOCK_CAPABILITIES)
    };
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
