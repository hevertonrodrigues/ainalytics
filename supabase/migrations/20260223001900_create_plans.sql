-- ============================================================
-- Migration: Create plans table (global, no tenant_id)
-- ============================================================

CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  settings JSONB NOT NULL DEFAULT '{}',
  features JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read plans
CREATE POLICY "plans_select_authenticated"
  ON plans FOR SELECT
  TO authenticated
  USING (true);

-- No INSERT/UPDATE/DELETE policies for 'authenticated'
-- Mutations happen via Edge Functions using service_role

-- Updated_at trigger
CREATE TRIGGER set_plans_updated_at
  BEFORE UPDATE ON plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Seed default plans
INSERT INTO plans (name, price, is_active, sort_order, settings, features) VALUES
  (
    'Starter', 99, true, 1,
    '{"max_prompts": 3, "refresh_rate": "monthly", "description": "Essential AI monitoring to get started. Perfect for freelancers and small businesses."}',
    '{
      "en": [
        "3 AI prompts",
        "Monthly refresh",
        "Basic visibility score",
        "Community support"
      ],
      "es": [
        "3 prompts de IA",
        "Actualización mensual",
        "Score básico de visibilidad",
        "Soporte comunitario"
      ],
      "pt-br": [
        "3 prompts de IA",
        "Atualização mensal",
        "Score básico de visibilidade",
        "Suporte da comunidade"
      ]
    }'
  ),
  (
    'Growth', 189, true, 2,
    '{"max_prompts": 10, "refresh_rate": "weekly", "description": "Scale your monitoring across all AI platforms with weekly insights."}',
    '{
      "en": [
        "10 AI prompts",
        "Weekly refresh",
        "Advanced analytics & KPIs",
        "Priority support"
      ],
      "es": [
        "10 prompts de IA",
        "Actualización semanal",
        "Análisis avanzado y KPIs",
        "Soporte prioritario"
      ],
      "pt-br": [
        "10 prompts de IA",
        "Atualização semanal",
        "Análise avançada e KPIs",
        "Suporte prioritário"
      ]
    }'
  ),
  (
    'Business', 799, true, 3,
    '{"max_prompts": 40, "refresh_rate": "daily", "description": "Full-power real-time monitoring for brands that demand visibility."}',
    '{
      "en": [
        "40 AI prompts",
        "Daily refresh",
        "Advanced analytics & KPIs",
        "Web search grounding",
        "Dedicated support"
      ],
      "es": [
        "40 prompts de IA",
        "Actualización diaria",
        "Análisis avanzado y KPIs",
        "Verificación de búsqueda web",
        "Soporte dedicado"
      ],
      "pt-br": [
        "40 prompts de IA",
        "Atualização diária",
        "Análise avançada e KPIs",
        "Verificação de busca web",
        "Suporte dedicado"
      ]
    }'
  ),
  (
    'Custom', 0, true, 4,
    '{"custom_pricing": true, "description": "Tailored AI monitoring solutions for agencies and large organizations."}',
    '{
      "en": [
        "Unlimited prompts",
        "Custom refresh rate",
        "Custom AI integrations",
        "SSO & SAML",
        "Dedicated account manager",
        "SLA guarantee",
        "On-premise deployment",
        "White-label reporting"
      ],
      "es": [
        "Prompts ilimitados",
        "Tasa de actualización personalizada",
        "Integraciones IA personalizadas",
        "SSO y SAML",
        "Gerente de cuenta dedicado",
        "Garantía SLA",
        "Implementación on-premise",
        "Reportes white-label"
      ],
      "pt-br": [
        "Prompts ilimitados",
        "Taxa de atualização personalizada",
        "Integrações IA personalizadas",
        "SSO e SAML",
        "Gerente de conta dedicado",
        "Garantia SLA",
        "Implantação on-premise",
        "Relatórios white-label"
      ]
    }'
  );

