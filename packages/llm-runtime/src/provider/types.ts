import type {
  ProviderRequest as ContractProviderRequest,
  ProviderResponse as ContractProviderResponse
} from "@ai-western-town/contracts";

export type ProviderRequest = ContractProviderRequest;
export type ProviderResponse = ContractProviderResponse;
export type LLMProviderKind = "mock" | "local" | "cloud";

export type ProviderCapability = {
  supportsJsonObject: boolean;
  supportsSystemRole: boolean;
  supportsAssistantRole: boolean;
  maxContextTokens?: number;
  recommendedTimeoutMs?: number;
  supportsMockFallback?: boolean;
};

export type ProviderHealthResult = {
  providerName: string;
  ok: boolean;
  latencyMs?: number;
  errorCode?: string;
  errorMessage?: string;
};

export type FetchLike = (
  url: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1]
) => Promise<Response>;

export interface LLMProvider {
  getName(): string;
  getCapabilities(): ProviderCapability;
  invoke(request: ProviderRequest): Promise<ProviderResponse>;
  healthCheck(): Promise<ProviderHealthResult>;
}

export function createProviderErrorResponse(
  request: ProviderRequest,
  providerName: string,
  errorCode: string,
  errorMessage: string,
  finishReason: ProviderResponse["finishReason"] = "error"
): ProviderResponse {
  return {
    requestId: request.requestId,
    providerName,
    modelRef: request.modelRef,
    finishReason,
    rawText: "",
    errorCode,
    errorMessage
  };
}

export function capabilityFlagsFor(
  capabilities: ProviderCapability
): string[] {
  const flags: string[] = [];

  if (capabilities.supportsJsonObject) {
    flags.push("json_object");
  }

  if (capabilities.supportsSystemRole) {
    flags.push("system_role");
  }

  if (capabilities.supportsAssistantRole) {
    flags.push("assistant_role");
  }

  if (capabilities.supportsMockFallback) {
    flags.push("mock_fallback");
  }

  return flags;
}
