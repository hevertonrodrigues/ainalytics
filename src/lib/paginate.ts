/**
 * Paginated fetch utility for Supabase client-side queries.
 *
 * Supabase (PostgREST) enforces a hard maximum of 1 000 rows per request.
 * This helper pages through the full result-set in batches and concatenates
 * them into a single array.
 *
 * Usage:
 * ```ts
 * import { supabase } from '@/lib/supabase';
 * import { fetchAllRows } from '@/lib/paginate';
 *
 * const allRefs = await fetchAllRows(() =>
 *   supabase
 *     .from('prompt_answer_sources')
 *     .select('url, title')
 *     .eq('source_id', id)
 *     .order('created_at', { ascending: false })
 * );
 * ```
 */

const DEFAULT_PAGE_SIZE = 1000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchAllRows<T = Record<string, any>>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buildQuery: () => any,
  pageSize = DEFAULT_PAGE_SIZE,
): Promise<T[]> {
  const allRows: T[] = [];
  let from = 0;

  for (;;) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allRows.push(...(data as T[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return allRows;
}
