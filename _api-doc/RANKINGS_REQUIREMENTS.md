# Rankings Page — API Requirements

Tracks the gaps between what `/[lang]/rankings` renders and what the
`/blog-ranking/{lang}` endpoint exposes today. Live integration lives in
`lib/content/rankings.ts` (`getRankingsReport`); anything not listed in the
"Hydrated from API" section is currently mocked or carries static editorial
copy.

Last updated: 2026-04-28.

---

## Hydrated from API today

| Frontend field                                | API source                                    |
|-----------------------------------------------|-----------------------------------------------|
| `report.title`                                | `data.title`                                  |
| `report.subtitle`                             | `data.description`                            |
| `meta.weekStart` / `meta.weekEnd`             | `data.period.from` / `data.period.to`         |
| `report.kpis[0].value` (queries analyzed)     | `data.stats.queriesAnalyzed`                  |
| `report.kpis[1].value` (sectors covered)      | `data.stats.sectorsCovered`                   |
| `report.kpis[2].value` (engines tracked)      | `data.stats.enginesMonitored.length`          |
| `report.leaderboard.data[].name/sector/avi/delta` | `data.items[]`                            |
| `report.movers.data` (gainers / losers)       | derived from `data.items[]` (top/bottom 5 by `delta`) |
| `report.sectors.data`                         | aggregated from `data.items[]` (avg score & avg delta per `sectorLabel`, top 10) |
| `report.faq.items`                            | `data.faq[]`                                  |

Request used:

```
GET /blog-ranking/{lang}?limit=50
```

`limit=50` is intentional — the leaderboard renders up to 50 rows, and
movers / sector aggregates need a healthy sample to be meaningful.

---

## Synthesized client-side (mocked)

These fields are computed in `lib/content/rankings.ts` because the API does
not yet expose the underlying signal. They are deterministic so prerender
output stays stable across builds.

### 1. Per-engine scores per leaderboard row

`report.leaderboard.data[].chatgpt | gemini | claude | perplexity | grok | copilot`

Currently each cell is `synthEngineScore(brandId, engine, item.score)` — a
hash of `${brandId}::${engine}` mapped into `[score-5, score+5]` and clamped
to `0..100`.

**Suggested API addition:**

```jsonc
// /blog-ranking/{lang} → data.items[]
{
  "brandId": "nubank",
  "score": 94,             // composite AVI (today)
  "engineScores": {        // ← new
    "chatgpt": 96,
    "gemini": 92,
    "claude": 89,
    "perplexity": 95,
    "grok": 88,
    "copilot": 91
  }
}
```

The keys must match the engine ids in `data.stats.enginesMonitored` so
new engines flow through without code changes.

### 2. KPI growth deltas

`report.kpis[i].delta` and `report.kpis[i].dir` ("+8.4%", `up`).

All four KPI cards currently display static deltas. The API exposes
absolute values but not week-over-week change.

**Suggested API addition:**

```jsonc
// /blog-ranking/{lang} → data.stats
{
  "queriesAnalyzed": 4210000,
  "queriesAnalyzedDelta": "+8.4%",         // ← new
  "sectorsCovered": 127,
  "sectorsCoveredDelta": "+3",             // ← new
  "enginesMonitored": ["chatgpt", "gemini", "claude", "perplexity", "grok", "copilot"],
  "enginesMonitoredDelta": "0",            // ← new
  "brandsIndexed": 2847,                   // ← new
  "brandsIndexedDelta": "+142"             // ← new
}
```

### 3. "Brands indexed" KPI value

`report.kpis[3].value` is static today (PT/ES `2.847`, EN `2,847`). Could be
derived from the API once `stats.brandsIndexed` (above) ships.

### 4. Historical timeline

`report.timeline.lines` — twelve weekly data points × five top brands. The
chart at the bottom of the page falls back to static seed values for every
locale.

**Suggested endpoint:**

```
GET /blog-ranking-timeline/{lang}?weeks=12&top=5
```

```jsonc
{
  "data": {
    "weeks": ["2026-W06", "2026-W07", "...", "2026-W17"],
    "lines": [
      {
        "brandId": "nubank",
        "name": "Nubank",
        "color": "#10A37F",
        "data": [78, 79, 81, 82, 84, 85, 86, 88, 89, 90, 92, 94]
      }
    ]
  },
  "seo": { /* hreflang alternates as elsewhere */ }
}
```

`color` is included so the frontend doesn't need a separate brand-color
catalog.

### 5. AVI methodology pillars

`report.breakdown.pillars` — five pillars (citation frequency, position,
sentiment, cross-engine, semantic depth) with `weight` and `desc`. These
are editorial copy and unlikely to change weekly, but they're currently
duplicated across three locales in `rankings.ts`.

**Suggested:** move into a CMS table or expose alongside `/blog-ranking`:

```jsonc
// /blog-ranking/{lang} → data.methodology (optional)
{
  "pillars": [
    { "id": "citation", "name": "Citation frequency", "weight": 35, "desc": "..." },
    { "id": "position", "name": "Position in answer", "weight": 25, "desc": "..." }
  ]
}
```

### 6. Engine profile copy

`report.enginesProfile.data` — per-engine `tags[]` + `bias` paragraph. Pure
editorial copy, currently triplicated across PT/ES/EN.

**Suggested endpoint:**

```
GET /blog-engine-profiles/{lang}
```

```jsonc
{
  "data": [
    {
      "id": "chatgpt",
      "label": "ChatGPT",
      "color": "#10A37F",
      "tags": ["Tier-1 media", "Wikipedia", "Reddit", "Recent content"],
      "bias": "Tends to cite established editorial sources..."
    }
  ]
}
```

### 7. Editorial insights

`report.insights.items` — three "what the data tells us" cards.

**Suggested:** weekly-snapshot-bound editorial set:

```jsonc
// /blog-ranking/{lang} → data.insights (optional)
{
  "insights": [
    {
      "tag": "Insight #1",
      "title": "The money is in fintech",
      "text": "Across the six largest fintechs..."
    }
  ]
}
```

### 8. Localized week label

`report.week` ("Week 17 · April 21–27, 2026"). The API only returns
`data.period.label = "weekly"`. The frontend formats the label statically.

**Suggested API addition:**

```jsonc
// /blog-ranking/{lang} → data.period
{
  "label": "weekly",
  "weekNumber": 17,                     // ← new
  "weekLabel": "Week 17 · April 21–27, 2026", // ← new (locale-aware)
  "from": "2026-04-21",
  "to": "2026-04-27"
}
```

If `weekLabel` ships fully localized, `report.week` becomes a thin pass-through.

### 9. CTA / UI copy

`report.cta.{eyebrow,title,subtitle,primary,secondary}` and `report.ui.*`
are pure UI strings. Not planned for API integration; keep static.

---

## Summary of suggested API additions

Roll-up of new fields the rankings surface would consume if added to the API:

```jsonc
// /blog-ranking/{lang}
{
  "data": {
    "title": "...",
    "description": "...",
    "period": {
      "label": "weekly",
      "weekNumber": 17,                       // NEW
      "weekLabel": "Week 17 · April 21–27, 2026", // NEW
      "from": "2026-04-21",
      "to": "2026-04-27"
    },
    "stats": {
      "queriesAnalyzed": 4210000,
      "queriesAnalyzedDelta": "+8.4%",        // NEW
      "sectorsCovered": 127,
      "sectorsCoveredDelta": "+3",            // NEW
      "enginesMonitored": ["chatgpt", "..."],
      "enginesMonitoredDelta": "0",           // NEW
      "brandsIndexed": 2847,                  // NEW
      "brandsIndexedDelta": "+142"            // NEW
    },
    "items": [
      {
        "brandId": "nubank",
        "name": "Nubank",
        "score": 94,
        "delta": "+6",
        "direction": "up",
        "sectorLabel": "Fintech",
        "engineScores": {                      // NEW
          "chatgpt": 96, "gemini": 92, "claude": 89,
          "perplexity": 95, "grok": 88, "copilot": 91
        }
      }
    ],
    "methodology": { "pillars": [/* see §5 */] },  // NEW (optional)
    "insights": [/* see §7 */],                    // NEW (optional)
    "faq": [{ "question": "...", "answer": "..." }]
  }
}
```

New endpoints worth considering:

- `GET /blog-ranking-timeline/{lang}?weeks=12&top=5` — historical AVI lines.
- `GET /blog-engine-profiles/{lang}` — per-engine tags/bias copy.

Once shipped, remove the corresponding mock helpers from
`lib/content/rankings.ts` (`synthEngineScore`, the `_FromItems` aggregators
for the cases now covered server-side) and update this doc.
