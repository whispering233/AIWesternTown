import type { Metadata } from "@ai-western-town/contracts";

import {
  LLM_CALL_FIXTURE_FORMAT,
  LLM_CALL_FIXTURE_VERSION,
  type ExportLLMCallFixtureOptions,
  type LLMCallFixture,
  type LLMCallFixtureExportSource
} from "./types.js";

export function exportLLMCallFixture(
  record: LLMCallFixtureExportSource,
  options: ExportLLMCallFixtureOptions = {}
): LLMCallFixture {
  const request = cloneJson(record.replay.request);
  const response = cloneJson(record.replay.response);

  return {
    format: LLM_CALL_FIXTURE_FORMAT,
    version: LLM_CALL_FIXTURE_VERSION,
    exportedAt: options.exportedAt ?? new Date().toISOString(),
    source: {
      recordId: record.recordId,
      traceId: record.traceId,
      requestId: record.requestId,
      taskKind: record.taskKind,
      stageName: record.stageName,
      invocationDecision: record.invocationDecision,
      worldTick: record.worldTick,
      npcId: record.npcId,
      tags: [...(record.tags ?? [])],
      startedAt: record.startedAt,
      completedAt: record.completedAt,
      durationMs: record.durationMs,
      providerName: response.providerName,
      modelRef: response.modelRef,
      persisted: record.persisted
    },
    request,
    response,
    trace: cloneJson(record.trace),
    metadata: cloneJson(record.metadata ?? ({} as Metadata))
  };
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
