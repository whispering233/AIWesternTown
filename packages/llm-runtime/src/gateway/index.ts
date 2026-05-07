import {
  createCloudProviderPlaceholder,
  createLocalProvider,
  createMockProvider,
  type CloudProviderPlaceholderOptions,
  type LLMProvider,
  type LLMProviderKind,
  type LocalProviderOptions,
  type MockProviderOptions,
  type ProviderHealthResult,
  type ProviderRequest,
  type ProviderResponse
} from "../provider/index.js";
import type {
  LLMLoggingConfig,
  Logger
} from "@ai-western-town/observability";

export type {
  LLMProvider,
  LLMProviderKind,
  ProviderHealthResult,
  ProviderRequest,
  ProviderResponse
} from "../provider/index.js";

export type LLMGatewayConfig = {
  provider: LLMProviderKind;
  mock?: MockProviderOptions;
  local?: LocalProviderOptions;
  cloud?: CloudProviderPlaceholderOptions;
};

export type LLMGatewayEnv = Partial<Record<string, string | undefined>>;
export type CreateLLMGatewayOptions = {
  logger?: Logger;
  llmLogging?: LLMLoggingConfig & {
    enabled: boolean;
  };
};

export interface LLMGateway {
  getProvider(): LLMProvider;
  invoke(request: ProviderRequest): Promise<ProviderResponse>;
  healthCheck(): Promise<ProviderHealthResult>;
}

const DEFAULT_LOCAL_BASE_URL = "http://127.0.0.1:1234/v1";

export function createLLMGateway(
  config: LLMGatewayConfig,
  options: CreateLLMGatewayOptions = {}
): LLMGateway {
  return new DefaultLLMGateway(createProviderFromConfig(config, options));
}

export function createProviderFromConfig(
  config: LLMGatewayConfig,
  options: CreateLLMGatewayOptions = {}
): LLMProvider {
  switch (config.provider) {
    case "mock":
      return createMockProvider({
        ...(config.mock ?? {}),
        logger: options.logger?.child({
          module: "llm-runtime",
          provider: "mock"
        }),
        llmLogging: options.llmLogging
      });
    case "local":
      return createLocalProvider({
        ...(config.local ?? {
          baseUrl: DEFAULT_LOCAL_BASE_URL
        }),
        logger: options.logger?.child({
          module: "llm-runtime",
          provider: "local"
        }),
        llmLogging: options.llmLogging
      });
    case "cloud":
      return createCloudProviderPlaceholder(config.cloud);
  }
}

export function createLLMGatewayConfigFromEnv(
  env: LLMGatewayEnv = process.env
): LLMGatewayConfig {
  const provider = normalizeProviderKind(env.LLM_PROVIDER ?? "mock");

  switch (provider) {
    case "mock":
      return {
        provider,
        mock: {
          rawText: env.LLM_MOCK_RESPONSE
        }
      };
    case "local":
      return {
        provider,
        local: {
          baseUrl: env.LLM_LOCAL_BASE_URL ?? DEFAULT_LOCAL_BASE_URL,
          apiKey: env.LLM_LOCAL_API_KEY,
          name: env.LLM_LOCAL_PROVIDER_NAME
        }
      };
    case "cloud":
      return {
        provider,
        cloud: {
          name: env.LLM_CLOUD_PROVIDER_NAME
        }
      };
  }
}

class DefaultLLMGateway implements LLMGateway {
  readonly #provider: LLMProvider;

  constructor(provider: LLMProvider) {
    this.#provider = provider;
  }

  getProvider(): LLMProvider {
    return this.#provider;
  }

  invoke(request: ProviderRequest): Promise<ProviderResponse> {
    return this.#provider.invoke(request);
  }

  healthCheck(): Promise<ProviderHealthResult> {
    return this.#provider.healthCheck();
  }
}

function normalizeProviderKind(value: string): LLMProviderKind {
  if (value === "mock" || value === "local" || value === "cloud") {
    return value;
  }

  throw new Error(
    `Unsupported LLM_PROVIDER "${value}". Expected mock, local, or cloud.`
  );
}
