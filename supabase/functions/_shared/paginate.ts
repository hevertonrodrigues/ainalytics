/**
 * Paginated fetch utility for Supabase queries.
 *
 * Supabase (PostgREST) enforces a hard maximum of 1 000 rows per request.
 * `.limit(N)` and `.range(0, N)` are silently capped at that ceiling.
 *
 * This helper pages through the full result-set in batches of `pageSize`
 * (default 1 000) and concatenates them into a single array.
 *
 * Usage:
 * ```ts
 * const allRows = await fetchAllRows(() =>
 *   db.from("my_table")
 *     .select("id, name")
 *     .eq("tenant_id", tenantId)
 *     .order("name")
 * );
 * ```
 *
 * The `buildQuery` factory is called once per page so that each request
 * starts from a fresh query-builder instance.
 */

const DEFAULT_PAGE_SIZE = 1000;

// deno-lint-ignore no-explicit-any
export async function fetchAllRows<T = Record<string, any>>(
  buildQuery: () => { range: (from: number, to: number) => Promise<{ data: T[] | null; error: any }> } | any,
  pageSize = DEFAULT_PAGE_SIZE,
): Promise<T[]> {
  const allRows: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allRows.push(...(data as T[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return allRows;
}
