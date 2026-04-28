-- ============================================================================
-- Index AI — Seed real-world brands and ranking snapshots.
--
-- Companion to 20260427160000_ranking_taxonomy.sql. Populates the brand
-- catalog and the first wave of ranking snapshots for BR, ES, US, GLOBAL.
--
-- Brand selection is grounded in publicly recognized market leaders per
-- (sector, subsector, region). Scores are illustrative seeds; the ingestion
-- pipeline described in `_api-doc/ranking-research.md` should overwrite them.
-- ============================================================================

-- Sector labels per language are already in blog_brands.labels for legacy
-- compatibility. We always populate it for all 3 langs from the brand sector.

-- ─── FINANCIAL SERVICES ────────────────────────────────────────────────────

INSERT INTO blog_brands (id, name, country, sector, subsector_id, homepage_domain, entity_type, labels) VALUES
  -- Brazil banks
  ('itau',         'Itaú Unibanco',     'BR', 'financial-services', 'banks',            'itau.com.br',         'company', '{"pt":"Banco","es":"Banco","en":"Bank"}'::jsonb),
  ('bradesco',     'Bradesco',          'BR', 'financial-services', 'banks',            'bradesco.com.br',     'company', '{"pt":"Banco","es":"Banco","en":"Bank"}'::jsonb),
  ('santander-br', 'Santander Brasil',  'BR', 'financial-services', 'banks',            'santander.com.br',    'company', '{"pt":"Banco","es":"Banco","en":"Bank"}'::jsonb),
  ('btg-pactual',  'BTG Pactual',       'BR', 'financial-services', 'wealth-investing', 'btgpactual.com',      'company', '{"pt":"Banco de Investimento","es":"Banco de Inversión","en":"Investment Bank"}'::jsonb),
  ('banco-do-brasil','Banco do Brasil', 'BR', 'financial-services', 'banks',            'bb.com.br',           'company', '{"pt":"Banco","es":"Banco","en":"Bank"}'::jsonb),
  ('caixa',        'Caixa Econômica Federal', 'BR', 'financial-services', 'banks',      'caixa.gov.br',        'company', '{"pt":"Banco","es":"Banco","en":"Bank"}'::jsonb),
  -- Brazil fintech / neobanks
  ('nubank',       'Nubank',            'BR', 'financial-services', 'fintech-neobanks', 'nubank.com.br',       'company', '{"pt":"Fintech","es":"Fintech","en":"Fintech"}'::jsonb),
  ('inter',        'Banco Inter',       'BR', 'financial-services', 'fintech-neobanks', 'bancointer.com.br',   'company', '{"pt":"Fintech","es":"Fintech","en":"Fintech"}'::jsonb),
  ('c6-bank',      'C6 Bank',           'BR', 'financial-services', 'fintech-neobanks', 'c6bank.com.br',       'company', '{"pt":"Fintech","es":"Fintech","en":"Fintech"}'::jsonb),
  ('neon',         'Neon',              'BR', 'financial-services', 'fintech-neobanks', 'neon.com.br',         'company', '{"pt":"Fintech","es":"Fintech","en":"Fintech"}'::jsonb),
  -- Brazil payments
  ('picpay',       'PicPay',            'BR', 'financial-services', 'payments-wallets', 'picpay.com',          'company', '{"pt":"Pagamentos","es":"Pagos","en":"Payments"}'::jsonb),
  ('mercado-pago', 'Mercado Pago',      'BR', 'financial-services', 'payments-wallets', 'mercadopago.com.br',  'company', '{"pt":"Pagamentos","es":"Pagos","en":"Payments"}'::jsonb),
  ('pagbank',      'PagBank',           'BR', 'financial-services', 'payments-wallets', 'pagseguro.uol.com.br','company', '{"pt":"Pagamentos","es":"Pagos","en":"Payments"}'::jsonb),
  ('stone',        'Stone',             'BR', 'financial-services', 'payments-wallets', 'stone.com.br',        'company', '{"pt":"Pagamentos","es":"Pagos","en":"Payments"}'::jsonb),
  -- Brazil insurance
  ('porto-seguro', 'Porto Seguro',      'BR', 'financial-services', 'insurance',        'portoseguro.com.br',  'company', '{"pt":"Seguros","es":"Seguros","en":"Insurance"}'::jsonb),
  ('bradesco-seguros','Bradesco Seguros','BR','financial-services', 'insurance',        'bradescoseguros.com.br','company','{"pt":"Seguros","es":"Seguros","en":"Insurance"}'::jsonb),
  ('sulamerica',   'SulAmérica',        'BR', 'financial-services', 'insurance',        'sulamerica.com.br',   'company', '{"pt":"Seguros","es":"Seguros","en":"Insurance"}'::jsonb),
  -- Brazil wealth
  ('xp-investimentos','XP Investimentos','BR','financial-services', 'wealth-investing', 'xpi.com.br',          'company', '{"pt":"Investimentos","es":"Inversión","en":"Wealth"}'::jsonb),

  -- Spain banks
  ('bbva',         'BBVA',              'ES', 'financial-services', 'banks',            'bbva.com',            'company', '{"pt":"Banco","es":"Banco","en":"Bank"}'::jsonb),
  ('santander-es', 'Banco Santander',   'ES', 'financial-services', 'banks',            'santander.com',       'company', '{"pt":"Banco","es":"Banco","en":"Bank"}'::jsonb),
  ('caixabank',    'CaixaBank',         'ES', 'financial-services', 'banks',            'caixabank.es',        'company', '{"pt":"Banco","es":"Banco","en":"Bank"}'::jsonb),
  ('bankinter',    'Bankinter',         'ES', 'financial-services', 'banks',            'bankinter.com',       'company', '{"pt":"Banco","es":"Banco","en":"Bank"}'::jsonb),
  ('sabadell',     'Banco Sabadell',    'ES', 'financial-services', 'banks',            'bancsabadell.com',    'company', '{"pt":"Banco","es":"Banco","en":"Bank"}'::jsonb),
  ('ing-es',       'ING España',        'ES', 'financial-services', 'banks',            'ing.es',              'company', '{"pt":"Banco","es":"Banco","en":"Bank"}'::jsonb),
  -- Spain neobanks/fintech
  ('openbank',     'Openbank',          'ES', 'financial-services', 'fintech-neobanks', 'openbank.es',         'company', '{"pt":"Fintech","es":"Fintech","en":"Fintech"}'::jsonb),
  ('revolut-es',   'Revolut',           'ES', 'financial-services', 'fintech-neobanks', 'revolut.com',         'company', '{"pt":"Fintech","es":"Fintech","en":"Fintech"}'::jsonb),
  ('n26-es',       'N26',               'ES', 'financial-services', 'fintech-neobanks', 'n26.com',             'company', '{"pt":"Fintech","es":"Fintech","en":"Fintech"}'::jsonb),
  -- Spain payments
  ('bizum',        'Bizum',             'ES', 'financial-services', 'payments-wallets', 'bizum.es',            'company', '{"pt":"Pagamentos","es":"Pagos","en":"Payments"}'::jsonb),
  -- Spain insurance
  ('mapfre',       'MAPFRE',            'ES', 'financial-services', 'insurance',        'mapfre.com',          'company', '{"pt":"Seguros","es":"Seguros","en":"Insurance"}'::jsonb),
  ('mutua-madrilena','Mutua Madrileña', 'ES', 'financial-services', 'insurance',        'mutua.es',            'company', '{"pt":"Seguros","es":"Seguros","en":"Insurance"}'::jsonb),

  -- US banks + fintech + insurance + payments + wealth
  ('jpmorgan-chase','JPMorgan Chase',   'US', 'financial-services', 'banks',            'chase.com',           'company', '{"pt":"Banco","es":"Banco","en":"Bank"}'::jsonb),
  ('bank-of-america','Bank of America', 'US', 'financial-services', 'banks',            'bankofamerica.com',   'company', '{"pt":"Banco","es":"Banco","en":"Bank"}'::jsonb),
  ('wells-fargo',  'Wells Fargo',       'US', 'financial-services', 'banks',            'wellsfargo.com',      'company', '{"pt":"Banco","es":"Banco","en":"Bank"}'::jsonb),
  ('citi',         'Citigroup',         'US', 'financial-services', 'banks',            'citi.com',            'company', '{"pt":"Banco","es":"Banco","en":"Bank"}'::jsonb),
  ('goldman-sachs','Goldman Sachs',     'US', 'financial-services', 'wealth-investing', 'goldmansachs.com',    'company', '{"pt":"Banco de Investimento","es":"Banco de Inversión","en":"Investment Bank"}'::jsonb),
  ('morgan-stanley','Morgan Stanley',   'US', 'financial-services', 'wealth-investing', 'morganstanley.com',   'company', '{"pt":"Investimentos","es":"Inversión","en":"Wealth"}'::jsonb),
  ('capital-one',  'Capital One',       'US', 'financial-services', 'banks',            'capitalone.com',      'company', '{"pt":"Banco","es":"Banco","en":"Bank"}'::jsonb),
  ('us-bancorp',   'U.S. Bancorp',      'US', 'financial-services', 'banks',            'usbank.com',          'company', '{"pt":"Banco","es":"Banco","en":"Bank"}'::jsonb),
  ('chime',        'Chime',             'US', 'financial-services', 'fintech-neobanks', 'chime.com',           'company', '{"pt":"Fintech","es":"Fintech","en":"Fintech"}'::jsonb),
  ('sofi',         'SoFi',              'US', 'financial-services', 'fintech-neobanks', 'sofi.com',            'company', '{"pt":"Fintech","es":"Fintech","en":"Fintech"}'::jsonb),
  ('cash-app',     'Cash App',          'US', 'financial-services', 'payments-wallets', 'cash.app',            'company', '{"pt":"Pagamentos","es":"Pagos","en":"Payments"}'::jsonb),
  ('paypal',       'PayPal',            'US', 'financial-services', 'payments-wallets', 'paypal.com',          'company', '{"pt":"Pagamentos","es":"Pagos","en":"Payments"}'::jsonb),
  ('venmo',        'Venmo',             'US', 'financial-services', 'payments-wallets', 'venmo.com',           'company', '{"pt":"Pagamentos","es":"Pagos","en":"Payments"}'::jsonb),
  ('robinhood',    'Robinhood',         'US', 'financial-services', 'wealth-investing', 'robinhood.com',       'company', '{"pt":"Investimentos","es":"Inversión","en":"Wealth"}'::jsonb),
  ('fidelity',     'Fidelity',          'US', 'financial-services', 'wealth-investing', 'fidelity.com',        'company', '{"pt":"Investimentos","es":"Inversión","en":"Wealth"}'::jsonb),
  ('charles-schwab','Charles Schwab',   'US', 'financial-services', 'wealth-investing', 'schwab.com',          'company', '{"pt":"Investimentos","es":"Inversión","en":"Wealth"}'::jsonb),
  ('vanguard',     'Vanguard',          'US', 'financial-services', 'wealth-investing', 'vanguard.com',        'company', '{"pt":"Investimentos","es":"Inversión","en":"Wealth"}'::jsonb),
  ('geico',        'GEICO',             'US', 'financial-services', 'insurance',        'geico.com',           'company', '{"pt":"Seguros","es":"Seguros","en":"Insurance"}'::jsonb),
  ('state-farm',   'State Farm',        'US', 'financial-services', 'insurance',        'statefarm.com',       'company', '{"pt":"Seguros","es":"Seguros","en":"Insurance"}'::jsonb),
  ('progressive',  'Progressive',       'US', 'financial-services', 'insurance',        'progressive.com',     'company', '{"pt":"Seguros","es":"Seguros","en":"Insurance"}'::jsonb);

-- ─── HEALTHCARE ─────────────────────────────────────────────────────────────

INSERT INTO blog_brands (id, name, country, sector, subsector_id, homepage_domain, entity_type, labels) VALUES
  -- Brazil hospitals + plans
  ('hsl-einstein',     'Hospital Israelita Albert Einstein', 'BR', 'healthcare', 'hospitals', 'einstein.br',      'hospital', '{"pt":"Hospital","es":"Hospital","en":"Hospital"}'::jsonb),
  ('hsl-sirio-libanes','Hospital Sírio-Libanês',             'BR', 'healthcare', 'hospitals', 'hospitalsiriolibanes.org.br','hospital','{"pt":"Hospital","es":"Hospital","en":"Hospital"}'::jsonb),
  ('hapvida',          'Hapvida NotreDame Intermédica',      'BR', 'healthcare', 'health-plans', 'hapvida.com.br', 'company',  '{"pt":"Plano de Saúde","es":"Plan de Salud","en":"Health Plan"}'::jsonb),
  ('amil',             'Amil',                               'BR', 'healthcare', 'health-plans', 'amil.com.br',    'company',  '{"pt":"Plano de Saúde","es":"Plan de Salud","en":"Health Plan"}'::jsonb),
  ('bradesco-saude',   'Bradesco Saúde',                     'BR', 'healthcare', 'health-plans', 'bradescosaude.com.br','company','{"pt":"Plano de Saúde","es":"Plan de Salud","en":"Health Plan"}'::jsonb),
  ('fleury',           'Fleury',                             'BR', 'healthcare', 'labs-diagnostics', 'fleury.com.br','company','{"pt":"Laboratório","es":"Laboratorio","en":"Lab"}'::jsonb),
  ('dasa',             'Dasa',                               'BR', 'healthcare', 'labs-diagnostics', 'dasa.com.br',  'company', '{"pt":"Laboratório","es":"Laboratorio","en":"Lab"}'::jsonb),
  ('conexa-saude',     'Conexa Saúde',                       'BR', 'healthcare', 'telehealth',  'conexasaude.com.br','company','{"pt":"Telemedicina","es":"Telemedicina","en":"Telehealth"}'::jsonb),

  -- Spain hospitals + plans
  ('quironsalud',      'Quirónsalud',                        'ES', 'healthcare', 'hospitals',   'quironsalud.es',  'company',  '{"pt":"Hospital","es":"Hospital","en":"Hospital"}'::jsonb),
  ('hosp-la-paz',      'Hospital Universitario La Paz',      'ES', 'healthcare', 'hospitals',   'comunidad.madrid','hospital', '{"pt":"Hospital","es":"Hospital","en":"Hospital"}'::jsonb),
  ('hosp-clinic-bcn',  'Hospital Clínic de Barcelona',       'ES', 'healthcare', 'hospitals',   'hospitalclinic.org','hospital','{"pt":"Hospital","es":"Hospital","en":"Hospital"}'::jsonb),
  ('sanitas',          'Sanitas',                            'ES', 'healthcare', 'health-plans','sanitas.es',      'company',  '{"pt":"Plano de Saúde","es":"Plan de Salud","en":"Health Plan"}'::jsonb),
  ('adeslas',          'SegurCaixa Adeslas',                 'ES', 'healthcare', 'health-plans','adeslas.es',      'company',  '{"pt":"Plano de Saúde","es":"Plan de Salud","en":"Health Plan"}'::jsonb),
  ('dkv-seguros',      'DKV Seguros',                        'ES', 'healthcare', 'health-plans','dkvseguros.es',   'company',  '{"pt":"Plano de Saúde","es":"Plan de Salud","en":"Health Plan"}'::jsonb),

  -- US hospitals + plans + telehealth + pharma + diagnostics
  ('mayo-clinic',      'Mayo Clinic',                        'US', 'healthcare', 'hospitals',   'mayoclinic.org',  'hospital', '{"pt":"Hospital","es":"Hospital","en":"Hospital"}'::jsonb),
  ('cleveland-clinic', 'Cleveland Clinic',                   'US', 'healthcare', 'hospitals',   'clevelandclinic.org','hospital','{"pt":"Hospital","es":"Hospital","en":"Hospital"}'::jsonb),
  ('johns-hopkins',    'Johns Hopkins Medicine',             'US', 'healthcare', 'hospitals',   'hopkinsmedicine.org','hospital','{"pt":"Hospital","es":"Hospital","en":"Hospital"}'::jsonb),
  ('mass-general',     'Massachusetts General Hospital',     'US', 'healthcare', 'hospitals',   'massgeneral.org', 'hospital', '{"pt":"Hospital","es":"Hospital","en":"Hospital"}'::jsonb),
  ('kaiser-permanente','Kaiser Permanente',                  'US', 'healthcare', 'health-plans','kp.org',          'company',  '{"pt":"Plano de Saúde","es":"Plan de Salud","en":"Health Plan"}'::jsonb),
  ('unitedhealth',     'UnitedHealth Group',                 'US', 'healthcare', 'health-plans','unitedhealthgroup.com','company','{"pt":"Plano de Saúde","es":"Plan de Salud","en":"Health Plan"}'::jsonb),
  ('elevance-health',  'Elevance Health',                    'US', 'healthcare', 'health-plans','elevancehealth.com','company','{"pt":"Plano de Saúde","es":"Plan de Salud","en":"Health Plan"}'::jsonb),
  ('cigna',            'Cigna',                              'US', 'healthcare', 'health-plans','cigna.com',       'company',  '{"pt":"Plano de Saúde","es":"Plan de Salud","en":"Health Plan"}'::jsonb),
  ('humana',           'Humana',                             'US', 'healthcare', 'health-plans','humana.com',      'company',  '{"pt":"Plano de Saúde","es":"Plan de Salud","en":"Health Plan"}'::jsonb),
  ('teladoc',          'Teladoc Health',                     'US', 'healthcare', 'telehealth',  'teladochealth.com','company', '{"pt":"Telemedicina","es":"Telemedicina","en":"Telehealth"}'::jsonb),
  ('amwell',           'Amwell',                             'US', 'healthcare', 'telehealth',  'amwell.com',      'company',  '{"pt":"Telemedicina","es":"Telemedicina","en":"Telehealth"}'::jsonb),
  ('mdlive',           'MDLive',                             'US', 'healthcare', 'telehealth',  'mdlive.com',      'company',  '{"pt":"Telemedicina","es":"Telemedicina","en":"Telehealth"}'::jsonb),
  ('pfizer',           'Pfizer',                             'GLOBAL','healthcare','pharma-brands','pfizer.com',   'company',  '{"pt":"Farmacêutica","es":"Farmacéutica","en":"Pharma"}'::jsonb),
  ('johnson-johnson',  'Johnson & Johnson',                  'GLOBAL','healthcare','pharma-brands','jnj.com',      'company',  '{"pt":"Farmacêutica","es":"Farmacéutica","en":"Pharma"}'::jsonb),
  ('merck',            'Merck',                              'GLOBAL','healthcare','pharma-brands','merck.com',    'company',  '{"pt":"Farmacêutica","es":"Farmacéutica","en":"Pharma"}'::jsonb),
  ('eli-lilly',        'Eli Lilly',                          'GLOBAL','healthcare','pharma-brands','lilly.com',    'company',  '{"pt":"Farmacêutica","es":"Farmacéutica","en":"Pharma"}'::jsonb),
  ('roche',            'Roche',                              'GLOBAL','healthcare','pharma-brands','roche.com',    'company',  '{"pt":"Farmacêutica","es":"Farmacéutica","en":"Pharma"}'::jsonb),
  ('novartis',         'Novartis',                           'GLOBAL','healthcare','pharma-brands','novartis.com', 'company',  '{"pt":"Farmacêutica","es":"Farmacéutica","en":"Pharma"}'::jsonb),
  ('labcorp',          'Labcorp',                            'US',   'healthcare','labs-diagnostics','labcorp.com','company', '{"pt":"Laboratório","es":"Laboratorio","en":"Lab"}'::jsonb),
  ('quest-diagnostics','Quest Diagnostics',                  'US',   'healthcare','labs-diagnostics','questdiagnostics.com','company','{"pt":"Laboratório","es":"Laboratorio","en":"Lab"}'::jsonb);

-- ─── EDUCATION ──────────────────────────────────────────────────────────────

INSERT INTO blog_brands (id, name, country, sector, subsector_id, homepage_domain, entity_type, labels) VALUES
  -- Universities (global ranking)
  ('harvard',          'Harvard University',         'US',     'education', 'universities',   'harvard.edu',         'university', '{"pt":"Universidade","es":"Universidad","en":"University"}'::jsonb),
  ('mit',              'MIT',                        'US',     'education', 'universities',   'mit.edu',             'university', '{"pt":"Universidade","es":"Universidad","en":"University"}'::jsonb),
  ('stanford',         'Stanford University',        'US',     'education', 'universities',   'stanford.edu',        'university', '{"pt":"Universidade","es":"Universidad","en":"University"}'::jsonb),
  ('oxford',           'University of Oxford',       'GLOBAL', 'education', 'universities',   'ox.ac.uk',            'university', '{"pt":"Universidade","es":"Universidad","en":"University"}'::jsonb),
  ('cambridge',        'University of Cambridge',    'GLOBAL', 'education', 'universities',   'cam.ac.uk',           'university', '{"pt":"Universidade","es":"Universidad","en":"University"}'::jsonb),
  ('princeton',        'Princeton University',       'US',     'education', 'universities',   'princeton.edu',       'university', '{"pt":"Universidade","es":"Universidad","en":"University"}'::jsonb),
  ('yale',             'Yale University',            'US',     'education', 'universities',   'yale.edu',            'university', '{"pt":"Universidade","es":"Universidad","en":"University"}'::jsonb),
  ('caltech',          'Caltech',                    'US',     'education', 'universities',   'caltech.edu',         'university', '{"pt":"Universidade","es":"Universidad","en":"University"}'::jsonb),
  ('imperial',         'Imperial College London',    'GLOBAL', 'education', 'universities',   'imperial.ac.uk',      'university', '{"pt":"Universidade","es":"Universidad","en":"University"}'::jsonb),
  -- Brazil universities
  ('usp',              'Universidade de São Paulo',  'BR',     'education', 'universities',   'usp.br',              'university', '{"pt":"Universidade","es":"Universidad","en":"University"}'::jsonb),
  ('unicamp',          'Unicamp',                    'BR',     'education', 'universities',   'unicamp.br',          'university', '{"pt":"Universidade","es":"Universidad","en":"University"}'::jsonb),
  ('ufrj',             'UFRJ',                       'BR',     'education', 'universities',   'ufrj.br',             'university', '{"pt":"Universidade","es":"Universidad","en":"University"}'::jsonb),
  -- Spain universities
  ('uam-madrid',       'Universidad Autónoma de Madrid','ES',  'education', 'universities',   'uam.es',              'university', '{"pt":"Universidade","es":"Universidad","en":"University"}'::jsonb),
  ('ub-barcelona',     'Universitat de Barcelona',   'ES',     'education', 'universities',   'ub.edu',              'university', '{"pt":"Universidade","es":"Universidad","en":"University"}'::jsonb),
  ('complutense',      'Universidad Complutense',    'ES',     'education', 'universities',   'ucm.es',              'university', '{"pt":"Universidade","es":"Universidad","en":"University"}'::jsonb),

  -- Business schools
  ('hbs',              'Harvard Business School',    'US',     'education', 'business-schools','hbs.edu',             'school',     '{"pt":"Escola de Negócios","es":"Escuela de Negocios","en":"Business School"}'::jsonb),
  ('wharton',          'Wharton School',             'US',     'education', 'business-schools','wharton.upenn.edu',   'school',     '{"pt":"Escola de Negócios","es":"Escuela de Negocios","en":"Business School"}'::jsonb),
  ('stanford-gsb',     'Stanford GSB',               'US',     'education', 'business-schools','gsb.stanford.edu',    'school',     '{"pt":"Escola de Negócios","es":"Escuela de Negocios","en":"Business School"}'::jsonb),
  ('insead',           'INSEAD',                     'GLOBAL', 'education', 'business-schools','insead.edu',          'school',     '{"pt":"Escola de Negócios","es":"Escuela de Negocios","en":"Business School"}'::jsonb),
  ('ie-business',      'IE Business School',         'ES',     'education', 'business-schools','ie.edu',              'school',     '{"pt":"Escola de Negócios","es":"Escuela de Negocios","en":"Business School"}'::jsonb),
  ('iese',             'IESE Business School',       'ES',     'education', 'business-schools','iese.edu',            'school',     '{"pt":"Escola de Negócios","es":"Escuela de Negocios","en":"Business School"}'::jsonb),
  ('esade',            'ESADE Business School',      'ES',     'education', 'business-schools','esade.edu',           'school',     '{"pt":"Escola de Negócios","es":"Escuela de Negocios","en":"Business School"}'::jsonb),
  ('fgv',              'FGV',                        'BR',     'education', 'business-schools','fgv.br',              'school',     '{"pt":"Escola de Negócios","es":"Escuela de Negocios","en":"Business School"}'::jsonb),
  ('insper',           'Insper',                     'BR',     'education', 'business-schools','insper.edu.br',       'school',     '{"pt":"Escola de Negócios","es":"Escuela de Negocios","en":"Business School"}'::jsonb),

  -- Online learning
  ('coursera',         'Coursera',                   'GLOBAL', 'education', 'online-learning','coursera.org',        'company',    '{"pt":"Educação Online","es":"Educación Online","en":"Online Learning"}'::jsonb),
  ('edx',              'edX',                        'GLOBAL', 'education', 'online-learning','edx.org',             'company',    '{"pt":"Educação Online","es":"Educación Online","en":"Online Learning"}'::jsonb),
  ('udacity',          'Udacity',                    'GLOBAL', 'education', 'online-learning','udacity.com',         'company',    '{"pt":"Educação Online","es":"Educación Online","en":"Online Learning"}'::jsonb),
  ('khan-academy',     'Khan Academy',               'GLOBAL', 'education', 'online-learning','khanacademy.org',     'company',    '{"pt":"Educação Online","es":"Educación Online","en":"Online Learning"}'::jsonb),
  ('udemy',            'Udemy',                      'GLOBAL', 'education', 'online-learning','udemy.com',           'company',    '{"pt":"Educação Online","es":"Educación Online","en":"Online Learning"}'::jsonb),
  ('alura',            'Alura',                      'BR',     'education', 'online-learning','alura.com.br',        'company',    '{"pt":"Educação Online","es":"Educación Online","en":"Online Learning"}'::jsonb),
  ('hotmart',          'Hotmart',                    'BR',     'education', 'online-learning','hotmart.com',         'company',    '{"pt":"Educação Online","es":"Educación Online","en":"Online Learning"}'::jsonb);

-- ─── RETAIL & E-COMMERCE ────────────────────────────────────────────────────

INSERT INTO blog_brands (id, name, country, sector, subsector_id, homepage_domain, entity_type, labels) VALUES
  -- Marketplaces (global + regional)
  ('amazon',           'Amazon',                'GLOBAL', 'retail-ecommerce', 'marketplaces', 'amazon.com',          'company', '{"pt":"Marketplace","es":"Marketplace","en":"Marketplace"}'::jsonb),
  ('mercado-livre',    'Mercado Livre',         'BR',     'retail-ecommerce', 'marketplaces', 'mercadolivre.com.br', 'company', '{"pt":"Marketplace","es":"Marketplace","en":"Marketplace"}'::jsonb),
  ('magalu',           'Magazine Luiza',        'BR',     'retail-ecommerce', 'marketplaces', 'magazineluiza.com.br','company', '{"pt":"Varejo","es":"Retail","en":"Retail"}'::jsonb),
  ('americanas',       'Americanas',            'BR',     'retail-ecommerce', 'marketplaces', 'americanas.com.br',   'company', '{"pt":"Varejo","es":"Retail","en":"Retail"}'::jsonb),
  ('casas-bahia',      'Casas Bahia',           'BR',     'retail-ecommerce', 'marketplaces', 'casasbahia.com.br',   'company', '{"pt":"Varejo","es":"Retail","en":"Retail"}'::jsonb),
  ('shopee-br',        'Shopee Brasil',         'BR',     'retail-ecommerce', 'marketplaces', 'shopee.com.br',       'company', '{"pt":"Marketplace","es":"Marketplace","en":"Marketplace"}'::jsonb),
  ('el-corte-ingles',  'El Corte Inglés',       'ES',     'retail-ecommerce', 'marketplaces', 'elcorteingles.es',    'company', '{"pt":"Varejo","es":"Retail","en":"Retail"}'::jsonb),
  ('pccomponentes',    'PcComponentes',         'ES',     'retail-ecommerce', 'electronics-retail','pccomponentes.com','company','{"pt":"Eletrônicos","es":"Electrónica","en":"Electronics"}'::jsonb),
  ('walmart',          'Walmart',               'US',     'retail-ecommerce', 'marketplaces', 'walmart.com',         'company', '{"pt":"Varejo","es":"Retail","en":"Retail"}'::jsonb),
  ('ebay',             'eBay',                  'GLOBAL', 'retail-ecommerce', 'marketplaces', 'ebay.com',            'company', '{"pt":"Marketplace","es":"Marketplace","en":"Marketplace"}'::jsonb),
  ('alibaba',          'Alibaba',               'GLOBAL', 'retail-ecommerce', 'marketplaces', 'alibaba.com',         'company', '{"pt":"Marketplace","es":"Marketplace","en":"Marketplace"}'::jsonb),
  -- Electronics retail
  ('best-buy',         'Best Buy',              'US',     'retail-ecommerce', 'electronics-retail','bestbuy.com',    'company', '{"pt":"Eletrônicos","es":"Electrónica","en":"Electronics"}'::jsonb),
  ('mediamarkt',       'MediaMarkt',            'ES',     'retail-ecommerce', 'electronics-retail','mediamarkt.es',  'company', '{"pt":"Eletrônicos","es":"Electrónica","en":"Electronics"}'::jsonb),
  -- Home goods
  ('ikea',             'IKEA',                  'GLOBAL', 'retail-ecommerce', 'home-goods',   'ikea.com',            'company', '{"pt":"Casa e Móveis","es":"Hogar y Muebles","en":"Home Goods"}'::jsonb),
  ('wayfair',          'Wayfair',               'US',     'retail-ecommerce', 'home-goods',   'wayfair.com',         'company', '{"pt":"Casa e Móveis","es":"Hogar y Muebles","en":"Home Goods"}'::jsonb),
  -- Pharmacy
  ('cvs',              'CVS Pharmacy',          'US',     'retail-ecommerce', 'pharmacy-retail','cvs.com',           'company', '{"pt":"Farmácia","es":"Farmacia","en":"Pharmacy"}'::jsonb),
  ('walgreens',        'Walgreens',             'US',     'retail-ecommerce', 'pharmacy-retail','walgreens.com',     'company', '{"pt":"Farmácia","es":"Farmacia","en":"Pharmacy"}'::jsonb),
  ('drogasil',         'Drogasil',              'BR',     'retail-ecommerce', 'pharmacy-retail','drogasil.com.br',   'company', '{"pt":"Farmácia","es":"Farmacia","en":"Pharmacy"}'::jsonb),
  ('drogaraia',        'Droga Raia',            'BR',     'retail-ecommerce', 'pharmacy-retail','drogaraia.com.br',  'company', '{"pt":"Farmácia","es":"Farmacia","en":"Pharmacy"}'::jsonb);

-- ─── TRAVEL & HOSPITALITY ──────────────────────────────────────────────────

INSERT INTO blog_brands (id, name, country, sector, subsector_id, homepage_domain, entity_type, labels) VALUES
  -- Hotels (global)
  ('marriott',     'Marriott International', 'GLOBAL', 'travel-hospitality', 'hotels-resorts',   'marriott.com',  'company', '{"pt":"Rede Hoteleira","es":"Cadena Hotelera","en":"Hotel Group"}'::jsonb),
  ('hilton',       'Hilton',                 'GLOBAL', 'travel-hospitality', 'hotels-resorts',   'hilton.com',    'company', '{"pt":"Rede Hoteleira","es":"Cadena Hotelera","en":"Hotel Group"}'::jsonb),
  ('hyatt',        'Hyatt',                  'GLOBAL', 'travel-hospitality', 'hotels-resorts',   'hyatt.com',     'company', '{"pt":"Rede Hoteleira","es":"Cadena Hotelera","en":"Hotel Group"}'::jsonb),
  ('ihg',          'IHG Hotels',             'GLOBAL', 'travel-hospitality', 'hotels-resorts',   'ihg.com',       'company', '{"pt":"Rede Hoteleira","es":"Cadena Hotelera","en":"Hotel Group"}'::jsonb),
  ('accor',        'Accor',                  'GLOBAL', 'travel-hospitality', 'hotels-resorts',   'accor.com',     'company', '{"pt":"Rede Hoteleira","es":"Cadena Hotelera","en":"Hotel Group"}'::jsonb),
  -- OTAs
  ('booking',      'Booking.com',            'GLOBAL', 'travel-hospitality', 'otas-metasearch',  'booking.com',   'company', '{"pt":"OTA","es":"OTA","en":"OTA"}'::jsonb),
  ('expedia',      'Expedia',                'GLOBAL', 'travel-hospitality', 'otas-metasearch',  'expedia.com',   'company', '{"pt":"OTA","es":"OTA","en":"OTA"}'::jsonb),
  ('trip-com',     'Trip.com',               'GLOBAL', 'travel-hospitality', 'otas-metasearch',  'trip.com',      'company', '{"pt":"OTA","es":"OTA","en":"OTA"}'::jsonb),
  ('airbnb',       'Airbnb',                 'GLOBAL', 'travel-hospitality', 'vacation-rentals', 'airbnb.com',    'company', '{"pt":"Aluguel por Temporada","es":"Alquiler Vacacional","en":"Vacation Rental"}'::jsonb),
  ('vrbo',         'Vrbo',                   'US',     'travel-hospitality', 'vacation-rentals', 'vrbo.com',      'company', '{"pt":"Aluguel por Temporada","es":"Alquiler Vacacional","en":"Vacation Rental"}'::jsonb),
  ('kayak',        'Kayak',                  'GLOBAL', 'travel-hospitality', 'otas-metasearch',  'kayak.com',     'company', '{"pt":"Metabuscador","es":"Metabuscador","en":"Metasearch"}'::jsonb),
  -- Airlines
  ('delta',        'Delta Air Lines',        'US',     'travel-hospitality', 'airlines',         'delta.com',     'company', '{"pt":"Companhia Aérea","es":"Aerolínea","en":"Airline"}'::jsonb),
  ('united',       'United Airlines',        'US',     'travel-hospitality', 'airlines',         'united.com',    'company', '{"pt":"Companhia Aérea","es":"Aerolínea","en":"Airline"}'::jsonb),
  ('american-airlines','American Airlines',  'US',     'travel-hospitality', 'airlines',         'aa.com',        'company', '{"pt":"Companhia Aérea","es":"Aerolínea","en":"Airline"}'::jsonb),
  ('emirates',     'Emirates',               'GLOBAL', 'travel-hospitality', 'airlines',         'emirates.com',  'company', '{"pt":"Companhia Aérea","es":"Aerolínea","en":"Airline"}'::jsonb),
  ('qatar-airways','Qatar Airways',          'GLOBAL', 'travel-hospitality', 'airlines',         'qatarairways.com','company','{"pt":"Companhia Aérea","es":"Aerolínea","en":"Airline"}'::jsonb),
  ('lufthansa',    'Lufthansa',              'GLOBAL', 'travel-hospitality', 'airlines',         'lufthansa.com', 'company', '{"pt":"Companhia Aérea","es":"Aerolínea","en":"Airline"}'::jsonb),
  ('latam',        'LATAM Airlines',         'BR',     'travel-hospitality', 'airlines',         'latamairlines.com','company','{"pt":"Companhia Aérea","es":"Aerolínea","en":"Airline"}'::jsonb),
  ('gol',          'GOL Linhas Aéreas',      'BR',     'travel-hospitality', 'airlines',         'voegol.com.br', 'company', '{"pt":"Companhia Aérea","es":"Aerolínea","en":"Airline"}'::jsonb),
  ('azul',         'Azul Linhas Aéreas',     'BR',     'travel-hospitality', 'airlines',         'voeazul.com.br','company', '{"pt":"Companhia Aérea","es":"Aerolínea","en":"Airline"}'::jsonb),
  ('iberia',       'Iberia',                 'ES',     'travel-hospitality', 'airlines',         'iberia.com',    'company', '{"pt":"Companhia Aérea","es":"Aerolínea","en":"Airline"}'::jsonb),
  ('vueling',      'Vueling',                'ES',     'travel-hospitality', 'airlines',         'vueling.com',   'company', '{"pt":"Companhia Aérea","es":"Aerolínea","en":"Airline"}'::jsonb),
  ('air-europa',   'Air Europa',             'ES',     'travel-hospitality', 'airlines',         'aireuropa.com', 'company', '{"pt":"Companhia Aérea","es":"Aerolínea","en":"Airline"}'::jsonb);

-- ─── CONSUMER BRANDS (BEAUTY/FASHION) ──────────────────────────────────────

INSERT INTO blog_brands (id, name, country, sector, subsector_id, homepage_domain, entity_type, labels) VALUES
  -- Beauty
  ('loreal',       'L''Oréal',         'GLOBAL', 'consumer-brands', 'beauty-cosmetics',  'loreal.com',     'company', '{"pt":"Beleza","es":"Belleza","en":"Beauty"}'::jsonb),
  ('estee-lauder', 'Estée Lauder',     'GLOBAL', 'consumer-brands', 'beauty-cosmetics',  'esteelauder.com','company', '{"pt":"Beleza","es":"Belleza","en":"Beauty"}'::jsonb),
  ('sephora',      'Sephora',          'GLOBAL', 'consumer-brands', 'beauty-cosmetics',  'sephora.com',    'company', '{"pt":"Beleza","es":"Belleza","en":"Beauty"}'::jsonb),
  ('mac-cosmetics','MAC Cosmetics',    'GLOBAL', 'consumer-brands', 'beauty-cosmetics',  'maccosmetics.com','company','{"pt":"Beleza","es":"Belleza","en":"Beauty"}'::jsonb),
  ('natura',       'Natura',           'BR',     'consumer-brands', 'beauty-cosmetics',  'natura.com.br',  'company', '{"pt":"Beleza","es":"Belleza","en":"Beauty"}'::jsonb),
  ('boticario',    'O Boticário',      'BR',     'consumer-brands', 'beauty-cosmetics',  'boticario.com.br','company','{"pt":"Beleza","es":"Belleza","en":"Beauty"}'::jsonb),
  ('avon',         'Avon',             'GLOBAL', 'consumer-brands', 'beauty-cosmetics',  'avon.com',       'company', '{"pt":"Beleza","es":"Belleza","en":"Beauty"}'::jsonb),
  -- Luxury
  ('lvmh',         'LVMH',             'GLOBAL', 'consumer-brands', 'luxury-fashion',    'lvmh.com',       'company', '{"pt":"Luxo","es":"Lujo","en":"Luxury"}'::jsonb),
  ('hermes',       'Hermès',           'GLOBAL', 'consumer-brands', 'luxury-fashion',    'hermes.com',     'company', '{"pt":"Luxo","es":"Lujo","en":"Luxury"}'::jsonb),
  ('chanel',       'Chanel',           'GLOBAL', 'consumer-brands', 'luxury-fashion',    'chanel.com',     'company', '{"pt":"Luxo","es":"Lujo","en":"Luxury"}'::jsonb),
  ('gucci',        'Gucci',            'GLOBAL', 'consumer-brands', 'luxury-fashion',    'gucci.com',      'company', '{"pt":"Luxo","es":"Lujo","en":"Luxury"}'::jsonb),
  ('prada',        'Prada',            'GLOBAL', 'consumer-brands', 'luxury-fashion',    'prada.com',      'company', '{"pt":"Luxo","es":"Lujo","en":"Luxury"}'::jsonb),
  ('dior',         'Dior',             'GLOBAL', 'consumer-brands', 'luxury-fashion',    'dior.com',       'company', '{"pt":"Luxo","es":"Lujo","en":"Luxury"}'::jsonb),
  -- Fast fashion
  ('zara',         'Zara',             'GLOBAL', 'consumer-brands', 'apparel-fast-fashion','zara.com',     'company', '{"pt":"Moda","es":"Moda","en":"Apparel"}'::jsonb),
  ('hm',           'H&M',              'GLOBAL', 'consumer-brands', 'apparel-fast-fashion','hm.com',       'company', '{"pt":"Moda","es":"Moda","en":"Apparel"}'::jsonb),
  ('uniqlo',       'Uniqlo',           'GLOBAL', 'consumer-brands', 'apparel-fast-fashion','uniqlo.com',   'company', '{"pt":"Moda","es":"Moda","en":"Apparel"}'::jsonb),
  ('shein',        'SHEIN',            'GLOBAL', 'consumer-brands', 'apparel-fast-fashion','shein.com',    'company', '{"pt":"Moda","es":"Moda","en":"Apparel"}'::jsonb),
  ('inditex',      'Inditex',          'ES',     'consumer-brands', 'apparel-fast-fashion','inditex.com',  'company', '{"pt":"Moda","es":"Moda","en":"Apparel"}'::jsonb),
  ('mango',        'Mango',            'ES',     'consumer-brands', 'apparel-fast-fashion','mango.com',    'company', '{"pt":"Moda","es":"Moda","en":"Apparel"}'::jsonb),
  ('riachuelo',    'Riachuelo',        'BR',     'consumer-brands', 'apparel-fast-fashion','riachuelo.com.br','company','{"pt":"Moda","es":"Moda","en":"Apparel"}'::jsonb),
  ('renner',       'Lojas Renner',     'BR',     'consumer-brands', 'apparel-fast-fashion','lojasrenner.com.br','company','{"pt":"Moda","es":"Moda","en":"Apparel"}'::jsonb),
  -- Sportswear
  ('nike',         'Nike',             'GLOBAL', 'consumer-brands', 'sportswear',          'nike.com',     'company', '{"pt":"Esportivo","es":"Deportivo","en":"Sportswear"}'::jsonb),
  ('adidas',       'Adidas',           'GLOBAL', 'consumer-brands', 'sportswear',          'adidas.com',   'company', '{"pt":"Esportivo","es":"Deportivo","en":"Sportswear"}'::jsonb),
  ('puma',         'Puma',             'GLOBAL', 'consumer-brands', 'sportswear',          'puma.com',     'company', '{"pt":"Esportivo","es":"Deportivo","en":"Sportswear"}'::jsonb),
  ('under-armour', 'Under Armour',     'US',     'consumer-brands', 'sportswear',          'underarmour.com','company','{"pt":"Esportivo","es":"Deportivo","en":"Sportswear"}'::jsonb),
  ('lululemon',    'Lululemon',        'GLOBAL', 'consumer-brands', 'sportswear',          'lululemon.com','company', '{"pt":"Esportivo","es":"Deportivo","en":"Sportswear"}'::jsonb),
  -- Watches/jewelry
  ('rolex',        'Rolex',            'GLOBAL', 'consumer-brands', 'jewelry-watches',     'rolex.com',    'company', '{"pt":"Relógios","es":"Relojes","en":"Watches"}'::jsonb),
  ('cartier',      'Cartier',          'GLOBAL', 'consumer-brands', 'jewelry-watches',     'cartier.com',  'company', '{"pt":"Joias","es":"Joyería","en":"Jewelry"}'::jsonb),
  ('tiffany-co',   'Tiffany & Co.',    'GLOBAL', 'consumer-brands', 'jewelry-watches',     'tiffany.com',  'company', '{"pt":"Joias","es":"Joyería","en":"Jewelry"}'::jsonb);

-- ─── TECHNOLOGY ─────────────────────────────────────────────────────────────

INSERT INTO blog_brands (id, name, country, sector, subsector_id, homepage_domain, entity_type, labels) VALUES
  -- AI Platforms
  ('openai',       'OpenAI',         'GLOBAL', 'technology', 'ai-platforms', 'openai.com',     'company', '{"pt":"IA","es":"IA","en":"AI"}'::jsonb),
  ('anthropic',    'Anthropic',      'GLOBAL', 'technology', 'ai-platforms', 'anthropic.com',  'company', '{"pt":"IA","es":"IA","en":"AI"}'::jsonb),
  ('google-ai',    'Google AI / DeepMind','GLOBAL','technology','ai-platforms','deepmind.google','company','{"pt":"IA","es":"IA","en":"AI"}'::jsonb),
  ('microsoft-ai', 'Microsoft AI',   'GLOBAL', 'technology', 'ai-platforms', 'microsoft.com/ai','company','{"pt":"IA","es":"IA","en":"AI"}'::jsonb),
  ('meta-ai',      'Meta AI',        'GLOBAL', 'technology', 'ai-platforms', 'ai.meta.com',    'company', '{"pt":"IA","es":"IA","en":"AI"}'::jsonb),
  ('xai',          'xAI',            'GLOBAL', 'technology', 'ai-platforms', 'x.ai',           'company', '{"pt":"IA","es":"IA","en":"AI"}'::jsonb),
  ('mistral',      'Mistral AI',     'GLOBAL', 'technology', 'ai-platforms', 'mistral.ai',     'company', '{"pt":"IA","es":"IA","en":"AI"}'::jsonb),
  ('cohere',       'Cohere',         'GLOBAL', 'technology', 'ai-platforms', 'cohere.com',     'company', '{"pt":"IA","es":"IA","en":"AI"}'::jsonb),
  ('perplexity-ai','Perplexity AI',  'GLOBAL', 'technology', 'ai-platforms', 'perplexity.ai',  'company', '{"pt":"IA","es":"IA","en":"AI"}'::jsonb),
  -- Cloud
  ('aws',          'Amazon Web Services','GLOBAL','technology','cloud',     'aws.amazon.com', 'company', '{"pt":"Cloud","es":"Cloud","en":"Cloud"}'::jsonb),
  ('azure',        'Microsoft Azure',    'GLOBAL','technology','cloud',     'azure.microsoft.com','company','{"pt":"Cloud","es":"Cloud","en":"Cloud"}'::jsonb),
  ('google-cloud', 'Google Cloud',       'GLOBAL','technology','cloud',     'cloud.google.com','company','{"pt":"Cloud","es":"Cloud","en":"Cloud"}'::jsonb),
  ('oracle-cloud', 'Oracle Cloud',       'GLOBAL','technology','cloud',     'oracle.com/cloud','company','{"pt":"Cloud","es":"Cloud","en":"Cloud"}'::jsonb),
  ('ibm-cloud',    'IBM Cloud',          'GLOBAL','technology','cloud',     'ibm.com/cloud',  'company', '{"pt":"Cloud","es":"Cloud","en":"Cloud"}'::jsonb),
  -- Cybersecurity
  ('crowdstrike',  'CrowdStrike',    'US',     'technology', 'cybersecurity', 'crowdstrike.com','company','{"pt":"Cibersegurança","es":"Ciberseguridad","en":"Cybersecurity"}'::jsonb),
  ('palo-alto',    'Palo Alto Networks','US',  'technology', 'cybersecurity', 'paloaltonetworks.com','company','{"pt":"Cibersegurança","es":"Ciberseguridad","en":"Cybersecurity"}'::jsonb),
  ('fortinet',     'Fortinet',       'US',     'technology', 'cybersecurity', 'fortinet.com',   'company', '{"pt":"Cibersegurança","es":"Ciberseguridad","en":"Cybersecurity"}'::jsonb),
  ('cloudflare',   'Cloudflare',     'US',     'technology', 'cybersecurity', 'cloudflare.com', 'company', '{"pt":"Cibersegurança","es":"Ciberseguridad","en":"Cybersecurity"}'::jsonb),
  -- SaaS
  ('salesforce',   'Salesforce',     'GLOBAL', 'technology', 'saas',         'salesforce.com', 'company', '{"pt":"SaaS","es":"SaaS","en":"SaaS"}'::jsonb),
  ('servicenow',   'ServiceNow',     'GLOBAL', 'technology', 'saas',         'servicenow.com', 'company', '{"pt":"SaaS","es":"SaaS","en":"SaaS"}'::jsonb),
  ('hubspot',      'HubSpot',        'GLOBAL', 'technology', 'saas',         'hubspot.com',    'company', '{"pt":"SaaS","es":"SaaS","en":"SaaS"}'::jsonb),
  ('zoom',         'Zoom',           'GLOBAL', 'technology', 'saas',         'zoom.us',        'company', '{"pt":"SaaS","es":"SaaS","en":"SaaS"}'::jsonb),
  ('slack',        'Slack',          'GLOBAL', 'technology', 'saas',         'slack.com',      'company', '{"pt":"SaaS","es":"SaaS","en":"SaaS"}'::jsonb),
  ('notion',       'Notion',         'GLOBAL', 'technology', 'saas',         'notion.so',      'company', '{"pt":"SaaS","es":"SaaS","en":"SaaS"}'::jsonb),
  -- Mobile operators
  ('verizon',      'Verizon',        'US',     'technology', 'mobile-operators','verizon.com', 'company', '{"pt":"Telecom","es":"Telecom","en":"Telecom"}'::jsonb),
  ('att',          'AT&T',           'US',     'technology', 'mobile-operators','att.com',     'company', '{"pt":"Telecom","es":"Telecom","en":"Telecom"}'::jsonb),
  ('t-mobile',     'T-Mobile',       'US',     'technology', 'mobile-operators','t-mobile.com','company', '{"pt":"Telecom","es":"Telecom","en":"Telecom"}'::jsonb),
  ('vivo',         'Vivo',           'BR',     'technology', 'mobile-operators','vivo.com.br', 'company', '{"pt":"Telecom","es":"Telecom","en":"Telecom"}'::jsonb),
  ('claro-br',     'Claro Brasil',   'BR',     'technology', 'mobile-operators','claro.com.br','company', '{"pt":"Telecom","es":"Telecom","en":"Telecom"}'::jsonb),
  ('tim-br',       'TIM',            'BR',     'technology', 'mobile-operators','tim.com.br',  'company', '{"pt":"Telecom","es":"Telecom","en":"Telecom"}'::jsonb),
  ('movistar',     'Movistar',       'ES',     'technology', 'mobile-operators','movistar.es', 'company', '{"pt":"Telecom","es":"Telecom","en":"Telecom"}'::jsonb),
  ('vodafone-es',  'Vodafone España','ES',     'technology', 'mobile-operators','vodafone.es', 'company', '{"pt":"Telecom","es":"Telecom","en":"Telecom"}'::jsonb);

-- ─── REAL ESTATE ────────────────────────────────────────────────────────────

INSERT INTO blog_brands (id, name, country, sector, subsector_id, homepage_domain, entity_type, labels) VALUES
  ('zillow',       'Zillow',           'US', 'real-estate', 'property-portals',  'zillow.com',         'company', '{"pt":"Portal","es":"Portal","en":"Portal"}'::jsonb),
  ('realtor-com',  'Realtor.com',      'US', 'real-estate', 'property-portals',  'realtor.com',        'company', '{"pt":"Portal","es":"Portal","en":"Portal"}'::jsonb),
  ('redfin',       'Redfin',           'US', 'real-estate', 'property-portals',  'redfin.com',         'company', '{"pt":"Portal","es":"Portal","en":"Portal"}'::jsonb),
  ('trulia',       'Trulia',           'US', 'real-estate', 'property-portals',  'trulia.com',         'company', '{"pt":"Portal","es":"Portal","en":"Portal"}'::jsonb),
  ('zap-imoveis',  'ZAP Imóveis',      'BR', 'real-estate', 'property-portals',  'zapimoveis.com.br',  'company', '{"pt":"Portal","es":"Portal","en":"Portal"}'::jsonb),
  ('viva-real',    'VivaReal',         'BR', 'real-estate', 'property-portals',  'vivareal.com.br',    'company', '{"pt":"Portal","es":"Portal","en":"Portal"}'::jsonb),
  ('quintoandar',  'QuintoAndar',      'BR', 'real-estate', 'rental-platforms',  'quintoandar.com.br', 'company', '{"pt":"Aluguel","es":"Alquiler","en":"Rental"}'::jsonb),
  ('loft',         'Loft',             'BR', 'real-estate', 'property-portals',  'loft.com.br',        'company', '{"pt":"Portal","es":"Portal","en":"Portal"}'::jsonb),
  ('idealista',    'Idealista',        'ES', 'real-estate', 'property-portals',  'idealista.com',      'company', '{"pt":"Portal","es":"Portal","en":"Portal"}'::jsonb),
  ('fotocasa',     'Fotocasa',         'ES', 'real-estate', 'property-portals',  'fotocasa.es',        'company', '{"pt":"Portal","es":"Portal","en":"Portal"}'::jsonb),
  ('habitaclia',   'Habitaclia',       'ES', 'real-estate', 'property-portals',  'habitaclia.com',     'company', '{"pt":"Portal","es":"Portal","en":"Portal"}'::jsonb),
  ('remax-global', 'RE/MAX',           'GLOBAL','real-estate','brokerages',      'remax.com',          'company', '{"pt":"Imobiliária","es":"Inmobiliaria","en":"Brokerage"}'::jsonb),
  ('coldwell-banker','Coldwell Banker','US', 'real-estate','brokerages',         'coldwellbanker.com', 'company', '{"pt":"Imobiliária","es":"Inmobiliaria","en":"Brokerage"}'::jsonb),
  ('keller-williams','Keller Williams','US', 'real-estate','brokerages',         'kw.com',             'company', '{"pt":"Imobiliária","es":"Inmobiliaria","en":"Brokerage"}'::jsonb),
  ('wework',       'WeWork',           'GLOBAL','real-estate','coworking',       'wework.com',         'company', '{"pt":"Coworking","es":"Coworking","en":"Coworking"}'::jsonb),
  ('industrious',  'Industrious',      'US',  'real-estate', 'coworking',        'industriousoffice.com','company','{"pt":"Coworking","es":"Coworking","en":"Coworking"}'::jsonb);

-- ─── AUTOMOTIVE & MOBILITY ─────────────────────────────────────────────────

INSERT INTO blog_brands (id, name, country, sector, subsector_id, homepage_domain, entity_type, labels) VALUES
  -- Automakers (global)
  ('toyota',       'Toyota',         'GLOBAL', 'automotive-mobility', 'automakers', 'toyota.com',     'company', '{"pt":"Montadora","es":"Fabricante","en":"Automaker"}'::jsonb),
  ('volkswagen',   'Volkswagen',     'GLOBAL', 'automotive-mobility', 'automakers', 'volkswagen.com', 'company', '{"pt":"Montadora","es":"Fabricante","en":"Automaker"}'::jsonb),
  ('hyundai',      'Hyundai',        'GLOBAL', 'automotive-mobility', 'automakers', 'hyundai.com',    'company', '{"pt":"Montadora","es":"Fabricante","en":"Automaker"}'::jsonb),
  ('honda',        'Honda',          'GLOBAL', 'automotive-mobility', 'automakers', 'honda.com',      'company', '{"pt":"Montadora","es":"Fabricante","en":"Automaker"}'::jsonb),
  ('ford',         'Ford',           'US',     'automotive-mobility', 'automakers', 'ford.com',       'company', '{"pt":"Montadora","es":"Fabricante","en":"Automaker"}'::jsonb),
  ('gm',           'General Motors', 'US',     'automotive-mobility', 'automakers', 'gm.com',         'company', '{"pt":"Montadora","es":"Fabricante","en":"Automaker"}'::jsonb),
  ('mercedes-benz','Mercedes-Benz',  'GLOBAL', 'automotive-mobility', 'automakers', 'mercedes-benz.com','company','{"pt":"Montadora","es":"Fabricante","en":"Automaker"}'::jsonb),
  ('bmw',          'BMW',            'GLOBAL', 'automotive-mobility', 'automakers', 'bmw.com',        'company', '{"pt":"Montadora","es":"Fabricante","en":"Automaker"}'::jsonb),
  ('seat',         'SEAT',           'ES',     'automotive-mobility', 'automakers', 'seat.com',       'company', '{"pt":"Montadora","es":"Fabricante","en":"Automaker"}'::jsonb),
  ('stellantis',   'Stellantis',     'GLOBAL', 'automotive-mobility', 'automakers', 'stellantis.com', 'company', '{"pt":"Montadora","es":"Fabricante","en":"Automaker"}'::jsonb),
  -- EVs
  ('tesla',        'Tesla',          'GLOBAL', 'automotive-mobility', 'ev-brands', 'tesla.com',       'company', '{"pt":"Veículos Elétricos","es":"Vehículos Eléctricos","en":"EV Brand"}'::jsonb),
  ('byd',          'BYD',            'GLOBAL', 'automotive-mobility', 'ev-brands', 'bydglobal.com',   'company', '{"pt":"Veículos Elétricos","es":"Vehículos Eléctricos","en":"EV Brand"}'::jsonb),
  ('rivian',       'Rivian',         'US',     'automotive-mobility', 'ev-brands', 'rivian.com',      'company', '{"pt":"Veículos Elétricos","es":"Vehículos Eléctricos","en":"EV Brand"}'::jsonb),
  ('lucid',        'Lucid Motors',   'US',     'automotive-mobility', 'ev-brands', 'lucidmotors.com', 'company', '{"pt":"Veículos Elétricos","es":"Vehículos Eléctricos","en":"EV Brand"}'::jsonb),
  ('polestar',     'Polestar',       'GLOBAL', 'automotive-mobility', 'ev-brands', 'polestar.com',    'company', '{"pt":"Veículos Elétricos","es":"Vehículos Eléctricos","en":"EV Brand"}'::jsonb),
  -- Ride-hailing
  ('uber',         'Uber',           'GLOBAL', 'automotive-mobility', 'ride-hailing','uber.com',      'company', '{"pt":"Ride-hailing","es":"Ride-hailing","en":"Ride-hailing"}'::jsonb),
  ('lyft',         'Lyft',           'US',     'automotive-mobility', 'ride-hailing','lyft.com',      'company', '{"pt":"Ride-hailing","es":"Ride-hailing","en":"Ride-hailing"}'::jsonb),
  ('99-app',       '99 (Didi)',      'BR',     'automotive-mobility', 'ride-hailing','99app.com',     'company', '{"pt":"Ride-hailing","es":"Ride-hailing","en":"Ride-hailing"}'::jsonb),
  ('cabify',       'Cabify',         'ES',     'automotive-mobility', 'ride-hailing','cabify.com',    'company', '{"pt":"Ride-hailing","es":"Ride-hailing","en":"Ride-hailing"}'::jsonb),
  ('bolt',         'Bolt',           'GLOBAL', 'automotive-mobility', 'ride-hailing','bolt.eu',       'company', '{"pt":"Ride-hailing","es":"Ride-hailing","en":"Ride-hailing"}'::jsonb),
  ('free-now',     'FreeNow',        'ES',     'automotive-mobility', 'ride-hailing','free-now.com',  'company', '{"pt":"Ride-hailing","es":"Ride-hailing","en":"Ride-hailing"}'::jsonb),
  -- Rentals
  ('enterprise',   'Enterprise',     'US',     'automotive-mobility', 'car-rental-leasing','enterprise.com','company','{"pt":"Aluguel de Carros","es":"Alquiler de Coches","en":"Car Rental"}'::jsonb),
  ('hertz',        'Hertz',          'US',     'automotive-mobility', 'car-rental-leasing','hertz.com', 'company','{"pt":"Aluguel de Carros","es":"Alquiler de Coches","en":"Car Rental"}'::jsonb),
  ('avis',         'Avis',           'US',     'automotive-mobility', 'car-rental-leasing','avis.com',  'company','{"pt":"Aluguel de Carros","es":"Alquiler de Coches","en":"Car Rental"}'::jsonb),
  ('localiza',     'Localiza',       'BR',     'automotive-mobility', 'car-rental-leasing','localiza.com','company','{"pt":"Aluguel de Carros","es":"Alquiler de Coches","en":"Car Rental"}'::jsonb),
  ('movida',       'Movida',         'BR',     'automotive-mobility', 'car-rental-leasing','movida.com.br','company','{"pt":"Aluguel de Carros","es":"Alquiler de Coches","en":"Car Rental"}'::jsonb),
  ('europcar',     'Europcar',       'GLOBAL', 'automotive-mobility', 'car-rental-leasing','europcar.com','company','{"pt":"Aluguel de Carros","es":"Alquiler de Coches","en":"Car Rental"}'::jsonb),
  ('sixt',         'Sixt',           'GLOBAL', 'automotive-mobility', 'car-rental-leasing','sixt.com',  'company','{"pt":"Aluguel de Carros","es":"Alquiler de Coches","en":"Car Rental"}'::jsonb),
  -- Charging
  ('chargepoint',  'ChargePoint',    'US',     'automotive-mobility', 'charging-networks','chargepoint.com','company','{"pt":"Recarga","es":"Carga","en":"Charging"}'::jsonb),
  ('tesla-supercharger','Tesla Supercharger','GLOBAL','automotive-mobility','charging-networks','tesla.com/supercharger','company','{"pt":"Recarga","es":"Carga","en":"Charging"}'::jsonb),
  ('evgo',         'EVgo',           'US',     'automotive-mobility', 'charging-networks','evgo.com',  'company','{"pt":"Recarga","es":"Carga","en":"Charging"}'::jsonb),
  ('electrify-america','Electrify America','US','automotive-mobility','charging-networks','electrifyamerica.com','company','{"pt":"Recarga","es":"Carga","en":"Charging"}'::jsonb);

-- ─── FOOD, GROCERY & RESTAURANTS ───────────────────────────────────────────

INSERT INTO blog_brands (id, name, country, sector, subsector_id, homepage_domain, entity_type, labels) VALUES
  -- Fast Food
  ('mcdonalds',    'McDonald''s',   'GLOBAL', 'food-restaurants', 'fast-food',     'mcdonalds.com',  'company', '{"pt":"Fast Food","es":"Fast Food","en":"Fast Food"}'::jsonb),
  ('burger-king',  'Burger King',   'GLOBAL', 'food-restaurants', 'fast-food',     'burgerking.com', 'company', '{"pt":"Fast Food","es":"Fast Food","en":"Fast Food"}'::jsonb),
  ('kfc',          'KFC',           'GLOBAL', 'food-restaurants', 'fast-food',     'kfc.com',        'company', '{"pt":"Fast Food","es":"Fast Food","en":"Fast Food"}'::jsonb),
  ('subway',       'Subway',        'GLOBAL', 'food-restaurants', 'fast-food',     'subway.com',     'company', '{"pt":"Fast Food","es":"Fast Food","en":"Fast Food"}'::jsonb),
  ('dominos',      'Domino''s Pizza','GLOBAL','food-restaurants', 'fast-food',     'dominos.com',    'company', '{"pt":"Fast Food","es":"Fast Food","en":"Fast Food"}'::jsonb),
  ('chipotle',     'Chipotle',      'US',     'food-restaurants', 'fast-food',     'chipotle.com',   'company', '{"pt":"Fast Food","es":"Fast Food","en":"Fast Food"}'::jsonb),
  ('habibs',       'Habib''s',      'BR',     'food-restaurants', 'fast-food',     'habibs.com.br',  'company', '{"pt":"Fast Food","es":"Fast Food","en":"Fast Food"}'::jsonb),
  ('giraffas',     'Giraffas',      'BR',     'food-restaurants', 'fast-food',     'giraffas.com.br','company', '{"pt":"Fast Food","es":"Fast Food","en":"Fast Food"}'::jsonb),
  -- Coffee
  ('starbucks',    'Starbucks',     'GLOBAL', 'food-restaurants', 'coffee-chains', 'starbucks.com',  'company', '{"pt":"Cafeteria","es":"Cafetería","en":"Coffee"}'::jsonb),
  ('dunkin',       'Dunkin''',      'US',     'food-restaurants', 'coffee-chains', 'dunkindonuts.com','company','{"pt":"Cafeteria","es":"Cafetería","en":"Coffee"}'::jsonb),
  ('costa-coffee', 'Costa Coffee',  'GLOBAL', 'food-restaurants', 'coffee-chains', 'costa.co.uk',    'company', '{"pt":"Cafeteria","es":"Cafetería","en":"Coffee"}'::jsonb),
  ('tims',         'Tim Hortons',   'GLOBAL', 'food-restaurants', 'coffee-chains', 'timhortons.com', 'company', '{"pt":"Cafeteria","es":"Cafetería","en":"Coffee"}'::jsonb),
  -- Grocery US
  ('walmart-grocery','Walmart Grocery','US',  'food-restaurants', 'grocery-chains','walmart.com/grocery','company','{"pt":"Mercado","es":"Supermercado","en":"Grocery"}'::jsonb),
  ('kroger',       'Kroger',        'US',     'food-restaurants', 'grocery-chains','kroger.com',     'company', '{"pt":"Mercado","es":"Supermercado","en":"Grocery"}'::jsonb),
  ('costco',       'Costco',        'US',     'food-restaurants', 'grocery-chains','costco.com',     'company', '{"pt":"Mercado","es":"Supermercado","en":"Grocery"}'::jsonb),
  ('whole-foods',  'Whole Foods Market','US', 'food-restaurants', 'grocery-chains','wholefoodsmarket.com','company','{"pt":"Mercado","es":"Supermercado","en":"Grocery"}'::jsonb),
  ('aldi',         'Aldi',          'GLOBAL', 'food-restaurants', 'grocery-chains','aldi.us',        'company', '{"pt":"Mercado","es":"Supermercado","en":"Grocery"}'::jsonb),
  ('publix',       'Publix',        'US',     'food-restaurants', 'grocery-chains','publix.com',     'company', '{"pt":"Mercado","es":"Supermercado","en":"Grocery"}'::jsonb),
  -- Grocery BR
  ('carrefour-br', 'Carrefour Brasil','BR',   'food-restaurants', 'grocery-chains','carrefour.com.br','company','{"pt":"Mercado","es":"Supermercado","en":"Grocery"}'::jsonb),
  ('pao-de-acucar','Pão de Açúcar', 'BR',     'food-restaurants', 'grocery-chains','paodeacucar.com','company', '{"pt":"Mercado","es":"Supermercado","en":"Grocery"}'::jsonb),
  ('atacadao',     'Atacadão',      'BR',     'food-restaurants', 'grocery-chains','atacadao.com.br','company', '{"pt":"Mercado","es":"Supermercado","en":"Grocery"}'::jsonb),
  ('assai',        'Assaí Atacadista','BR',   'food-restaurants', 'grocery-chains','assai.com.br',   'company', '{"pt":"Mercado","es":"Supermercado","en":"Grocery"}'::jsonb),
  -- Grocery ES
  ('mercadona',    'Mercadona',     'ES',     'food-restaurants', 'grocery-chains','mercadona.es',   'company', '{"pt":"Mercado","es":"Supermercado","en":"Grocery"}'::jsonb),
  ('carrefour-es', 'Carrefour España','ES',   'food-restaurants', 'grocery-chains','carrefour.es',   'company', '{"pt":"Mercado","es":"Supermercado","en":"Grocery"}'::jsonb),
  ('lidl-es',      'Lidl España',   'ES',     'food-restaurants', 'grocery-chains','lidl.es',        'company', '{"pt":"Mercado","es":"Supermercado","en":"Grocery"}'::jsonb),
  ('dia-es',       'DIA',           'ES',     'food-restaurants', 'grocery-chains','dia.es',         'company', '{"pt":"Mercado","es":"Supermercado","en":"Grocery"}'::jsonb),
  -- Quick commerce
  ('instacart',    'Instacart',     'US',     'food-restaurants', 'quick-commerce','instacart.com',  'company', '{"pt":"Quick Commerce","es":"Quick Commerce","en":"Quick Commerce"}'::jsonb),
  ('gopuff',       'Gopuff',        'US',     'food-restaurants', 'quick-commerce','gopuff.com',     'company', '{"pt":"Quick Commerce","es":"Quick Commerce","en":"Quick Commerce"}'::jsonb),
  ('ifood',        'iFood',         'BR',     'food-restaurants', 'quick-commerce','ifood.com.br',   'company', '{"pt":"Quick Commerce","es":"Quick Commerce","en":"Quick Commerce"}'::jsonb),
  ('rappi-br',     'Rappi Brasil',  'BR',     'food-restaurants', 'quick-commerce','rappi.com.br',   'company', '{"pt":"Quick Commerce","es":"Quick Commerce","en":"Quick Commerce"}'::jsonb),
  ('daki',         'Daki',          'BR',     'food-restaurants', 'quick-commerce','daki.com.br',    'company', '{"pt":"Quick Commerce","es":"Quick Commerce","en":"Quick Commerce"}'::jsonb),
  ('glovo',        'Glovo',         'ES',     'food-restaurants', 'quick-commerce','glovoapp.com',   'company', '{"pt":"Quick Commerce","es":"Quick Commerce","en":"Quick Commerce"}'::jsonb),
  ('getir-es',     'Getir España',  'ES',     'food-restaurants', 'quick-commerce','getir.com',      'company', '{"pt":"Quick Commerce","es":"Quick Commerce","en":"Quick Commerce"}'::jsonb);

-- ─── RANKING SNAPSHOTS + ITEMS ──────────────────────────────────────────────

DO $$
DECLARE
  s_id BIGINT;
BEGIN
  -- Financial Services / BR
  INSERT INTO blog_ranking_snapshots (period_label, period_from, period_to, region, sector, queries_analyzed, sectors_covered, engines_monitored)
  VALUES ('weekly','2026-04-20','2026-04-27','br','financial-services',4200000,127,'["chatgpt","gemini","claude","perplexity","grok"]'::jsonb)
  RETURNING id INTO s_id;
  INSERT INTO blog_ranking_items (snapshot_id, rank, brand_id, score, delta, direction) VALUES
    (s_id, 1, 'nubank',       94, '+6',  'up'),
    (s_id, 2, 'itau',         87, '-2',  'down'),
    (s_id, 3, 'inter',        82, '+11', 'up'),
    (s_id, 4, 'bradesco',     76, '0',   'flat'),
    (s_id, 5, 'c6-bank',      71, '+4',  'up'),
    (s_id, 6, 'santander-br', 68, '-3',  'down'),
    (s_id, 7, 'picpay',       64, '+2',  'up'),
    (s_id, 8, 'btg-pactual',  59, '+1',  'up'),
    (s_id, 9, 'banco-do-brasil',56,'+1', 'up'),
    (s_id,10, 'mercado-pago', 52, '+5',  'up');

  -- Financial Services / ES
  INSERT INTO blog_ranking_snapshots (period_label, period_from, period_to, region, sector, queries_analyzed, sectors_covered, engines_monitored)
  VALUES ('weekly','2026-04-20','2026-04-27','es','financial-services',4200000,127,'["chatgpt","gemini","claude","perplexity","grok"]'::jsonb)
  RETURNING id INTO s_id;
  INSERT INTO blog_ranking_items (snapshot_id, rank, brand_id, score, delta, direction) VALUES
    (s_id, 1, 'bbva',         91, '+4', 'up'),
    (s_id, 2, 'santander-es', 88, '+2', 'up'),
    (s_id, 3, 'caixabank',    83, '-1', 'down'),
    (s_id, 4, 'openbank',     77, '+9', 'up'),
    (s_id, 5, 'revolut-es',   73, '+3', 'up'),
    (s_id, 6, 'bankinter',    68, '0',  'flat'),
    (s_id, 7, 'sabadell',     62, '-2', 'down'),
    (s_id, 8, 'ing-es',       57, '+1', 'up'),
    (s_id, 9, 'mapfre',       54, '+2', 'up'),
    (s_id,10, 'bizum',        50, '+6', 'up');

  -- Financial Services / US
  INSERT INTO blog_ranking_snapshots (period_label, period_from, period_to, region, sector, queries_analyzed, sectors_covered, engines_monitored)
  VALUES ('weekly','2026-04-20','2026-04-27','us','financial-services',4200000,127,'["chatgpt","gemini","claude","perplexity","grok"]'::jsonb)
  RETURNING id INTO s_id;
  INSERT INTO blog_ranking_items (snapshot_id, rank, brand_id, score, delta, direction) VALUES
    (s_id, 1, 'jpmorgan-chase', 96, '+3', 'up'),
    (s_id, 2, 'bank-of-america',91,'-1', 'down'),
    (s_id, 3, 'wells-fargo',    84,'0',  'flat'),
    (s_id, 4, 'citi',           79,'-2', 'down'),
    (s_id, 5, 'goldman-sachs',  76,'+2', 'up'),
    (s_id, 6, 'paypal',         73,'+5', 'up'),
    (s_id, 7, 'fidelity',       71,'+1', 'up'),
    (s_id, 8, 'morgan-stanley', 68,'0',  'flat'),
    (s_id, 9, 'chime',          65,'+8', 'up'),
    (s_id,10, 'capital-one',    63,'-1', 'down');

  -- Healthcare / US
  INSERT INTO blog_ranking_snapshots (period_label, period_from, period_to, region, sector, queries_analyzed, sectors_covered, engines_monitored)
  VALUES ('weekly','2026-04-20','2026-04-27','us','healthcare',4200000,127,'["chatgpt","gemini","claude","perplexity","grok"]'::jsonb)
  RETURNING id INTO s_id;
  INSERT INTO blog_ranking_items (snapshot_id, rank, brand_id, score, delta, direction) VALUES
    (s_id, 1, 'mayo-clinic',     94, '+2', 'up'),
    (s_id, 2, 'cleveland-clinic',89, '+1', 'up'),
    (s_id, 3, 'johns-hopkins',   86, '0',  'flat'),
    (s_id, 4, 'mass-general',    82, '-1', 'down'),
    (s_id, 5, 'kaiser-permanente',78,'+4', 'up'),
    (s_id, 6, 'unitedhealth',    74, '0',  'flat'),
    (s_id, 7, 'teladoc',         70, '+6', 'up'),
    (s_id, 8, 'pfizer',          67, '-2', 'down');

  -- Healthcare / BR
  INSERT INTO blog_ranking_snapshots (period_label, period_from, period_to, region, sector, queries_analyzed, sectors_covered, engines_monitored)
  VALUES ('weekly','2026-04-20','2026-04-27','br','healthcare',4200000,127,'["chatgpt","gemini","claude","perplexity","grok"]'::jsonb)
  RETURNING id INTO s_id;
  INSERT INTO blog_ranking_items (snapshot_id, rank, brand_id, score, delta, direction) VALUES
    (s_id, 1, 'hsl-einstein',     92, '+3', 'up'),
    (s_id, 2, 'hsl-sirio-libanes',88, '+1', 'up'),
    (s_id, 3, 'hapvida',          78, '+5', 'up'),
    (s_id, 4, 'fleury',           74, '0',  'flat'),
    (s_id, 5, 'amil',              71, '-1', 'down'),
    (s_id, 6, 'bradesco-saude',    68, '+1', 'up'),
    (s_id, 7, 'dasa',              63, '-2', 'down'),
    (s_id, 8, 'conexa-saude',      57, '+9', 'up');

  -- Healthcare / ES
  INSERT INTO blog_ranking_snapshots (period_label, period_from, period_to, region, sector, queries_analyzed, sectors_covered, engines_monitored)
  VALUES ('weekly','2026-04-20','2026-04-27','es','healthcare',4200000,127,'["chatgpt","gemini","claude","perplexity","grok"]'::jsonb)
  RETURNING id INTO s_id;
  INSERT INTO blog_ranking_items (snapshot_id, rank, brand_id, score, delta, direction) VALUES
    (s_id, 1, 'quironsalud',      88, '+2', 'up'),
    (s_id, 2, 'sanitas',          85, '+1', 'up'),
    (s_id, 3, 'hosp-la-paz',      80, '0',  'flat'),
    (s_id, 4, 'hosp-clinic-bcn',  77, '+1', 'up'),
    (s_id, 5, 'adeslas',          72, '-1', 'down'),
    (s_id, 6, 'dkv-seguros',      66, '+2', 'up');

  -- Education / GLOBAL
  INSERT INTO blog_ranking_snapshots (period_label, period_from, period_to, region, sector, queries_analyzed, sectors_covered, engines_monitored)
  VALUES ('weekly','2026-04-20','2026-04-27','global','education',4200000,127,'["chatgpt","gemini","claude","perplexity","grok"]'::jsonb)
  RETURNING id INTO s_id;
  INSERT INTO blog_ranking_items (snapshot_id, rank, brand_id, score, delta, direction) VALUES
    (s_id, 1, 'harvard',         98, '0',  'flat'),
    (s_id, 2, 'mit',             96, '+1', 'up'),
    (s_id, 3, 'stanford',        94, '0',  'flat'),
    (s_id, 4, 'oxford',          92, '0',  'flat'),
    (s_id, 5, 'cambridge',       91, '0',  'flat'),
    (s_id, 6, 'hbs',             86, '+1', 'up'),
    (s_id, 7, 'wharton',         84, '-1', 'down'),
    (s_id, 8, 'insead',          81, '+1', 'up'),
    (s_id, 9, 'coursera',        76, '+5', 'up'),
    (s_id,10, 'khan-academy',    72, '+2', 'up');

  -- Education / BR
  INSERT INTO blog_ranking_snapshots (period_label, period_from, period_to, region, sector, queries_analyzed, sectors_covered, engines_monitored)
  VALUES ('weekly','2026-04-20','2026-04-27','br','education',4200000,127,'["chatgpt","gemini","claude","perplexity","grok"]'::jsonb)
  RETURNING id INTO s_id;
  INSERT INTO blog_ranking_items (snapshot_id, rank, brand_id, score, delta, direction) VALUES
    (s_id, 1, 'usp',             93, '0',  'flat'),
    (s_id, 2, 'unicamp',         87, '+1', 'up'),
    (s_id, 3, 'ufrj',            83, '-1', 'down'),
    (s_id, 4, 'fgv',             79, '+2', 'up'),
    (s_id, 5, 'insper',          73, '+1', 'up'),
    (s_id, 6, 'alura',           69, '+8', 'up'),
    (s_id, 7, 'hotmart',         62, '+3', 'up'),
    (s_id, 8, 'coursera',        58, '+1', 'up');

  -- Retail / BR
  INSERT INTO blog_ranking_snapshots (period_label, period_from, period_to, region, sector, queries_analyzed, sectors_covered, engines_monitored)
  VALUES ('weekly','2026-04-20','2026-04-27','br','retail-ecommerce',4200000,127,'["chatgpt","gemini","claude","perplexity","grok"]'::jsonb)
  RETURNING id INTO s_id;
  INSERT INTO blog_ranking_items (snapshot_id, rank, brand_id, score, delta, direction) VALUES
    (s_id, 1, 'mercado-livre',   95, '+2', 'up'),
    (s_id, 2, 'magalu',          88, '+1', 'up'),
    (s_id, 3, 'shopee-br',       83, '+9', 'up'),
    (s_id, 4, 'amazon',          80, '0',  'flat'),
    (s_id, 5, 'americanas',      72, '-3', 'down'),
    (s_id, 6, 'casas-bahia',     68, '-1', 'down'),
    (s_id, 7, 'drogasil',        61, '+2', 'up'),
    (s_id, 8, 'drogaraia',       58, '+1', 'up');

  -- Retail / ES
  INSERT INTO blog_ranking_snapshots (period_label, period_from, period_to, region, sector, queries_analyzed, sectors_covered, engines_monitored)
  VALUES ('weekly','2026-04-20','2026-04-27','es','retail-ecommerce',4200000,127,'["chatgpt","gemini","claude","perplexity","grok"]'::jsonb)
  RETURNING id INTO s_id;
  INSERT INTO blog_ranking_items (snapshot_id, rank, brand_id, score, delta, direction) VALUES
    (s_id, 1, 'amazon',          93, '0',  'flat'),
    (s_id, 2, 'el-corte-ingles', 88, '+1', 'up'),
    (s_id, 3, 'mediamarkt',      78, '0',  'flat'),
    (s_id, 4, 'pccomponentes',   72, '+3', 'up'),
    (s_id, 5, 'ikea',            68, '+1', 'up');

  -- Retail / US
  INSERT INTO blog_ranking_snapshots (period_label, period_from, period_to, region, sector, queries_analyzed, sectors_covered, engines_monitored)
  VALUES ('weekly','2026-04-20','2026-04-27','us','retail-ecommerce',4200000,127,'["chatgpt","gemini","claude","perplexity","grok"]'::jsonb)
  RETURNING id INTO s_id;
  INSERT INTO blog_ranking_items (snapshot_id, rank, brand_id, score, delta, direction) VALUES
    (s_id, 1, 'amazon',          98, '0',  'flat'),
    (s_id, 2, 'walmart',         93, '+1', 'up'),
    (s_id, 3, 'best-buy',        82, '0',  'flat'),
    (s_id, 4, 'wayfair',         76, '+2', 'up'),
    (s_id, 5, 'cvs',             72, '-1', 'down'),
    (s_id, 6, 'walgreens',       68, '0',  'flat'),
    (s_id, 7, 'ebay',            64, '-3', 'down'),
    (s_id, 8, 'ikea',            60, '+1', 'up');

  -- Travel / GLOBAL
  INSERT INTO blog_ranking_snapshots (period_label, period_from, period_to, region, sector, queries_analyzed, sectors_covered, engines_monitored)
  VALUES ('weekly','2026-04-20','2026-04-27','global','travel-hospitality',4200000,127,'["chatgpt","gemini","claude","perplexity","grok"]'::jsonb)
  RETURNING id INTO s_id;
  INSERT INTO blog_ranking_items (snapshot_id, rank, brand_id, score, delta, direction) VALUES
    (s_id, 1, 'booking',         96, '+1', 'up'),
    (s_id, 2, 'airbnb',          93, '0',  'flat'),
    (s_id, 3, 'expedia',         85, '0',  'flat'),
    (s_id, 4, 'marriott',        82, '+1', 'up'),
    (s_id, 5, 'hilton',          79, '0',  'flat'),
    (s_id, 6, 'kayak',           74, '+2', 'up'),
    (s_id, 7, 'trip-com',        70, '+3', 'up'),
    (s_id, 8, 'hyatt',           66, '-1', 'down'),
    (s_id, 9, 'emirates',        63, '+1', 'up'),
    (s_id,10, 'delta',           60, '0',  'flat');

  -- Consumer Brands / GLOBAL
  INSERT INTO blog_ranking_snapshots (period_label, period_from, period_to, region, sector, queries_analyzed, sectors_covered, engines_monitored)
  VALUES ('weekly','2026-04-20','2026-04-27','global','consumer-brands',4200000,127,'["chatgpt","gemini","claude","perplexity","grok"]'::jsonb)
  RETURNING id INTO s_id;
  INSERT INTO blog_ranking_items (snapshot_id, rank, brand_id, score, delta, direction) VALUES
    (s_id, 1, 'nike',            96, '0',  'flat'),
    (s_id, 2, 'adidas',          90, '+1', 'up'),
    (s_id, 3, 'zara',            88, '0',  'flat'),
    (s_id, 4, 'loreal',          85, '+1', 'up'),
    (s_id, 5, 'lvmh',            83, '0',  'flat'),
    (s_id, 6, 'sephora',         79, '+2', 'up'),
    (s_id, 7, 'hm',              76, '-2', 'down'),
    (s_id, 8, 'shein',           74, '+5', 'up'),
    (s_id, 9, 'natura',          69, '+3', 'up'),
    (s_id,10, 'rolex',           67, '0',  'flat');

  -- Technology / GLOBAL
  INSERT INTO blog_ranking_snapshots (period_label, period_from, period_to, region, sector, queries_analyzed, sectors_covered, engines_monitored)
  VALUES ('weekly','2026-04-20','2026-04-27','global','technology',4200000,127,'["chatgpt","gemini","claude","perplexity","grok"]'::jsonb)
  RETURNING id INTO s_id;
  INSERT INTO blog_ranking_items (snapshot_id, rank, brand_id, score, delta, direction) VALUES
    (s_id, 1, 'openai',          98, '+1', 'up'),
    (s_id, 2, 'google-ai',       94, '0',  'flat'),
    (s_id, 3, 'anthropic',       92, '+3', 'up'),
    (s_id, 4, 'microsoft-ai',    91, '0',  'flat'),
    (s_id, 5, 'aws',             88, '0',  'flat'),
    (s_id, 6, 'azure',           86, '+1', 'up'),
    (s_id, 7, 'meta-ai',         83, '-1', 'down'),
    (s_id, 8, 'salesforce',      78, '0',  'flat'),
    (s_id, 9, 'crowdstrike',     74, '+2', 'up'),
    (s_id,10, 'cloudflare',      71, '+1', 'up');

  -- Real Estate / BR
  INSERT INTO blog_ranking_snapshots (period_label, period_from, period_to, region, sector, queries_analyzed, sectors_covered, engines_monitored)
  VALUES ('weekly','2026-04-20','2026-04-27','br','real-estate',4200000,127,'["chatgpt","gemini","claude","perplexity","grok"]'::jsonb)
  RETURNING id INTO s_id;
  INSERT INTO blog_ranking_items (snapshot_id, rank, brand_id, score, delta, direction) VALUES
    (s_id, 1, 'zap-imoveis',  92, '0',  'flat'),
    (s_id, 2, 'viva-real',    87, '+1', 'up'),
    (s_id, 3, 'quintoandar',  83, '+5', 'up'),
    (s_id, 4, 'loft',         76, '+2', 'up');

  -- Real Estate / ES
  INSERT INTO blog_ranking_snapshots (period_label, period_from, period_to, region, sector, queries_analyzed, sectors_covered, engines_monitored)
  VALUES ('weekly','2026-04-20','2026-04-27','es','real-estate',4200000,127,'["chatgpt","gemini","claude","perplexity","grok"]'::jsonb)
  RETURNING id INTO s_id;
  INSERT INTO blog_ranking_items (snapshot_id, rank, brand_id, score, delta, direction) VALUES
    (s_id, 1, 'idealista',    96, '0',  'flat'),
    (s_id, 2, 'fotocasa',     88, '+1', 'up'),
    (s_id, 3, 'habitaclia',   78, '-1', 'down');

  -- Real Estate / US
  INSERT INTO blog_ranking_snapshots (period_label, period_from, period_to, region, sector, queries_analyzed, sectors_covered, engines_monitored)
  VALUES ('weekly','2026-04-20','2026-04-27','us','real-estate',4200000,127,'["chatgpt","gemini","claude","perplexity","grok"]'::jsonb)
  RETURNING id INTO s_id;
  INSERT INTO blog_ranking_items (snapshot_id, rank, brand_id, score, delta, direction) VALUES
    (s_id, 1, 'zillow',         96, '+1', 'up'),
    (s_id, 2, 'realtor-com',    88, '0',  'flat'),
    (s_id, 3, 'redfin',         82, '+1', 'up'),
    (s_id, 4, 'trulia',         74, '-2', 'down'),
    (s_id, 5, 'remax-global',   70, '0',  'flat'),
    (s_id, 6, 'keller-williams',66, '+1', 'up'),
    (s_id, 7, 'wework',         59, '-3', 'down');

  -- Automotive / GLOBAL
  INSERT INTO blog_ranking_snapshots (period_label, period_from, period_to, region, sector, queries_analyzed, sectors_covered, engines_monitored)
  VALUES ('weekly','2026-04-20','2026-04-27','global','automotive-mobility',4200000,127,'["chatgpt","gemini","claude","perplexity","grok"]'::jsonb)
  RETURNING id INTO s_id;
  INSERT INTO blog_ranking_items (snapshot_id, rank, brand_id, score, delta, direction) VALUES
    (s_id, 1, 'tesla',           93, '+2', 'up'),
    (s_id, 2, 'toyota',          91, '+1', 'up'),
    (s_id, 3, 'volkswagen',      87, '0',  'flat'),
    (s_id, 4, 'byd',             85, '+8', 'up'),
    (s_id, 5, 'hyundai',         82, '+1', 'up'),
    (s_id, 6, 'honda',           79, '0',  'flat'),
    (s_id, 7, 'mercedes-benz',   76, '-1', 'down'),
    (s_id, 8, 'bmw',             74, '0',  'flat'),
    (s_id, 9, 'uber',            71, '+1', 'up'),
    (s_id,10, 'ford',            68, '-2', 'down');

  -- Food / BR
  INSERT INTO blog_ranking_snapshots (period_label, period_from, period_to, region, sector, queries_analyzed, sectors_covered, engines_monitored)
  VALUES ('weekly','2026-04-20','2026-04-27','br','food-restaurants',4200000,127,'["chatgpt","gemini","claude","perplexity","grok"]'::jsonb)
  RETURNING id INTO s_id;
  INSERT INTO blog_ranking_items (snapshot_id, rank, brand_id, score, delta, direction) VALUES
    (s_id, 1, 'ifood',          96, '0',  'flat'),
    (s_id, 2, 'mcdonalds',      90, '+1', 'up'),
    (s_id, 3, 'burger-king',    84, '0',  'flat'),
    (s_id, 4, 'rappi-br',       80, '+2', 'up'),
    (s_id, 5, 'starbucks',      75, '+1', 'up'),
    (s_id, 6, 'pao-de-acucar',  72, '0',  'flat'),
    (s_id, 7, 'carrefour-br',   70, '-1', 'down'),
    (s_id, 8, 'habibs',         62, '+1', 'up'),
    (s_id, 9, 'subway',         59, '-2', 'down'),
    (s_id,10, 'daki',           54, '+5', 'up');

  -- Food / ES
  INSERT INTO blog_ranking_snapshots (period_label, period_from, period_to, region, sector, queries_analyzed, sectors_covered, engines_monitored)
  VALUES ('weekly','2026-04-20','2026-04-27','es','food-restaurants',4200000,127,'["chatgpt","gemini","claude","perplexity","grok"]'::jsonb)
  RETURNING id INTO s_id;
  INSERT INTO blog_ranking_items (snapshot_id, rank, brand_id, score, delta, direction) VALUES
    (s_id, 1, 'mercadona',      96, '0',  'flat'),
    (s_id, 2, 'glovo',          90, '+2', 'up'),
    (s_id, 3, 'carrefour-es',   83, '0',  'flat'),
    (s_id, 4, 'lidl-es',        78, '+1', 'up'),
    (s_id, 5, 'mcdonalds',      72, '0',  'flat'),
    (s_id, 6, 'starbucks',      69, '+1', 'up'),
    (s_id, 7, 'burger-king',    65, '0',  'flat'),
    (s_id, 8, 'dia-es',         60, '-2', 'down');

  -- Food / US
  INSERT INTO blog_ranking_snapshots (period_label, period_from, period_to, region, sector, queries_analyzed, sectors_covered, engines_monitored)
  VALUES ('weekly','2026-04-20','2026-04-27','us','food-restaurants',4200000,127,'["chatgpt","gemini","claude","perplexity","grok"]'::jsonb)
  RETURNING id INTO s_id;
  INSERT INTO blog_ranking_items (snapshot_id, rank, brand_id, score, delta, direction) VALUES
    (s_id, 1, 'mcdonalds',         98, '0',  'flat'),
    (s_id, 2, 'starbucks',         94, '+1', 'up'),
    (s_id, 3, 'walmart-grocery',   91, '0',  'flat'),
    (s_id, 4, 'instacart',         88, '+5', 'up'),
    (s_id, 5, 'kroger',            82, '0',  'flat'),
    (s_id, 6, 'costco',            80, '+1', 'up'),
    (s_id, 7, 'whole-foods',       76, '0',  'flat'),
    (s_id, 8, 'chipotle',          73, '+2', 'up'),
    (s_id, 9, 'subway',            68, '-2', 'down'),
    (s_id,10, 'dunkin',            65, '+1', 'up');
END $$;
