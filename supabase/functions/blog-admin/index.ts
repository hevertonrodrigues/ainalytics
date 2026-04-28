// blog-admin — Super Admin CRUD for the simplified blog content schema.
// All routes require SA auth via verifySuperAdmin().
//
// Entities (post-simplification):
//   languages, locale_meta, authors, categories, tags, brands, articles,
//   ticker, rankings, rankings_items, newsletter
//
// Standard CRUD:
//   GET    /blog-admin?entity=<entity>             — list (with optional filters)
//   GET    /blog-admin?entity=<entity>&id=<id>     — get one (with localized children)
//   POST   /blog-admin?entity=<entity>             — create
//   PUT    /blog-admin?entity=<entity>&id=<id>     — update
//   DELETE /blog-admin?entity=<entity>&id=<id>     — delete
//
// Special endpoints:
//   POST  /blog-admin/articles/<id>/publish        — flip status to 'published'
//   POST  /blog-admin/articles/<id>/retract        — flip status to 'retracted'
//   POST  /blog-admin/articles/<id>/trending       — set { trending_position: number | null }
//   POST  /blog-admin/rankings/snapshots           — create a new ranking snapshot + items
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors, withCors } from "../_shared/cors.ts";
import { verifySuperAdmin } from "../_shared/admin-auth.ts";
import { ok, badRequest, created, notFound, serverError, noContent } from "../_shared/response.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { createRequestLogger } from "../_shared/logger.ts";
import { normalizeArticleBody } from "../_shared/blog-html.ts";

const SUPPORTED_LANGS = ["pt", "es", "en"];

const ENTITIES = [
  "languages",
  "locale_meta",
  "authors",
  "categories",
  "tags",
  "brands",
  "articles",
  "ticker",
  "rankings",
  "rankings_items",
  "ranking_faq",
  "newsletter",
] as const;

type Entity = typeof ENTITIES[number];

// deno-lint-ignore no-explicit-any
type Json = any;
// deno-lint-ignore no-explicit-any
type Db = any;

/**
 * Server-side mirror of the frontend `forceConvertJsonBody`: detects bodies
 * that are still serialized JSON block arrays and rewrites them as HTML.
 */
function forceConvertJsonBody(input: unknown): { html: string; converted: boolean } {
  if (typeof input !== "string" || !input) return { html: typeof input === "string" ? input : "", converted: false };
  const trimmed = input.trim();
  if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) return { html: input, converted: false };
  try {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) return { html: input, converted: false };
    // deno-lint-ignore no-explicit-any
    const looksLikeBlocks = parsed.every((b: any) => b && typeof b === "object" && typeof b.type === "string");
    if (!looksLikeBlocks) return { html: input, converted: false };
    return { html: normalizeArticleBody(parsed), converted: true };
  } catch {
    return { html: input, converted: false };
  }
}

serve(async (req: Request) => {
  const logger = createRequestLogger("blog-admin", req);
  if (req.method === "OPTIONS") return handleCors(req);

  try {
    const { user } = await verifySuperAdmin(req);
    const authCtx = { user_id: user.id };

    const url = new URL(req.url);
    const segments = url.pathname.split("/").filter(Boolean);
    const db: Db = createAdminClient();

    // ── Special action routes: /blog-admin/<sub>/<id>/<action> ──
    if (segments.length >= 3) {
      const sub = segments[1];

      // Bulk convert: POST /blog-admin/articles/convert-bodies
      // Scans every translation row and rewrites legacy JSON-block bodies as HTML.
      if (sub === "articles" && segments[2] === "convert-bodies" && req.method === "POST") {
        const { data: rows, error } = await db
          .from("blog_article_translations")
          .select("article_id, lang, body");
        if (error) throw error;

        let scanned = 0;
        let converted = 0;
        const samples: Array<{ article_id: string; lang: string; preview: string }> = [];
        for (const r of (rows || []) as Array<{ article_id: string; lang: string; body: string }>) {
          scanned++;
          const result = forceConvertJsonBody(r.body);
          if (!result.converted) continue;
          const upd = await db
            .from("blog_article_translations")
            .update({ body: result.html })
            .eq("article_id", r.article_id)
            .eq("lang", r.lang);
          if (upd.error) throw upd.error;
          converted++;
          if (samples.length < 5) {
            samples.push({
              article_id: r.article_id,
              lang: r.lang,
              preview: result.html.slice(0, 80),
            });
          }
        }
        return logger.done(withCors(req, ok({ scanned, converted, samples })), authCtx);
      }

      // Articles: publish / retract / trending
      if (sub === "articles" && segments[2] && segments[3]) {
        const articleId = segments[2];
        const action = segments[3];
        if (action === "publish" && req.method === "POST") {
          const { data, error } = await db.from("blog_articles")
            .update({ status: "published", published_at: new Date().toISOString(), modified_at: new Date().toISOString() })
            .eq("id", articleId).select().single();
          if (error) throw error;
          return logger.done(withCors(req, ok(data)), authCtx);
        }
        if (action === "retract" && req.method === "POST") {
          const { data, error } = await db.from("blog_articles")
            .update({ status: "retracted", modified_at: new Date().toISOString() })
            .eq("id", articleId).select().single();
          if (error) throw error;
          return logger.done(withCors(req, ok(data)), authCtx);
        }
        if (action === "trending" && req.method === "POST") {
          const body = await req.json().catch(() => ({}));
          const position = body.trending_position === null ? null : Number(body.trending_position);
          if (position !== null && (!Number.isInteger(position) || position < 1)) {
            return logger.done(withCors(req, badRequest("trending_position must be a positive integer or null")), authCtx);
          }
          const { data, error } = await db.from("blog_articles")
            .update({ trending_position: position })
            .eq("id", articleId).select().single();
          if (error) throw error;
          return logger.done(withCors(req, ok(data)), authCtx);
        }
      }

      // Rankings snapshot create
      if (sub === "rankings" && segments[2] === "snapshots" && req.method === "POST") {
        const body = await req.json().catch(() => ({}));
        const items: Array<{ rank: number; brandId: string; score: number; delta: string; direction: string }> = Array.isArray(body.items) ? body.items : [];
        const insertSnap = await db.from("blog_ranking_snapshots").insert({
          period_label: body.period_label || "weekly",
          period_from: body.period_from,
          period_to: body.period_to,
          region: body.region,
          sector: body.sector,
          queries_analyzed: body.queries_analyzed || 0,
          sectors_covered: body.sectors_covered || 0,
          engines_monitored: body.engines_monitored || [],
        }).select().single();
        if (insertSnap.error) throw insertSnap.error;

        if (items.length) {
          const snapshotId = insertSnap.data.id;
          const { error: itemsError } = await db.from("blog_ranking_items").insert(items.map((i) => ({
            snapshot_id: snapshotId,
            rank: i.rank,
            brand_id: i.brandId,
            score: i.score,
            delta: i.delta,
            direction: i.direction,
          })));
          if (itemsError) throw itemsError;
        }
        return logger.done(withCors(req, created(insertSnap.data)), authCtx);
      }
    }

    // ── Standard CRUD via ?entity=<entity> ──
    const entity = (url.searchParams.get("entity") || "") as Entity;
    const id = url.searchParams.get("id");
    if (!entity || !ENTITIES.includes(entity)) {
      return logger.done(withCors(req, badRequest(`Invalid or missing entity. Use one of: ${ENTITIES.join(", ")}`)), authCtx);
    }

    const handler = ENTITY_HANDLERS[entity];
    if (!handler) {
      return logger.done(withCors(req, badRequest(`Entity '${entity}' not supported`)), authCtx);
    }

    return logger.done(await handler(req, url, db, id), authCtx);
    // deno-lint-ignore no-explicit-any
  } catch (err: any) {
    console.error("[blog-admin]", err);
    if (err.status) {
      return logger.done(withCors(req, new Response(
        JSON.stringify({ success: false, error: { message: err.message, code: err.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN" } }),
        { status: err.status, headers: { "Content-Type": "application/json" } },
      )));
    }
    return logger.done(withCors(req, serverError("Internal server error", {
      functionName: "blog-admin",
      error: err,
    })));
  }
});

// ─── Per-entity handlers ────────────────────────────────────────────────────

type Handler = (req: Request, url: URL, db: Db, id: string | null) => Promise<Response>;

const ENTITY_HANDLERS: Partial<Record<Entity, Handler>> = {
  languages: handleLanguages,
  locale_meta: handleLocaleMeta,
  authors: handleAuthors,
  categories: handleCategories,
  tags: handleTags,
  brands: handleBrands,
  articles: handleArticles,
  ticker: handleTicker,
  rankings: handleRankings,
  rankings_items: handleRankingItems,
  ranking_faq: handleRankingFaq,
  newsletter: handleNewsletter,
};

// ─── Languages ──────────────────────────────────────────────────────────────

async function handleLanguages(req: Request, _url: URL, db: Db, id: string | null): Promise<Response> {
  if (req.method === "GET") {
    const { data, error } = await db.from("blog_languages").select("*").order("position");
    if (error) throw error;
    return withCors(req, ok(data));
  }
  if (req.method === "POST") {
    const body = await req.json();
    const { data, error } = await db.from("blog_languages").insert(body).select().single();
    if (error) throw error;
    return withCors(req, created(data));
  }
  if (req.method === "PUT") {
    if (!id) return withCors(req, badRequest("id required"));
    const body = await req.json();
    const { data, error } = await db.from("blog_languages").update(body).eq("code", id).select().single();
    if (error) throw error;
    return withCors(req, ok(data));
  }
  if (req.method === "DELETE") {
    if (!id) return withCors(req, badRequest("id required"));
    await db.from("blog_languages").delete().eq("code", id);
    return withCors(req, noContent());
  }
  return withCors(req, badRequest(`Method ${req.method} not allowed`));
}

// ─── Locale meta ────────────────────────────────────────────────────────────

async function handleLocaleMeta(req: Request, url: URL, db: Db, _id: string | null): Promise<Response> {
  if (req.method === "GET") {
    const lang = url.searchParams.get("lang");
    let q = db.from("blog_locale_meta").select("*");
    if (lang) q = q.eq("lang", lang);
    const { data, error } = await q;
    if (error) throw error;
    return withCors(req, ok(data));
  }
  if (req.method === "POST" || req.method === "PUT") {
    const body = await req.json();
    if (!body.lang) return withCors(req, badRequest("lang required"));
    const { data, error } = await db.from("blog_locale_meta").upsert(body, { onConflict: "lang" }).select().single();
    if (error) throw error;
    return withCors(req, ok(data));
  }
  return withCors(req, badRequest(`Method ${req.method} not allowed`));
}

// ─── Authors ────────────────────────────────────────────────────────────────

async function handleAuthors(req: Request, _url: URL, db: Db, id: string | null): Promise<Response> {
  if (req.method === "GET") {
    if (id) {
      const { data, error } = await db.from("blog_authors").select("*").eq("id", id).single();
      if (error || !data) return withCors(req, notFound("Author not found"));
      const { data: trs } = await db.from("blog_author_translations").select("*").eq("author_id", id);
      return withCors(req, ok({ ...data, translations: trs || [] }));
    }
    const { data, error } = await db.from("blog_authors").select("*").order("id");
    if (error) throw error;
    const { data: trs } = await db.from("blog_author_translations").select("author_id, lang, name, role");
    const byAuthor = new Map<string, { name: string; role: string }>();
    for (const r of trs || []) {
      const t = r as { author_id: string; lang: string; name: string; role: string };
      if (!byAuthor.has(t.author_id) || t.lang === "en") byAuthor.set(t.author_id, { name: t.name, role: t.role });
    }
    const enriched = (data || []).map((a: { id: string }) => ({ ...a, name: byAuthor.get(a.id)?.name || a.id, role: byAuthor.get(a.id)?.role || "" }));
    return withCors(req, ok(enriched));
  }
  if (req.method === "POST" || req.method === "PUT") {
    const body = await req.json();
    const author = body.author || body;
    const translations: Record<string, Json> | null = body.translations || null;
    if (!author?.id) return withCors(req, badRequest("author.id required"));

    const { data, error } = await db.from("blog_authors").upsert({
      id: author.id,
      email: author.email || null,
      image_url: author.image_url || null,
      social: author.social || {},
    }, { onConflict: "id" }).select().single();
    if (error) throw error;

    if (translations) {
      for (const [lang, tr] of Object.entries(translations)) {
        if (!SUPPORTED_LANGS.includes(lang)) continue;
        const t = tr as Json;
        if (!t?.name || !t?.role) continue;
        await db.from("blog_author_translations").upsert({
          author_id: author.id, lang, name: t.name, role: t.role, bio: t.bio || null,
        }, { onConflict: "author_id,lang" });
      }
    }
    return withCors(req, req.method === "POST" ? created(data) : ok(data));
  }
  if (req.method === "DELETE") {
    if (!id) return withCors(req, badRequest("id required"));
    await db.from("blog_authors").delete().eq("id", id);
    return withCors(req, noContent());
  }
  return withCors(req, badRequest(`Method ${req.method} not allowed`));
}

// ─── Categories ─────────────────────────────────────────────────────────────

async function handleCategories(req: Request, _url: URL, db: Db, id: string | null): Promise<Response> {
  if (req.method === "GET") {
    if (id) {
      const { data, error } = await db.from("blog_categories").select("*").eq("id", id).single();
      if (error || !data) return withCors(req, notFound("Category not found"));
      const { data: trs } = await db.from("blog_category_translations").select("*").eq("category_id", id);
      return withCors(req, ok({ ...data, translations: trs || [] }));
    }
    const { data, error } = await db.from("blog_categories").select("*").order("position");
    if (error) throw error;
    const { data: trs } = await db.from("blog_category_translations").select("category_id, lang, label, slug");
    const byCat = new Map<string, Record<string, { label: string; slug: string }>>();
    for (const r of trs || []) {
      const t = r as { category_id: string; lang: string; label: string; slug: string };
      const m = byCat.get(t.category_id) || {};
      m[t.lang] = { label: t.label, slug: t.slug };
      byCat.set(t.category_id, m);
    }
    const enriched = (data || []).map((c: { id: string }) => ({ ...c, labels: byCat.get(c.id) || {} }));
    return withCors(req, ok(enriched));
  }
  if (req.method === "POST" || req.method === "PUT") {
    const body = await req.json();
    const category = body.category || body;
    const translations: Record<string, Json> | null = body.translations || null;
    if (!category?.id) return withCors(req, badRequest("category.id required"));
    const { data, error } = await db.from("blog_categories").upsert({
      id: category.id, position: category.position || 0, is_active: category.is_active ?? true,
    }, { onConflict: "id" }).select().single();
    if (error) throw error;
    if (translations) {
      for (const [lang, tr] of Object.entries(translations)) {
        if (!SUPPORTED_LANGS.includes(lang)) continue;
        const t = tr as Json;
        if (!t?.slug || !t?.label) continue;
        await db.from("blog_category_translations").upsert({
          category_id: category.id, lang,
          slug: t.slug, label: t.label, description: t.description || "",
          seo_title: t.seo_title || null,
          segment: t.segment || (lang === "en" ? "category" : "categoria"),
        }, { onConflict: "category_id,lang" });
      }
    }
    return withCors(req, req.method === "POST" ? created(data) : ok(data));
  }
  if (req.method === "DELETE") {
    if (!id) return withCors(req, badRequest("id required"));
    await db.from("blog_categories").delete().eq("id", id);
    return withCors(req, noContent());
  }
  return withCors(req, badRequest(`Method ${req.method} not allowed`));
}

// ─── Tags ───────────────────────────────────────────────────────────────────

async function handleTags(req: Request, _url: URL, db: Db, id: string | null): Promise<Response> {
  if (req.method === "GET") {
    if (id) {
      const { data, error } = await db.from("blog_tags").select("*").eq("id", id).single();
      if (error || !data) return withCors(req, notFound("Tag not found"));
      const { data: trs } = await db.from("blog_tag_translations").select("*").eq("tag_id", id);
      return withCors(req, ok({ ...data, translations: trs || [] }));
    }
    const { data, error } = await db.from("blog_tags").select("*").order("id");
    if (error) throw error;
    const { data: trs } = await db.from("blog_tag_translations").select("tag_id, lang, label");
    const byTag = new Map<string, Record<string, string>>();
    for (const r of trs || []) {
      const t = r as { tag_id: string; lang: string; label: string };
      const m = byTag.get(t.tag_id) || {};
      m[t.lang] = t.label;
      byTag.set(t.tag_id, m);
    }
    return withCors(req, ok((data || []).map((t: { id: string }) => ({ ...t, labels: byTag.get(t.id) || {} }))));
  }
  if (req.method === "POST" || req.method === "PUT") {
    const body = await req.json();
    const tag = body.tag || body;
    const translations: Record<string, Json> | null = body.translations || null;
    if (!tag?.id) return withCors(req, badRequest("tag.id required"));
    const { data, error } = await db.from("blog_tags").upsert({
      id: tag.id, is_engine: tag.is_engine ?? false,
    }, { onConflict: "id" }).select().single();
    if (error) throw error;
    if (translations) {
      for (const [lang, tr] of Object.entries(translations)) {
        if (!SUPPORTED_LANGS.includes(lang)) continue;
        const t = tr as Json;
        if (!t?.slug || !t?.label) continue;
        await db.from("blog_tag_translations").upsert({
          tag_id: tag.id, lang, slug: t.slug, label: t.label,
        }, { onConflict: "tag_id,lang" });
      }
    }
    return withCors(req, req.method === "POST" ? created(data) : ok(data));
  }
  if (req.method === "DELETE") {
    if (!id) return withCors(req, badRequest("id required"));
    await db.from("blog_tags").delete().eq("id", id);
    return withCors(req, noContent());
  }
  return withCors(req, badRequest(`Method ${req.method} not allowed`));
}

// ─── Brands ─────────────────────────────────────────────────────────────────

async function handleBrands(req: Request, _url: URL, db: Db, id: string | null): Promise<Response> {
  if (req.method === "GET") {
    if (id) {
      const { data, error } = await db.from("blog_brands").select("*").eq("id", id).single();
      if (error || !data) return withCors(req, notFound("Brand not found"));
      return withCors(req, ok(data));
    }
    const { data, error } = await db.from("blog_brands").select("*").order("name");
    if (error) throw error;
    return withCors(req, ok(data));
  }
  if (req.method === "POST" || req.method === "PUT") {
    const body = await req.json();
    if (!body?.id || !body?.name || !body?.sector) return withCors(req, badRequest("id, name, sector required"));
    const { data, error } = await db.from("blog_brands").upsert({
      id: body.id, name: body.name, country: body.country || null,
      sector: body.sector, labels: body.labels || {},
      subsector_id: body.subsector_id || null,
      homepage_domain: body.homepage_domain || null,
      entity_type: body.entity_type || "company",
    }, { onConflict: "id" }).select().single();
    if (error) throw error;
    return withCors(req, req.method === "POST" ? created(data) : ok(data));
  }
  if (req.method === "DELETE") {
    if (!id) return withCors(req, badRequest("id required"));
    await db.from("blog_brands").delete().eq("id", id);
    return withCors(req, noContent());
  }
  return withCors(req, badRequest(`Method ${req.method} not allowed`));
}

// ─── Articles ───────────────────────────────────────────────────────────────

async function handleArticles(req: Request, url: URL, db: Db, id: string | null): Promise<Response> {
  if (req.method === "GET") {
    if (id) {
      const { data, error } = await db.from("blog_articles").select("*").eq("id", id).single();
      if (error || !data) return withCors(req, notFound("Article not found"));
      const [trs, ats, atags, akws, asrcs] = await Promise.all([
        db.from("blog_article_translations").select("*").eq("article_id", id),
        db.from("blog_article_authors").select("*").eq("article_id", id).order("position"),
        db.from("blog_article_tags").select("*").eq("article_id", id),
        db.from("blog_article_keywords").select("*").eq("article_id", id).order("position"),
        db.from("blog_article_sources").select("*").eq("article_id", id).order("position"),
      ]);
      return withCors(req, ok({
        ...data,
        translations: trs.data || [],
        authors: ats.data || [],
        tags: atags.data || [],
        keywords: akws.data || [],
        sources: asrcs.data || [],
      }));
    }
    const status = url.searchParams.get("status");
    const category = url.searchParams.get("category");
    const search = url.searchParams.get("q");
    const trending = url.searchParams.get("trending");
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") || 50)));

    let q = db.from("blog_articles").select("*").order("modified_at", { ascending: false }).limit(limit);
    // status / category accept either a single value or a comma-separated list.
    if (status) {
      const statuses = status.split(",").map((s) => s.trim()).filter(Boolean);
      q = statuses.length > 1 ? q.in("status", statuses) : q.eq("status", statuses[0]);
    }
    if (category) {
      const cats = category.split(",").map((s) => s.trim()).filter(Boolean);
      q = cats.length > 1 ? q.in("category_id", cats) : q.eq("category_id", cats[0]);
    }
    if (trending === "true") q = q.not("trending_position", "is", null).order("trending_position", { ascending: true });
    const { data, error } = await q;
    if (error) throw error;

    const ids = (data || []).map((a: { id: string }) => a.id);
    const { data: trs } = ids.length ? await db.from("blog_article_translations").select("article_id, lang, slug, title").in("article_id", ids) : { data: [] };
    const titlesByArt = new Map<string, Record<string, { slug: string; title: string }>>();
    for (const r of trs || []) {
      const t = r as { article_id: string; lang: string; slug: string; title: string };
      const m = titlesByArt.get(t.article_id) || {};
      m[t.lang] = { slug: t.slug, title: t.title };
      titlesByArt.set(t.article_id, m);
    }
    let enriched = (data || []).map((a: { id: string }) => ({ ...a, translations: titlesByArt.get(a.id) || {} }));

    if (search) {
      const needle = search.toLowerCase();
      enriched = enriched.filter((a: { id: string; translations: Record<string, { title: string }> }) =>
        a.id.toLowerCase().includes(needle) ||
        Object.values(a.translations).some((t) => t.title.toLowerCase().includes(needle))
      );
    }
    return withCors(req, ok(enriched));
  }

  if (req.method === "POST" || req.method === "PUT") {
    const body = await req.json();
    const article = body.article || body;
    const translations: Record<string, Json> | null = body.translations || null;
    const authors: Array<{ author_id: string; position?: number }> = body.authors || [];
    const tags: string[] = body.tags || [];
    const keywords: string[] = body.keywords || [];
    const sources: Array<{ name: string; url: string }> = body.sources || [];

    if (!article?.id || !article?.category_id) return withCors(req, badRequest("article.id and category_id required"));

    const upsertData = {
      id: article.id,
      category_id: article.category_id,
      read_time_minutes: article.read_time_minutes ?? 5,
      image_url: article.image_url || null,
      image_width: article.image_width || null,
      image_height: article.image_height || null,
      status: article.status || "draft",
      is_featured: article.is_featured ?? false,
      trending_position: article.trending_position ?? null,
      published_at: article.published_at || new Date().toISOString(),
      modified_at: new Date().toISOString(),
    };

    const { data, error } = await db.from("blog_articles").upsert(upsertData, { onConflict: "id" }).select().single();
    if (error) throw error;

    if (translations) {
      for (const [lang, tr] of Object.entries(translations)) {
        if (!SUPPORTED_LANGS.includes(lang)) continue;
        const t = tr as Json;
        if (!t?.slug || !t?.title || !t?.dek) continue;
        await db.from("blog_article_translations").upsert({
          article_id: article.id, lang,
          slug: t.slug, title: t.title, dek: t.dek,
          display_date: t.display_date || "",
          read_time_label: t.read_time_label || "",
          body: normalizeArticleBody(t.body),
          toc: t.toc || [],
          ui: t.ui || {},
          sidebar_cta: t.sidebar_cta || {},
          image_alt: t.image_alt || null,
          meta_keywords: t.meta_keywords || [],
        }, { onConflict: "article_id,lang" });
      }
    }

    if (Array.isArray(authors)) {
      await db.from("blog_article_authors").delete().eq("article_id", article.id);
      if (authors.length) {
        await db.from("blog_article_authors").insert(authors.map((a, i) => ({
          article_id: article.id, author_id: a.author_id, position: a.position ?? i,
        })));
      }
    }

    if (Array.isArray(tags)) {
      await db.from("blog_article_tags").delete().eq("article_id", article.id);
      if (tags.length) {
        await db.from("blog_article_tags").insert(tags.map((t) => ({ article_id: article.id, tag_id: t })));
      }
    }

    if (Array.isArray(keywords)) {
      await db.from("blog_article_keywords").delete().eq("article_id", article.id);
      if (keywords.length) {
        await db.from("blog_article_keywords").insert(keywords.map((k, i) => ({
          article_id: article.id, keyword: k, position: i,
        })));
      }
    }

    if (Array.isArray(sources)) {
      await db.from("blog_article_sources").delete().eq("article_id", article.id);
      if (sources.length) {
        await db.from("blog_article_sources").insert(sources.map((s, i) => ({
          article_id: article.id,
          position: i,
          name: s.name,
          url: s.url,
        })));
      }
    }

    return withCors(req, req.method === "POST" ? created(data) : ok(data));
  }

  if (req.method === "DELETE") {
    if (!id) return withCors(req, badRequest("id required"));
    await db.from("blog_articles").delete().eq("id", id);
    return withCors(req, noContent());
  }
  return withCors(req, badRequest(`Method ${req.method} not allowed`));
}

// ─── Ticker ─────────────────────────────────────────────────────────────────

async function handleTicker(req: Request, url: URL, db: Db, id: string | null): Promise<Response> {
  const lang = url.searchParams.get("lang");
  if (req.method === "GET") {
    let q = db.from("blog_ticker_items").select("*").order("lang").order("position");
    if (lang) q = q.eq("lang", lang);
    const { data, error } = await q;
    if (error) throw error;
    return withCors(req, ok(data));
  }
  if (req.method === "POST") {
    const body = await req.json();
    const { data, error } = await db.from("blog_ticker_items").insert({
      lang: body.lang, position: body.position,
      engine_id: body.engine_id || null, label: body.label, value: body.value,
      trend: body.trend, link_url: body.link_url || null, is_active: body.is_active ?? true,
    }).select().single();
    if (error) throw error;
    return withCors(req, created(data));
  }
  if (req.method === "PUT") {
    if (!id) return withCors(req, badRequest("id required"));
    const body = await req.json();
    const { data, error } = await db.from("blog_ticker_items").update({
      engine_id: body.engine_id ?? undefined, label: body.label,
      value: body.value, trend: body.trend, link_url: body.link_url ?? undefined,
      is_active: body.is_active, position: body.position, lang: body.lang,
    }).eq("id", id).select().single();
    if (error) throw error;
    return withCors(req, ok(data));
  }
  if (req.method === "DELETE") {
    if (!id) return withCors(req, badRequest("id required"));
    await db.from("blog_ticker_items").delete().eq("id", id);
    return withCors(req, noContent());
  }
  return withCors(req, badRequest(`Method ${req.method} not allowed`));
}

// ─── Rankings (snapshots) ───────────────────────────────────────────────────

async function handleRankings(req: Request, _url: URL, db: Db, id: string | null): Promise<Response> {
  if (req.method === "GET") {
    if (id) {
      const { data, error } = await db.from("blog_ranking_snapshots").select("*").eq("id", id).single();
      if (error || !data) return withCors(req, notFound("Snapshot not found"));
      const { data: items } = await db.from("blog_ranking_items").select("*").eq("snapshot_id", id).order("rank");
      return withCors(req, ok({ ...data, items: items || [] }));
    }
    const { data, error } = await db.from("blog_ranking_snapshots").select("*").order("period_from", { ascending: false }).limit(100);
    if (error) throw error;
    return withCors(req, ok(data));
  }
  if (req.method === "DELETE") {
    if (!id) return withCors(req, badRequest("id required"));
    await db.from("blog_ranking_snapshots").delete().eq("id", id);
    return withCors(req, noContent());
  }
  if (req.method === "PUT") {
    if (!id) return withCors(req, badRequest("id required"));
    const body = await req.json();
    const { data, error } = await db.from("blog_ranking_snapshots").update(body).eq("id", id).select().single();
    if (error) throw error;
    return withCors(req, ok(data));
  }
  return withCors(req, badRequest(`Method ${req.method} not allowed`));
}

async function handleRankingItems(req: Request, url: URL, db: Db, _id: string | null): Promise<Response> {
  const snapshotId = url.searchParams.get("snapshot_id");
  if (req.method === "GET") {
    if (!snapshotId) return withCors(req, badRequest("snapshot_id required"));
    const { data, error } = await db.from("blog_ranking_items").select("*").eq("snapshot_id", snapshotId).order("rank");
    if (error) throw error;
    return withCors(req, ok(data));
  }
  if (req.method === "POST") {
    const body = await req.json();
    const items = Array.isArray(body) ? body : (body.items || []);
    if (!snapshotId) return withCors(req, badRequest("snapshot_id required"));
    await db.from("blog_ranking_items").delete().eq("snapshot_id", snapshotId);
    if (items.length) {
      // deno-lint-ignore no-explicit-any
      const { error } = await db.from("blog_ranking_items").insert(items.map((i: any) => ({
        snapshot_id: Number(snapshotId), rank: i.rank, brand_id: i.brand_id, score: i.score, delta: i.delta, direction: i.direction,
      })));
      if (error) throw error;
    }
    return withCors(req, ok({ replaced: items.length }));
  }
  return withCors(req, badRequest(`Method ${req.method} not allowed`));
}

// ─── Newsletter ─────────────────────────────────────────────────────────────

async function handleNewsletter(req: Request, url: URL, db: Db, id: string | null): Promise<Response> {
  if (req.method === "GET") {
    const status = url.searchParams.get("status");
    const search = url.searchParams.get("q");
    const limit = Math.max(1, Math.min(500, Number(url.searchParams.get("limit") || 100)));
    let q = db.from("blog_newsletter_subscribers").select("*").order("subscribed_at", { ascending: false }).limit(limit);
    if (status) q = q.eq("status", status);
    if (search) q = q.ilike("email", `%${search}%`);
    const { data, error } = await q;
    if (error) throw error;
    return withCors(req, ok(data));
  }
  if (req.method === "PUT") {
    if (!id) return withCors(req, badRequest("id required"));
    const body = await req.json();
    const update: Record<string, unknown> = {};
    if (body.status) update.status = body.status;
    if (body.lang) update.lang = body.lang;
    if (body.topics) update.topics = body.topics;
    const { data, error } = await db.from("blog_newsletter_subscribers").update(update).eq("id", id).select().single();
    if (error) throw error;
    return withCors(req, ok(data));
  }
  if (req.method === "DELETE") {
    if (!id) return withCors(req, badRequest("id required"));
    await db.from("blog_newsletter_subscribers").delete().eq("id", id);
    return withCors(req, noContent());
  }
  return withCors(req, badRequest(`Method ${req.method} not allowed`));
}

// ─── Ranking FAQ ────────────────────────────────────────────────────────────

async function handleRankingFaq(req: Request, url: URL, db: Db, id: string | null): Promise<Response> {
  if (req.method === "GET") {
    const lang = url.searchParams.get("lang");
    const region = url.searchParams.get("region");
    const sector = url.searchParams.get("sector");
    let q = db.from("blog_ranking_faq").select("*").order("lang").order("region").order("sector").order("position");
    if (lang) q = q.eq("lang", lang);
    if (region === "null") q = q.is("region", null);
    else if (region) q = q.eq("region", region);
    if (sector === "null") q = q.is("sector", null);
    else if (sector) q = q.eq("sector", sector);
    const { data, error } = await q;
    if (error) throw error;
    return withCors(req, ok(data));
  }
  if (req.method === "POST") {
    const body = await req.json();
    if (!body.lang || !body.question || !body.answer) {
      return withCors(req, badRequest("lang, question, answer required"));
    }
    const { data, error } = await db.from("blog_ranking_faq").insert({
      lang: body.lang,
      region: body.region || null,
      sector: body.sector || null,
      position: body.position ?? 0,
      question: body.question,
      answer: body.answer,
    }).select().single();
    if (error) throw error;
    return withCors(req, created(data));
  }
  if (req.method === "PUT") {
    if (!id) return withCors(req, badRequest("id required"));
    const body = await req.json();
    const update: Record<string, unknown> = {};
    if (body.lang !== undefined)     update.lang = body.lang;
    if (body.region !== undefined)   update.region = body.region || null;
    if (body.sector !== undefined)   update.sector = body.sector || null;
    if (body.position !== undefined) update.position = body.position;
    if (body.question !== undefined) update.question = body.question;
    if (body.answer !== undefined)   update.answer = body.answer;
    const { data, error } = await db.from("blog_ranking_faq").update(update).eq("id", id).select().single();
    if (error) throw error;
    return withCors(req, ok(data));
  }
  if (req.method === "DELETE") {
    if (!id) return withCors(req, badRequest("id required"));
    await db.from("blog_ranking_faq").delete().eq("id", id);
    return withCors(req, noContent());
  }
  return withCors(req, badRequest(`Method ${req.method} not allowed`));
}
