import type { JsonObject, JsonValue } from "./types.js";

export function jsonStringify(value: JsonValue): string {
  return JSON.stringify(value);
}

export function jsonParseObject(
  value: string,
  fieldName: string
): JsonObject {
  const parsed = JSON.parse(value) as JsonValue;

  if (!isJsonObject(parsed)) {
    throw new Error(`${fieldName} must decode to a JSON object`);
  }

  return parsed;
}

export function jsonParseArray(
  value: string,
  fieldName: string
): JsonValue[] {
  const parsed = JSON.parse(value) as JsonValue;

  if (!Array.isArray(parsed)) {
    throw new Error(`${fieldName} must decode to a JSON array`);
  }

  return parsed;
}

export function jsonParseStringArray(
  value: string,
  fieldName: string
): string[] {
  const parsed = jsonParseArray(value, fieldName);

  if (!parsed.every((item) => typeof item === "string")) {
    throw new Error(`${fieldName} must decode to a string array`);
  }

  return parsed;
}

function isJsonObject(value: JsonValue): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
