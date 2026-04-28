const ALLOWED_TAGS = new Set([
  "a",
  "b",
  "blockquote",
  "br",
  "code",
  "em",
  "h2",
  "h3",
  "i",
  "li",
  "ol",
  "p",
  "pre",
  "s",
  "strong",
  "ul",
]);

const VOID_TAGS = new Set(["br"]);

export function escapeHtml(input: unknown): string {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttribute(input: string): string {
  return escapeHtml(input).replace(/'/g, "&#39;");
}

function safeHref(raw: string | null): string | null {
  if (!raw) return null;
  const href = raw.trim();
  if (!href) return null;

  if (href.startsWith("/") || href.startsWith("#")) return href;

  const compact = href.replace(/[\u0000-\u001f\u007f\s]+/g, "");
  try {
    const parsed = new URL(compact);
    if (parsed.protocol === "http:" || parsed.protocol === "https:" || parsed.protocol === "mailto:") {
      return parsed.toString();
    }
  } catch {
    return null;
  }
  return null;
}

function readAttr(attrs: string, name: string): string | null {
  const unquotedValue = "[^\\s\"'=<>`]+";
  const re = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|(${unquotedValue}))`, "i");
  const match = attrs.match(re);
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? null;
}

export function sanitizeArticleHtml(input: unknown): string {
  const html = String(input ?? "");
  if (!html) return "";

  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\s*(script|style|iframe|object|embed|svg|math)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|style|iframe|object|embed|svg|math)\b[^>]*\/?\s*>/gi, "")
    .replace(/<\/?([a-z][a-z0-9-]*)(\s[^<>]*)?>/gi, (match, rawTag: string, rawAttrs = "") => {
      const isClosing = /^<\s*\//.test(match);
      const tag = rawTag.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) return "";
      if (isClosing) return VOID_TAGS.has(tag) ? "" : `</${tag}>`;
      if (tag === "a") {
        const href = safeHref(readAttr(rawAttrs, "href"));
        if (!href) return "";
        const title = readAttr(rawAttrs, "title");
        const titleAttr = title ? ` title="${escapeAttribute(title)}"` : "";
        return `<a href="${escapeAttribute(href)}"${titleAttr} target="_blank" rel="noopener noreferrer nofollow">`;
      }
      if (VOID_TAGS.has(tag)) return `<${tag}>`;
      return `<${tag}>`;
    });
}

type LegacyBlock = { type?: unknown; text?: unknown };

export function normalizeArticleBody(input: unknown): string {
  if (typeof input === "string") return sanitizeArticleHtml(input);

  if (Array.isArray(input)) {
    return sanitizeArticleHtml(
      input
        .map((raw: LegacyBlock) => {
          const type = raw?.type;
          const text = escapeHtml(raw?.text ?? "");
          if (type === "p") return `<p>${text}</p>`;
          if (type === "h2") return `<h2>${text}</h2>`;
          if (type === "h3") return `<h3>${text}</h3>`;
          if (type === "blockquote") return `<blockquote>${text}</blockquote>`;
          return "";
        })
        .filter(Boolean)
        .join("\n"),
    );
  }

  return "";
}
