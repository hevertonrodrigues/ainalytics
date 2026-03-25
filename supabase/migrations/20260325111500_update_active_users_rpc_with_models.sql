-- Update the get_admin_active_users RPC to include active models per tenant
CREATE OR REPLACE FUNCTION public.get_admin_active_users()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_agg(row_data ORDER BY row_data->>'progress_percent' DESC)
  INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'user_id',              p.user_id,
      'full_name',            p.full_name,
      'email',                p.email,
      'avatar_url',           p.avatar_url,
      'created_at',           p.created_at,
      'tenant_id',            tu.tenant_id,
      'tenant_name',          t.name,
      'tenant_slug',          t.slug,
      'plan_name',            pl.name,
      -- Company
      'has_company',          COALESCE(cs.companies_count, 0) > 0,
      'company_name',         cs.first_company_name,
      'company_domain',       cs.first_company_domain,
      'companies_count',      COALESCE(cs.companies_count, 0),
      -- Analysis
      'has_analysis',         COALESCE(ga.completed_analyses, 0) > 0,
      'total_analyses',       COALESCE(ga.total_analyses, 0),
      'completed_analyses',   COALESCE(ga.completed_analyses, 0),
      'best_geo_score',       ga.best_geo_score,
      'latest_analysis_status', ga.latest_analysis_status,
      'latest_analysis_at',   ga.latest_analysis_at,
      -- Prompts
      'has_prompts',          COALESCE(pr.active_prompts, 0) > 0,
      'total_prompts',        COALESCE(pr.total_prompts, 0),
      'active_prompts',       COALESCE(pr.active_prompts, 0),
      -- Answers
      'has_answers',          COALESCE(pa.total_answers, 0) > 0,
      'total_answers',        COALESCE(pa.total_answers, 0),
      -- Active Models
      'active_models',        COALESCE(am.models_list, '[]'::jsonb),
      'active_models_count',  COALESCE(am.models_count, 0),
      -- Progress
      'progress_percent',     (
        (CASE WHEN COALESCE(cs.companies_count, 0) > 0 THEN 25 ELSE 0 END) +
        (CASE WHEN COALESCE(ga.completed_analyses, 0) > 0 THEN 25 ELSE 0 END) +
        (CASE WHEN COALESCE(pr.active_prompts, 0) > 0 THEN 25 ELSE 0 END) +
        (CASE WHEN COALESCE(pa.total_answers, 0) > 0 THEN 25 ELSE 0 END)
      )
    ) AS row_data
    FROM profiles p
    INNER JOIN tenant_users tu
      ON tu.user_id = p.user_id AND tu.is_active = true
    INNER JOIN tenants t
      ON t.id = tu.tenant_id
    INNER JOIN subscriptions s
      ON s.tenant_id = tu.tenant_id
      AND s.status IN ('active', 'trialing')
    LEFT JOIN plans pl
      ON pl.id = s.plan_id
    -- Companies aggregate
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*)::int AS companies_count,
        MIN(c.company_name) AS first_company_name,
        MIN(c.domain) AS first_company_domain
      FROM companies c
      WHERE c.tenant_id = tu.tenant_id
    ) cs ON true
    -- Geo analyses aggregate
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*)::int AS total_analyses,
        COUNT(*) FILTER (WHERE ga2.status = 'completed')::int AS completed_analyses,
        MAX(ga2.geo_score) FILTER (WHERE ga2.status = 'completed') AS best_geo_score,
        (SELECT ga3.status FROM geo_analyses ga3
         JOIN companies c3 ON c3.id = ga3.company_id AND c3.tenant_id = tu.tenant_id
         ORDER BY ga3.created_at DESC LIMIT 1) AS latest_analysis_status,
        (SELECT ga3.created_at FROM geo_analyses ga3
         JOIN companies c3 ON c3.id = ga3.company_id AND c3.tenant_id = tu.tenant_id
         ORDER BY ga3.created_at DESC LIMIT 1) AS latest_analysis_at
      FROM geo_analyses ga2
      JOIN companies c2 ON c2.id = ga2.company_id AND c2.tenant_id = tu.tenant_id
    ) ga ON true
    -- Prompts aggregate
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*)::int AS total_prompts,
        COUNT(*) FILTER (WHERE pr2.is_active)::int AS active_prompts
      FROM prompts pr2
      WHERE pr2.tenant_id = tu.tenant_id
    ) pr ON true
    -- Answers aggregate
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS total_answers
      FROM prompt_answers pa2
      WHERE pa2.tenant_id = tu.tenant_id
        AND pa2.deleted = false
    ) pa ON true
    -- Active models for this tenant
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*)::int AS models_count,
        jsonb_agg(
          jsonb_build_object(
            'model_slug', m.slug,
            'model_name', m.name,
            'platform_slug', plat.slug,
            'platform_name', plat.name,
            'web_search_active', m.web_search_active
          ) ORDER BY plat.name, m.slug
        ) AS models_list
      FROM tenant_platform_models tpm
      JOIN models m ON m.id = tpm.model_id
      JOIN platforms plat ON plat.id = tpm.platform_id
      WHERE tpm.tenant_id = tu.tenant_id
        AND tpm.is_active = true
    ) am ON true
  ) sub;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$function$;
