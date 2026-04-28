/**
 * Cursor-based pagination helpers for the blog API.
 * Cursors are opaque base64url-encoded JSON.
 */

export interface Cursor {
  /** primary sort value (ISO timestamp for `publishedAt`, or numeric offset) */
  v: string;
  /** tiebreak id */
  i: string;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function toBase64Url(s: string): string {
  // deno-lint-ignore no-explicit-any
  const b64 = (globalThis as any).btoa(s);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=");
  // deno-lint-ignore no-explicit-any
  return (globalThis as any).atob(b64);
}

export function encodeCursor(c: Cursor): string {
  return toBase64Url(JSON.stringify(c));
}

export function decodeCursor(raw: string | null): Cursor | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(fromBase64Url(raw));
    if (typeof parsed?.v === "string" && typeof parsed?.i === "string") return parsed as Cursor;
    return null;
  } catch {
    return null;
  }
}

export interface PageInfo {
  limit: number;
  cursor: string | null;
  nextCursor: string | null;
  totalEstimate?: number;
}

/**
 * Resolve `limit` and `cursor` query params with sane bounds.
 */
export function resolvePagination(searchParams: URLSearchParams, defaultLimit = DEFAULT_LIMIT): {
  limit: number;
  cursor: Cursor | null;
  cursorRaw: string | null;
} {
  const limitParam = Number(searchParams.get("limit") || defaultLimit);
  const limit = Math.max(1, Math.min(MAX_LIMIT, Number.isFinite(limitParam) ? limitParam : defaultLimit));
  const cursorRaw = searchParams.get("cursor");
  return { limit, cursor: decodeCursor(cursorRaw), cursorRaw };
}
