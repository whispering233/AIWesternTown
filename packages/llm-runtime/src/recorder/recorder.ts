import { randomUUID } from "node:crypto";

import type { LLMCallTrace, Metadata, ProviderResponse } from "@ai-western-town/contracts";

import type {
  LLMCallRecord,
  LLMCallRecorder,
  LLMCallRecorderOptions,
  LLMCallRecordRequest,
  LLMCallRecordResponse,
  LLMRecorderIdFactory,
  RecordLLMInvocationInput
} from "./types.js";

const DEFAULT_MAX_ENTRIES = 200;
const DEFAULT_TEXT_PREVIEW_CHARS = 240;

export function createLLMCallRecorder(
  options: LLMCallRecorderOptions = {}
): LLMCallRecorder {
  return new DefaultLLMCallRecorder(options);
}

class DefaultLLMCallRecorder implements LLMCallRecorder {
  readonly #maxEntries: number;
  readonly #maxTextPreviewChars: number;
  readonly #idFactory: LLMRecorderIdFactory;
  readonly #now: () => Date;
  readonly #sink: LLMCallRecorderOptions["sink"];
  readonly #records: LLMCallRecord[] = [];

  public constructor(options: LLMCallRecorderOptions) {
    this.#maxEntries = Math.max(1, options.maxEntries ?? DEFAULT_MAX_ENTRIES);
    this.#maxTextPreviewChars = Math.max(
      0,
      options.maxTextPreviewChars ?? DEFAULT_TEXT_PREVIEW_CHARS
    );
    this.#idFactory = options.idFactory ?? createDefaultId;
    this.#now = options.now ?? (() => new Date());
    this.#sink = options.sink;
  }

  public async recordInvocation(
    input: RecordLLMInvocationInput,
    invoke: Parameters<LLMCallRecorder["recordInvocation"]>[1]
  ): Promise<ProviderResponse> {
    const traceId = input.traceId ?? this.#idFactory("llm-trace");
    const recordId = this.#idFactory("llm-record");
    const startedAtDate = this.#now();
    const response = await invoke(input.request);
    const completedAtDate = this.#now();
    const durationMs = Math.max(
      0,
      completedAtDate.getTime() - startedAtDate.getTime()
    );
    const persisted = input.persist === true;
    const metadata: Metadata = {
      ...(input.metadata ?? {}),
      requestId: input.request.requestId,
      durationMs,
      responseRawTextLength: response.rawText.length,
      persisted
    };
    const trace = createLLMCallTrace(input, response, traceId, metadata);
    const record: LLMCallRecord = {
      recordId,
      traceId,
      requestId: input.request.requestId,
      taskKind: input.request.taskKind,
      stageName: input.stageName,
      invocationDecision: input.invocationDecision,
      worldTick: input.worldTick,
      npcId: input.npcId,
      tags: input.tags ?? [],
      startedAt: startedAtDate.toISOString(),
      completedAt: completedAtDate.toISOString(),
      durationMs,
      request: summarizeRequest(input, this.#maxTextPreviewChars),
      response: summarizeResponse(response, this.#maxTextPreviewChars),
      replay: {
        request: cloneJson(input.request),
        response: cloneJson(response)
      },
      trace,
      metadata,
      persisted
    };

    this.#appendRecent(record);

    if (persisted) {
      await this.#sink?.append(record);
    }

    return response;
  }

  public getRecentCalls(): LLMCallRecord[] {
    return [...this.#records];
  }

  public clear(): void {
    this.#records.length = 0;
  }

  #appendRecent(record: LLMCallRecord): void {
    this.#records.push(record);

    while (this.#records.length > this.#maxEntries) {
      this.#records.shift();
    }
  }
}

function createLLMCallTrace(
  input: RecordLLMInvocationInput,
  response: ProviderResponse,
  traceId: string,
  metadata: Metadata
): LLMCallTrace {
  return {
    traceId,
    taskKind: input.request.taskKind,
    stageName: input.stageName,
    invocationDecision: input.invocationDecision,
    builderName: input.builderName,
    budgetLevel: input.budgetLevel,
    trimmedBlocks: input.trimmedBlocks,
    providerName: response.providerName,
    modelRef: response.modelRef,
    finishReason: response.finishReason,
    parseResult: input.parseResult,
    fallbackReason: input.fallbackReason,
    metadata
  };
}

function summarizeRequest(
  input: RecordLLMInvocationInput,
  maxTextPreviewChars: number
): LLMCallRecordRequest {
  return {
    taskKind: input.request.taskKind,
    mode: input.request.mode,
    modelRef: input.request.modelRef,
    responseFormat: input.request.responseFormat,
    maxInputTokens: input.request.maxInputTokens,
    maxOutputTokens: input.request.maxOutputTokens,
    temperature: input.request.temperature,
    topP: input.request.topP,
    timeoutMs: input.request.timeoutMs,
    messages: input.request.messages.map((message) => ({
      role: message.role,
      contentLength: message.content.length,
      contentPreview: previewText(message.content, maxTextPreviewChars)
    }))
  };
}

function summarizeResponse(
  response: ProviderResponse,
  maxTextPreviewChars: number
): LLMCallRecordResponse {
  return {
    providerName: response.providerName,
    modelRef: response.modelRef,
    finishReason: response.finishReason,
    rawTextLength: response.rawText.length,
    rawTextPreview: previewText(response.rawText, maxTextPreviewChars),
    usage: response.usage,
    capabilityFlags: response.capabilityFlags,
    errorCode: response.errorCode,
    errorMessage: response.errorMessage
  };
}

function previewText(value: string, maxTextPreviewChars: number): string {
  if (value.length <= maxTextPreviewChars) {
    return value;
  }

  return value.slice(0, maxTextPreviewChars);
}

function createDefaultId(prefix: Parameters<LLMRecorderIdFactory>[0]): string {
  return `${prefix}-${randomUUID()}`;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
