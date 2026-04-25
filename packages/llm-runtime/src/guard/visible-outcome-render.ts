export type VisibleOutcomeRenderResult = {
  visibleText: string;
  gestureTags?: string[];
};

export type VisibleOutcomeGuardFailureReason =
  | "schema_violation"
  | "forbidden_field"
  | "illegal_fact"
  | "too_long";

export type VisibleOutcomeGuardContext = {
  maxVisibleTextChars: number;
  allowedGestureTags?: string[];
  forbiddenFacts?: string[];
};

type VisibleOutcomeGuardFailure = {
  ok: false;
  errorReason: VisibleOutcomeGuardFailureReason;
  detail: string;
};

export type VisibleOutcomeGuardResult =
  | {
      ok: true;
      value: VisibleOutcomeRenderResult;
    }
  | VisibleOutcomeGuardFailure;

type GestureTagsGuardResult =
  | {
      ok: true;
      value?: string[];
    }
  | VisibleOutcomeGuardFailure;

const ALLOWED_OUTPUT_FIELDS = new Set(["visibleText", "gestureTags"]);

export function guardVisibleOutcomeRenderResult(
  value: unknown,
  context: VisibleOutcomeGuardContext
): VisibleOutcomeGuardResult {
  if (!isRecord(value)) {
    return fail("schema_violation", "visible outcome output must be a JSON object");
  }

  const forbiddenField = Object.keys(value).find(
    (field) => !ALLOWED_OUTPUT_FIELDS.has(field)
  );

  if (forbiddenField) {
    return fail(
      "forbidden_field",
      `visible outcome output cannot include field: ${forbiddenField}`
    );
  }

  if (typeof value.visibleText !== "string" || value.visibleText.trim() === "") {
    return fail("schema_violation", "visibleText must be a non-empty string");
  }

  const visibleText = value.visibleText.trim();

  if (visibleText.length > context.maxVisibleTextChars) {
    return fail(
      "too_long",
      `visibleText length ${visibleText.length} exceeds ${context.maxVisibleTextChars}`
    );
  }

  const forbiddenFact = findForbiddenFact(
    visibleText,
    context.forbiddenFacts ?? []
  );

  if (forbiddenFact) {
    return fail(
      "illegal_fact",
      `visibleText mentions forbidden fact: ${forbiddenFact}`
    );
  }

  const gestureTagsResult = parseGestureTags(value.gestureTags, context);

  if (!gestureTagsResult.ok) {
    return gestureTagsResult;
  }

  return {
    ok: true,
    value: {
      visibleText,
      ...(gestureTagsResult.value ? { gestureTags: gestureTagsResult.value } : {})
    }
  };
}

function parseGestureTags(
  value: unknown,
  context: VisibleOutcomeGuardContext
): GestureTagsGuardResult {
  if (value === undefined) {
    return {
      ok: true,
      value: undefined
    };
  }

  if (!Array.isArray(value)) {
    return fail("schema_violation", "gestureTags must be an array when present");
  }

  const tags: string[] = [];

  for (const tag of value) {
    if (typeof tag !== "string" || tag.trim() === "") {
      return fail("schema_violation", "gestureTags must contain non-empty strings");
    }

    const normalizedTag = tag.trim();

    if (
      context.allowedGestureTags &&
      !context.allowedGestureTags.includes(normalizedTag)
    ) {
      return fail(
        "illegal_fact",
        `gesture tag is not authorized for this result: ${normalizedTag}`
      );
    }

    if (!tags.includes(normalizedTag)) {
      tags.push(normalizedTag);
    }
  }

  return {
    ok: true,
    value: tags
  };
}

function findForbiddenFact(
  visibleText: string,
  forbiddenFacts: string[]
): string | undefined {
  const lowerVisibleText = visibleText.toLocaleLowerCase();

  return forbiddenFacts.find((fact) =>
    lowerVisibleText.includes(fact.toLocaleLowerCase())
  );
}

function fail(
  errorReason: VisibleOutcomeGuardFailureReason,
  detail: string
): VisibleOutcomeGuardFailure {
  return {
    ok: false,
    errorReason,
    detail
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
