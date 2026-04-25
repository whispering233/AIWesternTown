import type {
  LLMCallTrace,
  Metadata,
  ProviderRequest,
  ProviderResponse,
  TaskKind
} from "@ai-western-town/contracts";

export const LLM_CALL_FIXTURE_FORMAT = "ai-western-town.llm-fixture";
export const LLM_CALL_FIXTURE_VERSION = 1;

export type LLMCallFixtureSource = {
  recordId: string;
  traceId: string;
  requestId: string;
  taskKind: TaskKind;
  stageName: string;
  invocationDecision: string;
  worldTick?: number;
  npcId?: string;
  tags: string[];
  startedAt: string;
  completedAt: string;
  durationMs: number;
  providerName: string;
  modelRef: string;
  persisted: boolean;
};

export type LLMCallFixture = {
  format: typeof LLM_CALL_FIXTURE_FORMAT;
  version: typeof LLM_CALL_FIXTURE_VERSION;
  exportedAt: string;
  source: LLMCallFixtureSource;
  request: ProviderRequest;
  response: ProviderResponse;
  trace: LLMCallTrace;
  metadata: Metadata;
};

export type LLMCallFixtureExportSource = {
  recordId: string;
  traceId: string;
  requestId: string;
  taskKind: TaskKind;
  stageName: string;
  invocationDecision: string;
  worldTick?: number;
  npcId?: string;
  tags?: string[];
  startedAt: string;
  completedAt: string;
  durationMs: number;
  replay: {
    request: ProviderRequest;
    response: ProviderResponse;
  };
  trace: LLMCallTrace;
  metadata?: Metadata;
  persisted: boolean;
};

export type ExportLLMCallFixtureOptions = {
  exportedAt?: string;
};

export type LLMFixtureReplayCapability = {
  supportsJsonObject: boolean;
  supportsSystemRole: boolean;
  supportsAssistantRole: boolean;
  maxContextTokens?: number;
  recommendedTimeoutMs?: number;
  supportsMockFallback?: boolean;
};

export type LLMFixtureReplayHealthResult = {
  providerName: string;
  ok: boolean;
  latencyMs?: number;
  errorCode?: string;
  errorMessage?: string;
};

export type LLMFixtureReplayProviderOptions = {
  name?: string;
};

export interface LLMFixtureReplayProvider {
  getName(): string;
  getCapabilities(): LLMFixtureReplayCapability;
  invoke(request: ProviderRequest): Promise<ProviderResponse>;
  healthCheck(): Promise<LLMFixtureReplayHealthResult>;
}
