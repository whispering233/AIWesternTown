export function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}

export function uniqueStrings(values: Iterable<string | undefined>): string[] {
  const seen = new Set<string>();

  for (const value of values) {
    if (value) {
      seen.add(value);
    }
  }

  return [...seen];
}

export function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function maxOrZero(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return Math.max(...values);
}

export function normalizeText(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function includesAnyTerm(
  source: string | undefined,
  terms: Iterable<string | undefined>
): boolean {
  const normalizedSource = normalizeText(source);

  if (!normalizedSource) {
    return false;
  }

  for (const term of terms) {
    const normalizedTerm = normalizeText(term);
    if (normalizedTerm && normalizedSource.includes(normalizedTerm)) {
      return true;
    }
  }

  return false;
}

export function overlaps(
  left: Iterable<string | undefined>,
  right: Iterable<string | undefined>
): boolean {
  const rightSet = new Set(
    [...right].map((value) => normalizeText(value)).filter(Boolean)
  );

  if (rightSet.size === 0) {
    return false;
  }

  for (const value of left) {
    const normalized = normalizeText(value);
    if (normalized && rightSet.has(normalized)) {
      return true;
    }
  }

  return false;
}

export function buildStageId(prefix: string, tick: number, index: number): string {
  return `${prefix}-${tick}-${index + 1}`;
}
