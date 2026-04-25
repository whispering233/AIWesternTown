import type {
  BudgetLevel,
  CompiledMessage,
  LLMCallTrace,
  Metadata,
  ProviderRequest,
  ProviderResponse
} from "@ai-western-town/contracts";

export type LLMRecorderIdPrefix = "llm-trace" | "llm-record";

export type LLMRecorderIdFactory = (
  prefix: LLMRecorderIdPrefix
) => string;

export type LLMCallRecordMessage = {
  role: CompiledMessage["role"];
  contentLength: number;
  contentPreview: string;
};

export type LLMCallRecordRequest = {
  taskKind: ProviderRequest["taskKind"];
  mode: ProviderRequest["mode"];
  modelRef: string;
  responseFormat?: ProviderRequest["responseFormat"];
  maxInputTokens: number;
  maxOutputTokens: number;
  temperature: number;
  topP?: number;
  timeoutMs: number;
  messages: LLMCallRecordMessage[];
};

export type LLMCallRecordResponse = {
  providerName: string;
  modelRef: string;
  finishReason: ProviderResponse["finishReason"];
  rawTextLength: number;
  rawTextPreview: string;
  usage?: ProviderResponse["usage"];
  capabilityFlags?: string[];
  errorCode?: string;
  errorMessage?: string;
};

export type LLMCallRecordReplay = {
  request: ProviderRequest;
  response: ProviderResponse;
};

export type RecordLLMInvocationInput = {
  request: ProviderRequest;
  traceId?: string;
  stageName: string;
  invocationDecision: string;
  worldTick?: number;
  npcId?: string;
  builderName?: string;
  budgetLevel?: BudgetLevel;
  trimmedBlocks?: string[];
  parseResult?: string;
  fallbackReason?: string;
  tags?: string[];
  metadata?: Metadata;
  persist?: boolean;
};

export type LLMCallRecord = {
  recordId: string;
  traceId: string;
  requestId: string;
  taskKind: ProviderRequest["taskKind"];
  stageName: string;
  invocationDecision: string;
  worldTick?: number;
  npcId?: string;
  tags: string[];
  startedAt: string;
  completedAt: string;
  durationMs: number;
  request: LLMCallRecordRequest;
  response: LLMCallRecordResponse;
  replay: LLMCallRecordReplay;
  trace: LLMCallTrace;
  metadata: Metadata;
  persisted: boolean;
};

export type LLMCallRecordSink = {
  append(record: LLMCallRecord): void | Promise<void>;
};

export type LLMCallRecorderOptions = {
  maxEntries?: number;
  maxTextPreviewChars?: number;
  idFactory?: LLMRecorderIdFactory;
  now?: () => Date;
  sink?: LLMCallRecordSink;
};

export interface LLMCallRecorder {
  recordInvocation(
    input: RecordLLMInvocationInput,
    invoke: (request: ProviderRequest) => Promise<ProviderResponse>
  ): Promise<ProviderResponse>;
  getRecentCalls(): LLMCallRecord[];
  clear(): void;
}
