import { Timestamp, type DocumentData } from 'firebase/firestore';

export class InvalidFirestoreDocumentError extends Error {
  constructor(
    readonly documentPath: string,
    readonly field: string,
    expectation: string,
  ) {
    super(
      `Invalid Firestore document at "${documentPath}": "${field}" must be ${expectation}.`,
    );
    this.name = 'InvalidFirestoreDocumentError';
  }
}

function invalid(path: string, field: string, expectation: string): never {
  throw new InvalidFirestoreDocumentError(path, field, expectation);
}

export function readString(
  data: DocumentData,
  field: string,
  path: string,
): string {
  const value = data[field];
  return typeof value === 'string' ? value : invalid(path, field, 'a string');
}

export function readNonEmptyString(
  data: DocumentData,
  field: string,
  path: string,
): string {
  const value = readString(data, field, path).trim();
  return value.length > 0 ? value : invalid(path, field, 'a non-empty string');
}

export function readNullableString(
  data: DocumentData,
  field: string,
  path: string,
): string | null {
  const value = data[field];
  return value === null
    ? null
    : typeof value === 'string'
      ? value
      : invalid(path, field, 'a string or null');
}

export function readOptionalNullableString(
  data: DocumentData,
  field: string,
  path: string,
): string | null | undefined {
  return data[field] === undefined
    ? undefined
    : readNullableString(data, field, path);
}

export function readBoolean(
  data: DocumentData,
  field: string,
  path: string,
): boolean {
  const value = data[field];
  return typeof value === 'boolean' ? value : invalid(path, field, 'a boolean');
}

export function readNumber(
  data: DocumentData,
  field: string,
  path: string,
): number {
  const value = data[field];
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : invalid(path, field, 'a finite number');
}

export function readNullableNumber(
  data: DocumentData,
  field: string,
  path: string,
): number | null {
  return data[field] === null ? null : readNumber(data, field, path);
}

export function readOptionalNullableNumber(
  data: DocumentData,
  field: string,
  path: string,
): number | null | undefined {
  return data[field] === undefined
    ? undefined
    : readNullableNumber(data, field, path);
}

export function readTimestamp(
  data: DocumentData,
  field: string,
  path: string,
): Timestamp {
  const value = data[field];
  return value instanceof Timestamp
    ? value
    : invalid(path, field, 'a Firestore Timestamp');
}

export function readNullableTimestamp(
  data: DocumentData,
  field: string,
  path: string,
): Timestamp | null {
  return data[field] === null ? null : readTimestamp(data, field, path);
}

export function readOptionalNullableTimestamp(
  data: DocumentData,
  field: string,
  path: string,
): Timestamp | null | undefined {
  return data[field] === undefined
    ? undefined
    : readNullableTimestamp(data, field, path);
}

export function readEnum<const T extends string>(
  data: DocumentData,
  field: string,
  path: string,
  values: readonly T[],
): T {
  const value = data[field];
  return typeof value === 'string' && values.includes(value as T)
    ? (value as T)
    : invalid(path, field, `one of: ${values.join(', ')}`);
}

export function readOptionalEnum<const T extends string>(
  data: DocumentData,
  field: string,
  path: string,
  values: readonly T[],
): T | undefined {
  return data[field] === undefined
    ? undefined
    : readEnum(data, field, path, values);
}

export function readStringArray(
  data: DocumentData,
  field: string,
  path: string,
): string[] {
  const value = data[field];
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
    ? value
    : invalid(path, field, 'an array of strings');
}

export function readNumberMap(
  data: DocumentData,
  field: string,
  path: string,
): Record<string, number> {
  const value: unknown = data[field];
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    !Object.values(value).every(
      (item) => typeof item === 'number' && Number.isFinite(item),
    )
  ) {
    return invalid(path, field, 'a map of finite numbers');
  }
  return value as Record<string, number>;
}

export function readObject(
  data: DocumentData,
  field: string,
  path: string,
): Record<string, unknown> {
  const value: unknown = data[field];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return invalid(path, field, 'an object');
  }
  return value as Record<string, unknown>;
}
