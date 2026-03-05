-- Create table: faq (global, not tenant-scoped)
CREATE TABLE IF NOT EXISTS faq (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_en TEXT NOT NULL,
  answer_en TEXT NOT NULL,
  question_pt TEXT,
  answer_pt TEXT,
  question_es TEXT,
  answer_es TEXT,
  status TEXT NOT NULL DEFAULT 'public'
    CHECK (status IN ('public', 'private', 'inactive')),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index on status for filtered queries
CREATE INDEX IF NOT EXISTS idx_faq_status ON faq(status);

-- Enable RLS
ALTER TABLE faq ENABLE ROW LEVEL SECURITY;

-- SELECT policy: anonymous users see only public FAQs
CREATE POLICY "faq_select_anon"
  ON faq FOR SELECT
  TO anon
  USING (status = 'public');

-- SELECT policy: authenticated users see public + private FAQs
CREATE POLICY "faq_select_authenticated"
  ON faq FOR SELECT
  TO authenticated
  USING (status IN ('public', 'private'));

-- Updated_at trigger
CREATE TRIGGER set_faq_updated_at
  BEFORE UPDATE ON faq
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Seed existing FAQ items
INSERT INTO faq (question_en, answer_en, question_pt, answer_pt, question_es, answer_es, status, sort_order) VALUES
(
  'How does AI visibility monitoring work?',
  'We send your prompts to major AI platforms (ChatGPT, Claude, Gemini, Grok) and analyze the responses to see if and how your brand is mentioned. Results are updated on a schedule based on your plan.',
  'Como funciona o monitoramento de visibilidade em IA?',
  'Enviamos seus prompts às principais plataformas de IA (ChatGPT, Claude, Gemini, Grok) e analisamos as respostas para ver se e como sua marca é mencionada. Os resultados são atualizados conforme o cronograma do seu plano.',
  '¿Cómo funciona el monitoreo de visibilidad IA?',
  'Enviamos sus prompts a las principales plataformas de IA (ChatGPT, Claude, Gemini, Grok) y analizamos las respuestas para ver si y cómo se menciona su marca. Los resultados se actualizan según el calendario de su plan.',
  'public', 0
),
(
  'How often are my results updated?',
  'Update frequency depends on your plan: Starter plans refresh monthly, Growth plans refresh weekly, and Business plans refresh daily. Custom plans can have custom refresh rates.',
  'Com que frequência meus resultados são atualizados?',
  'A frequência de atualização depende do seu plano: planos Starter atualizam mensalmente, Growth semanalmente e Business diariamente. Planos personalizados podem ter taxas customizadas.',
  '¿Con qué frecuencia se actualizan mis resultados?',
  'La frecuencia de actualización depende de su plan: los planes Starter se actualizan mensualmente, los planes Growth semanalmente y los planes Business diariamente. Los planes personalizados pueden tener tasas personalizadas.',
  'public', 1
),
(
  'Can I change my plan at any time?',
  'Yes! You can upgrade or change your plan at any time from the Plans page. When upgrading, you''ll be charged a prorated amount for the remaining billing period.',
  'Posso mudar de plano a qualquer momento?',
  'Sim! Você pode fazer upgrade ou mudar de plano a qualquer momento na página de Planos. Ao fazer upgrade, será cobrado um valor proporcional pelo período restante de faturamento.',
  '¿Puedo cambiar mi plan en cualquier momento?',
  '¡Sí! Puede mejorar o cambiar su plan en cualquier momento desde la página de Planes. Al mejorar, se le cobrará un monto prorrateado por el período de facturación restante.',
  'public', 2
),
(
  'What is the LLM.txt file?',
  'LLM.txt is a specialized file you host on your website that provides AI scrapers with accurate, structured information about your business. It helps ensure AI platforms have the most up-to-date data about your brand.',
  'O que é o arquivo LLM.txt?',
  'LLM.txt é um arquivo especializado que você hospeda no seu site para fornecer aos scrapers de IA informações precisas e estruturadas sobre seu negócio. Ele garante que as plataformas de IA tenham os dados mais atualizados sobre sua marca.',
  '¿Qué es el archivo LLM.txt?',
  'LLM.txt es un archivo especializado que aloja en su sitio web y proporciona a los rastreadores de IA información precisa y estructurada sobre su negocio. Ayuda a garantizar que las plataformas de IA tengan los datos más actualizados sobre su marca.',
  'public', 3
),
(
  'How do I improve my GEO score?',
  'Your GEO score is based on 25 optimization factors across 4 categories: Technical, Content, Authority, and Semantic. Use the recommendations in your company analysis report to prioritize improvements.',
  'Como melhoro minha pontuação GEO?',
  'Sua pontuação GEO é baseada em 25 fatores de otimização em 4 categorias: Técnico, Conteúdo, Autoridade e Semântico. Use as recomendações do relatório de análise da sua empresa para priorizar melhorias.',
  '¿Cómo mejoro mi puntuación GEO?',
  'Su puntuación GEO se basa en 25 factores de optimización en 4 categorías: Técnico, Contenido, Autoridad y Semántico. Use las recomendaciones del informe de análisis de su empresa para priorizar mejoras.',
  'public', 4
),
(
  'Can I monitor multiple brands or clients?',
  'Yes! With multi-tenant workspaces, agencies and consultants can manage separate monitoring for each client. Each brand gets its own workspace, prompts, and visibility reports.',
  'Posso monitorar múltiplas marcas ou clientes?',
  'Sim! Com espaços multi-tenant, agências e consultores podem gerenciar monitoramento separado para cada cliente. Cada marca tem seu próprio espaço, prompts e relatórios de visibilidade.',
  '¿Puedo monitorear múltiples marcas o clientes?',
  '¡Sí! Con espacios multi-tenant, agencias y consultores pueden gestionar monitoreo separado para cada cliente. Cada marca tiene su propio espacio, prompts e informes de visibilidad.',
  'public', 5
);
