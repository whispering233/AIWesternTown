import type {
  BudgetLevel,
  CompiledMessage,
  LLMCallTrace,
  Metadata,
  ProviderRequest,
  ProviderResponse,
  TaskKind
} from "@ai-western-town/contracts";

export type LLMInspectorCallRecordMessage = {
  role: CompiledMessage["role"];
  contentLength: number;
  contentPreview: string;
};

export type LLMInspectorCallRecordRequest = {
  taskKind: ProviderRequest["taskKind"];
  mode: ProviderRequest["mode"];
  modelRef: string;
  responseFormat?: ProviderRequest["responseFormat"];
  maxInputTokens: number;
  maxOutputTokens: number;
  temperature: number;
  topP?: number;
  timeoutMs: number;
  messages: LLMInspectorCallRecordMessage[];
};

export type LLMInspectorCallRecordResponse = {
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

export type LLMInspectorCallRecord = {
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
  request: LLMInspectorCallRecordRequest;
  response: LLMInspectorCallRecordResponse;
  trace: LLMCallTrace & {
    budgetLevel?: BudgetLevel;
  };
  metadata: Metadata;
  persisted: boolean;
};

export type LLMDebugPanelModel = {
  title: string;
  description: string;
  emptyMessage: string;
  calls: LLMDebugCallSummary[];
  selectedCall?: LLMDebugCallDetail;
};

export type LLMDebugCallSummary = {
  recordId: string;
  traceId: string;
  requestId: string;
  taskKind: TaskKind;
  stageName: string;
  providerLabel: string;
  statusLabel: string;
  startedAtLabel: string;
  durationLabel: string;
  worldTickLabel: string;
  npcLabel: string;
  isSelected: boolean;
};

export type LLMDebugCallDetail = {
  recordId: string;
  traceId: string;
  requestId: string;
  title: string;
  subtitle: string;
  prompt: LLMDebugPromptView;
  rawOutput: LLMDebugRawOutputView;
  parsedFallback: LLMDebugParsedFallbackView;
};

export type LLMDebugPromptView = {
  messageCountLabel: string;
  budgetLabel: string;
  messages: LLMDebugPromptMessageView[];
};

export type LLMDebugPromptMessageView = {
  role: CompiledMessage["role"];
  contentLengthLabel: string;
  contentPreview: string;
};

export type LLMDebugRawOutputView = {
  finishReasonLabel: string;
  providerLabel: string;
  tokenUsageLabel: string;
  rawTextLengthLabel: string;
  rawTextPreview: string;
  errorLabel?: string;
};

export type LLMDebugParsedFallbackView = {
  invocationDecision: string;
  parseResult: string;
  fallbackReason: string;
  trimmedBlocksLabel: string;
  persistedLabel: string;
};

export type BuildLLMDebugPanelModelOptions = {
  maxCalls?: number;
  selectedRecordId?: string;
  selectedTraceId?: string;
  selectedRequestId?: string;
};

const DEFAULT_MAX_CALLS = 50;

export function buildLLMDebugPanelModel(
  records: LLMInspectorCallRecord[],
  options: BuildLLMDebugPanelModelOptions = {}
): LLMDebugPanelModel {
  const recentRecords = sortRecentFirst(records).slice(
    0,
    normalizeMaxCalls(options.maxCalls)
  );
  const selectedRecord = selectRecord(recentRecords, options) ?? recentRecords[0];

  return {
    title: "LLM Calls",
    description: `${recentRecords.length} recent call${recentRecords.length === 1 ? "" : "s"} from the recorder buffer.`,
    emptyMessage: "No LLM calls recorded yet.",
    calls: recentRecords.map((record) =>
      toCallSummary(record, record.recordId === selectedRecord?.recordId)
    ),
    selectedCall: selectedRecord ? toCallDetail(selectedRecord) : undefined
  };
}

function sortRecentFirst(
  records: LLMInspectorCallRecord[]
): LLMInspectorCallRecord[] {
  return records
    .map((record, index) => ({ record, index }))
    .sort((left, right) => {
      const rightStartedAt = toTimestamp(right.record.startedAt);
      const leftStartedAt = toTimestamp(left.record.startedAt);

      if (rightStartedAt !== leftStartedAt) {
        return rightStartedAt - leftStartedAt;
      }

      return right.index - left.index;
    })
    .map((entry) => entry.record);
}

function normalizeMaxCalls(value: number | undefined): number {
  return Math.max(1, Math.floor(value ?? DEFAULT_MAX_CALLS));
}

function selectRecord(
  records: LLMInspectorCallRecord[],
  options: BuildLLMDebugPanelModelOptions
): LLMInspectorCallRecord | undefined {
  return records.find((record) => {
    if (
      options.selectedRecordId !== undefined &&
      record.recordId === options.selectedRecordId
    ) {
      return true;
    }

    if (
      options.selectedTraceId !== undefined &&
      record.traceId === options.selectedTraceId
    ) {
      return true;
    }

    return (
      options.selectedRequestId !== undefined &&
      record.requestId === options.selectedRequestId
    );
  });
}

function toCallSummary(
  record: LLMInspectorCallRecord,
  isSelected: boolean
): LLMDebugCallSummary {
  return {
    recordId: record.recordId,
    traceId: record.traceId,
    requestId: record.requestId,
    taskKind: record.taskKind,
    stageName: record.stageName,
    providerLabel: formatProvider(record),
    statusLabel: getStatusLabel(record),
    startedAtLabel: record.startedAt,
    durationLabel: `${record.durationMs}ms`,
    worldTickLabel:
      record.worldTick === undefined ? "Tick n/a" : `Tick ${record.worldTick}`,
    npcLabel: record.npcId ?? "global",
    isSelected
  };
}

function toCallDetail(record: LLMInspectorCallRecord): LLMDebugCallDetail {
  return {
    recordId: record.recordId,
    traceId: record.traceId,
    requestId: record.requestId,
    title: `${record.taskKind} / ${record.stageName}`,
    subtitle: formatProvider(record),
    prompt: {
      messageCountLabel: `${record.request.messages.length} messages`,
      budgetLabel: `${record.request.maxInputTokens} in / ${record.request.maxOutputTokens} out`,
      messages: record.request.messages.map((message) => ({
        role: message.role,
        contentLengthLabel: `${message.contentLength} chars`,
        contentPreview: message.contentPreview
      }))
    },
    rawOutput: {
      finishReasonLabel: record.response.finishReason,
      providerLabel: formatProvider(record),
      tokenUsageLabel: formatTokenUsage(record.response.usage),
      rawTextLengthLabel: `${record.response.rawTextLength} chars`,
      rawTextPreview: record.response.rawTextPreview,
      errorLabel: formatError(record.response)
    },
    parsedFallback: {
      invocationDecision: record.invocationDecision,
      parseResult: record.trace.parseResult ?? "not_recorded",
      fallbackReason: record.trace.fallbackReason ?? "none",
      trimmedBlocksLabel: formatList(record.trace.trimmedBlocks),
      persistedLabel: record.persisted ? "persisted" : "memory only"
    }
  };
}

function getStatusLabel(record: LLMInspectorCallRecord): string {
  if (record.trace.fallbackReason) {
    return "fallback";
  }

  if (record.trace.parseResult && record.trace.parseResult !== "success") {
    return "parse";
  }

  if (
    record.response.finishReason === "error" ||
    record.response.finishReason === "timeout"
  ) {
    return record.response.finishReason;
  }

  return "success";
}

function formatProvider(record: LLMInspectorCallRecord): string {
  return `${record.response.providerName} / ${record.response.modelRef}`;
}

function formatTokenUsage(
  usage: ProviderResponse["usage"] | undefined
): string {
  const inputTokens = usage?.inputTokens;
  const outputTokens = usage?.outputTokens;

  if (inputTokens === undefined && outputTokens === undefined) {
    return "usage n/a";
  }

  return `${inputTokens ?? "n/a"} in / ${outputTokens ?? "n/a"} out`;
}

function formatError(response: LLMInspectorCallRecordResponse): string | undefined {
  if (!response.errorCode && !response.errorMessage) {
    return undefined;
  }

  return [response.errorCode, response.errorMessage].filter(Boolean).join(": ");
}

function formatList(values: string[] | undefined): string {
  return values && values.length > 0 ? values.join(", ") : "none";
}

function toTimestamp(value: string): number {
  const timestamp = Date.parse(value);

  return Number.isNaN(timestamp) ? 0 : timestamp;
}
