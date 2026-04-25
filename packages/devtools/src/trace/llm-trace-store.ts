import type { LLMCallTrace, TickTraceRecord } from "@ai-western-town/contracts";

export type LLMTraceStoreOptions = {
  maxEntries?: number;
};

export class LLMTraceStore {
  readonly #maxEntries: number;
  readonly #llmTraces: LLMCallTrace[] = [];

  public constructor(options: LLMTraceStoreOptions = {}) {
    this.#maxEntries = Math.max(1, options.maxEntries ?? 200);
  }

  public appendLLMTrace(trace: LLMCallTrace): LLMCallTrace {
    this.#llmTraces.push(trace);

    while (this.#llmTraces.length > this.#maxEntries) {
      this.#llmTraces.shift();
    }

    return trace;
  }

  public listRecentLLMTraces(): LLMCallTrace[] {
    return [...this.#llmTraces];
  }

  public getLLMTraceByTraceId(traceId: string): LLMCallTrace | undefined {
    return this.#llmTraces.find((trace) => trace.traceId === traceId);
  }

  public getLLMTraceByRequestId(requestId: string): LLMCallTrace | undefined {
    return this.#llmTraces.find(
      (trace) => trace.metadata?.requestId === requestId
    );
  }

  public clear(): void {
    this.#llmTraces.length = 0;
  }
}

export function createLLMTraceStore(
  options: LLMTraceStoreOptions = {}
): LLMTraceStore {
  return new LLMTraceStore(options);
}

export function linkLLMTraceToTickTrace(
  tickTrace: TickTraceRecord,
  llmTraceId: string
): TickTraceRecord {
  const llmTraceIds = tickTrace.llmTraceIds ?? [];

  if (llmTraceIds.includes(llmTraceId)) {
    return {
      ...tickTrace,
      llmTraceIds
    };
  }

  return {
    ...tickTrace,
    llmTraceIds: [...llmTraceIds, llmTraceId]
  };
}
