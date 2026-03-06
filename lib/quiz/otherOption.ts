// lib/quiz/otherOption.ts

export const OTHER_VALUE = "__other__";
export const OTHER_PREFIX = "__other__:";

export function isOtherValue(v: string): boolean {
  return v === OTHER_VALUE || v.startsWith(OTHER_PREFIX);
}

export function getOtherText(v: string): string {
  return v.startsWith(OTHER_PREFIX) ? v.slice(OTHER_PREFIX.length) : "";
}

export function buildOtherValue(text: string): string {
  return text.trim() ? `${OTHER_PREFIX}${text.trim()}` : OTHER_VALUE;
}
