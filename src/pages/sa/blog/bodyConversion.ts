/**
 * Defensive converter that lets any legacy block-array body land in a UI
 * that now expects HTML. Mirrors the server-side `normalizeBody` in
 * `supabase/functions/blog-admin/index.ts` so legacy JSON exports / cached
 * responses / hand-edited templates can flow through the rich-text editor
 * without crashing.
 *
 *   - string  → returned verbatim (already HTML)
 *   - array   → mapped to <p>/<h2>/<h3>/<blockquote> and joined with `\n`
 *   - other   → returns ''
 */

type LegacyBlock = { type?: string; text?: unknown };

function escapeHtml(input: unknown): string {
  return String(input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function normalizeBody(input: unknown): string {
  if (typeof input === 'string') return input;
  if (Array.isArray(input)) {
    return input
      .map((raw) => {
        if (!raw || typeof raw !== 'object') return '';
        const block = raw as LegacyBlock;
        const text = escapeHtml(block.text);
        switch (block.type) {
          case 'p':          return `<p>${text}</p>`;
          case 'h2':         return `<h2>${text}</h2>`;
          case 'h3':         return `<h3>${text}</h3>`;
          case 'blockquote': return `<blockquote>${text}</blockquote>`;
          default:           return '';
        }
      })
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

export interface ForceConvertResult {
  /** The HTML string after conversion. Equal to `input` when nothing converted. */
  html: string;
  /** True when the input parsed as a legacy block array and was rewritten. */
  converted: boolean;
}

/**
 * Force-convert a body field that may hold legacy JSON blocks (as a string)
 * into clean HTML. Behavior:
 *
 *   - If `input` parses as a JSON array of `{ type, text }` blocks
 *     → returns the HTML rendering, `converted: true`
 *   - Otherwise (plain HTML, plain text, empty, or JSON that isn't blocks)
 *     → returns `input` unchanged, `converted: false`
 *
 * Used by the editor's "Convert JSON → Rich Text" button so admins can
 * force-fix any legacy article they encounter.
 */
export function forceConvertJsonBody(input: string): ForceConvertResult {
  if (!input || typeof input !== 'string') return { html: input || '', converted: false };
  const trimmed = input.trim();
  if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) {
    return { html: input, converted: false };
  }
  try {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) return { html: input, converted: false };
    const looksLikeBlocks = parsed.every((b) =>
      b && typeof b === 'object' && typeof (b as LegacyBlock).type === 'string',
    );
    if (!looksLikeBlocks) return { html: input, converted: false };
    return { html: normalizeBody(parsed), converted: true };
  } catch {
    return { html: input, converted: false };
  }
}
