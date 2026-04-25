import {
  createProviderErrorResponse,
  type LLMProvider,
  type ProviderCapability,
  type ProviderHealthResult,
  type ProviderRequest,
  type ProviderResponse
} from "./types.js";

export type CloudProviderPlaceholderOptions = {
  name?: string;
};

const CLOUD_PLACEHOLDER_CAPABILITIES: ProviderCapability = {
  supportsJsonObject: true,
  supportsSystemRole: true,
  supportsAssistantRole: true
};

export function createCloudProviderPlaceholder(
  options: CloudProviderPlaceholderOptions = {}
): LLMProvider {
  return new CloudProviderPlaceholder(options);
}

class CloudProviderPlaceholder implements LLMProvider {
  readonly #name: string;

  constructor(options: CloudProviderPlaceholderOptions) {
    this.#name = options.name ?? "cloud";
  }

  getName(): string {
    return this.#name;
  }

  getCapabilities(): ProviderCapability {
    return CLOUD_PLACEHOLDER_CAPABILITIES;
  }

  async invoke(request: ProviderRequest): Promise<ProviderResponse> {
    return createProviderErrorResponse(
      request,
      this.#name,
      "cloud_provider_not_configured",
      "Cloud provider adapter is a placeholder and is not configured."
    );
  }

  async healthCheck(): Promise<ProviderHealthResult> {
    return {
      providerName: this.#name,
      ok: false,
      errorCode: "cloud_provider_not_configured",
      errorMessage: "Cloud provider adapter is a placeholder and is not configured."
    };
  }
}
