import {
  guardVisibleOutcomeRenderResult,
  type VisibleOutcomeGuardContext,
  type VisibleOutcomeGuardFailureReason,
  type VisibleOutcomeRenderResult
} from "../guard/index.js";

export type VisibleOutcomeRenderParseFailureReason =
  | "invalid_json"
  | VisibleOutcomeGuardFailureReason;

export type VisibleOutcomeRenderParseContext = {
  fallback: VisibleOutcomeRenderResult;
  guard: VisibleOutcomeGuardContext;
};

export type VisibleOutcomeRenderParseResult =
  | {
      ok: true;
      value: VisibleOutcomeRenderResult;
      fallbackUsed: false;
    }
  | {
      ok: false;
      errorReason: VisibleOutcomeRenderParseFailureReason;
      detail: string;
      fallback: VisibleOutcomeRenderResult;
      fallbackUsed: true;
    };

export function parseVisibleOutcomeRenderResult(
  rawText: string,
  context: VisibleOutcomeRenderParseContext
): VisibleOutcomeRenderParseResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawText);
  } catch {
    return fail("invalid_json", "provider response was not strict JSON", context);
  }

  const guarded = guardVisibleOutcomeRenderResult(parsed, context.guard);

  if (!guarded.ok) {
    return fail(guarded.errorReason, guarded.detail, context);
  }

  return {
    ok: true,
    value: guarded.value,
    fallbackUsed: false
  };
}

function fail(
  errorReason: VisibleOutcomeRenderParseFailureReason,
  detail: string,
  context: VisibleOutcomeRenderParseContext
): VisibleOutcomeRenderParseResult {
  return {
    ok: false,
    errorReason,
    detail,
    fallback: context.fallback,
    fallbackUsed: true
  };
}
