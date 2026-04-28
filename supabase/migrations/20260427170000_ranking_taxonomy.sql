-- ============================================================================
-- Index AI — Ranking taxonomy upgrade.
--
-- Aligns the ranking schema with `_api-doc/ranking-research.md`:
--   * 10 canonical sectors with 5 subsectors each (50 subsectors)
--   * Brands gain subsector_id + homepage_domain + entity_type
--   * Rankings continue to be snapshot-per-(region, sector); subsector slicing
--     happens at brand-level inside the API
-- ============================================================================

-- ─── 1. Sectors as a first-class table ─────────────────────────────────────

CREATE TABLE blog_sectors (
  id          TEXT PRIMARY KEY,
  position    INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_blog_sectors_updated BEFORE UPDATE ON blog_sectors
  FOR EACH ROW EXECUTE FUNCTION blog_set_updated_at();
ALTER TABLE blog_sectors ENABLE ROW LEVEL SECURITY;

-- ─── 2. Subsectors ─────────────────────────────────────────────────────────

CREATE TABLE blog_subsectors (
  id          TEXT PRIMARY KEY,
  sector_id   TEXT NOT NULL REFERENCES blog_sectors(id) ON DELETE CASCADE,
  position    INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_blog_subsectors_sector ON blog_subsectors(sector_id, position);
CREATE TRIGGER trg_blog_subsectors_updated BEFORE UPDATE ON blog_subsectors
  FOR EACH ROW EXECUTE FUNCTION blog_set_updated_at();
ALTER TABLE blog_subsectors ENABLE ROW LEVEL SECURITY;

CREATE TABLE blog_subsector_translations (
  subsector_id  TEXT NOT NULL REFERENCES blog_subsectors(id) ON DELETE CASCADE,
  lang          TEXT NOT NULL REFERENCES blog_languages(code),
  label         TEXT NOT NULL,
  description   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (subsector_id, lang)
);
CREATE TRIGGER trg_blog_subsector_translations_updated BEFORE UPDATE ON blog_subsector_translations
  FOR EACH ROW EXECUTE FUNCTION blog_set_updated_at();
ALTER TABLE blog_subsector_translations ENABLE ROW LEVEL SECURITY;

-- ─── 3. Recreate blog_sector_translations with FK + description ─────────────

DROP TABLE blog_sector_translations;
CREATE TABLE blog_sector_translations (
  sector_id    TEXT NOT NULL REFERENCES blog_sectors(id) ON DELETE CASCADE,
  lang         TEXT NOT NULL REFERENCES blog_languages(code),
  label        TEXT NOT NULL,
  description  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (sector_id, lang)
);
CREATE TRIGGER trg_blog_sector_translations_updated BEFORE UPDATE ON blog_sector_translations
  FOR EACH ROW EXECUTE FUNCTION blog_set_updated_at();
ALTER TABLE blog_sector_translations ENABLE ROW LEVEL SECURITY;

-- ─── 4. Extend blog_brands ──────────────────────────────────────────────────

-- Wipe the existing seed brands (only 22 demo rows) before adding constraints
DELETE FROM blog_ranking_items;
DELETE FROM blog_ranking_snapshots;
DELETE FROM blog_brands;

ALTER TABLE blog_brands
  ADD COLUMN subsector_id    TEXT REFERENCES blog_subsectors(id) ON DELETE SET NULL,
  ADD COLUMN homepage_domain TEXT,
  ADD COLUMN entity_type     TEXT NOT NULL DEFAULT 'company';

-- The existing `sector` TEXT column on blog_brands stays the same shape; we
-- now add a soft constraint that it must reference a real sector id. Soft
-- because legacy rows could exist in dev forks.
CREATE INDEX idx_blog_brands_sector ON blog_brands(sector);
CREATE INDEX idx_blog_brands_subsector ON blog_brands(subsector_id);

-- ─── 5. Seed sectors ────────────────────────────────────────────────────────

INSERT INTO blog_sectors (id, position) VALUES
  ('financial-services',  1),
  ('healthcare',          2),
  ('education',           3),
  ('retail-ecommerce',    4),
  ('travel-hospitality',  5),
  ('consumer-brands',     6),
  ('technology',          7),
  ('real-estate',         8),
  ('automotive-mobility', 9),
  ('food-restaurants',   10);

INSERT INTO blog_sector_translations (sector_id, lang, label, description) VALUES
  ('financial-services',  'pt', 'Serviços Financeiros',  'Bancos, fintechs, seguradoras, pagamentos e investimentos.'),
  ('financial-services',  'es', 'Servicios Financieros', 'Bancos, fintechs, seguros, pagos e inversiones.'),
  ('financial-services',  'en', 'Financial Services',    'Banks, fintechs, insurance, payments and investing.'),

  ('healthcare',          'pt', 'Saúde',                 'Hospitais, planos de saúde, telemedicina, farmacêuticas e diagnósticos.'),
  ('healthcare',          'es', 'Salud',                 'Hospitales, planes de salud, telemedicina, farma y diagnósticos.'),
  ('healthcare',          'en', 'Healthcare',            'Hospitals, health plans, telehealth, pharma and diagnostics.'),

  ('education',           'pt', 'Educação',              'Universidades, escolas de negócios, ensino online, K-12 e bootcamps.'),
  ('education',           'es', 'Educación',             'Universidades, escuelas de negocios, e-learning, K-12 y bootcamps.'),
  ('education',           'en', 'Education',             'Universities, business schools, online learning, K-12 and bootcamps.'),

  ('retail-ecommerce',    'pt', 'Varejo e E-commerce',   'Marketplaces, mercearia online, eletrônicos, casa e farmácia.'),
  ('retail-ecommerce',    'es', 'Retail y E-commerce',   'Marketplaces, supermercado online, electrónica, hogar y farmacia.'),
  ('retail-ecommerce',    'en', 'Retail and E-commerce', 'Marketplaces, grocery, electronics, home goods and pharmacy.'),

  ('travel-hospitality',  'pt', 'Viagens e Hospitalidade','Hotéis, companhias aéreas, OTAs, aluguel de temporada e tours.'),
  ('travel-hospitality',  'es', 'Viajes y Hospitalidad', 'Hoteles, aerolíneas, OTAs, alquiler vacacional y tours.'),
  ('travel-hospitality',  'en', 'Travel and Hospitality','Hotels, airlines, OTAs, vacation rentals and tours.'),

  ('consumer-brands',     'pt', 'Marcas de Consumo',     'Beleza, luxo, moda, esportes e joalheria.'),
  ('consumer-brands',     'es', 'Marcas de Consumo',     'Belleza, lujo, moda, deporte y joyería.'),
  ('consumer-brands',     'en', 'Consumer Brands',       'Beauty, luxury, apparel, sportswear and jewelry.'),

  ('technology',          'pt', 'Tecnologia',            'Plataformas de IA, cloud, cibersegurança, SaaS e telecom.'),
  ('technology',          'es', 'Tecnología',            'Plataformas de IA, cloud, ciberseguridad, SaaS y telecomunicaciones.'),
  ('technology',          'en', 'Technology',            'AI platforms, cloud, cybersecurity, SaaS and telecom.'),

  ('real-estate',         'pt', 'Imobiliário',           'Construtoras, portais, imobiliárias, coworking e plataformas de aluguel.'),
  ('real-estate',         'es', 'Inmobiliario',          'Promotoras, portales, agencias, coworking y plataformas de alquiler.'),
  ('real-estate',         'en', 'Real Estate and Housing','Developers, portals, brokerages, coworking and rental platforms.'),

  ('automotive-mobility', 'pt', 'Automotivo e Mobilidade','Montadoras, EVs, ride-hailing, aluguel/leasing e estações de recarga.'),
  ('automotive-mobility', 'es', 'Automoción y Movilidad','Fabricantes, EVs, ride-hailing, alquiler/leasing y carga.'),
  ('automotive-mobility', 'en', 'Automotive and Mobility','Automakers, EVs, ride-hailing, rentals/leasing and charging.'),

  ('food-restaurants',    'pt', 'Alimentação e Restaurantes','Mercearias, quick commerce, fast food, cafeterias e dining casual.'),
  ('food-restaurants',    'es', 'Alimentación y Restaurantes','Supermercados, quick commerce, fast food, cafeterías y dining casual.'),
  ('food-restaurants',    'en', 'Food, Grocery and Restaurants','Grocery chains, quick commerce, fast food, coffee chains and casual dining.');

-- ─── 6. Seed subsectors (50 total) ─────────────────────────────────────────

INSERT INTO blog_subsectors (id, sector_id, position) VALUES
  -- Financial Services
  ('banks',              'financial-services', 1),
  ('fintech-neobanks',   'financial-services', 2),
  ('insurance',          'financial-services', 3),
  ('payments-wallets',   'financial-services', 4),
  ('wealth-investing',   'financial-services', 5),
  -- Healthcare
  ('hospitals',          'healthcare', 1),
  ('health-plans',       'healthcare', 2),
  ('telehealth',         'healthcare', 3),
  ('pharma-brands',      'healthcare', 4),
  ('labs-diagnostics',   'healthcare', 5),
  -- Education
  ('universities',       'education', 1),
  ('business-schools',   'education', 2),
  ('online-learning',    'education', 3),
  ('k12-schools',        'education', 4),
  ('bootcamps',          'education', 5),
  -- Retail and E-commerce
  ('marketplaces',       'retail-ecommerce', 1),
  ('grocery-ecommerce',  'retail-ecommerce', 2),
  ('electronics-retail', 'retail-ecommerce', 3),
  ('home-goods',         'retail-ecommerce', 4),
  ('pharmacy-retail',    'retail-ecommerce', 5),
  -- Travel and Hospitality
  ('hotels-resorts',     'travel-hospitality', 1),
  ('airlines',           'travel-hospitality', 2),
  ('otas-metasearch',    'travel-hospitality', 3),
  ('vacation-rentals',   'travel-hospitality', 4),
  ('tours-experiences',  'travel-hospitality', 5),
  -- Consumer Brands
  ('beauty-cosmetics',   'consumer-brands', 1),
  ('luxury-fashion',     'consumer-brands', 2),
  ('apparel-fast-fashion','consumer-brands', 3),
  ('sportswear',         'consumer-brands', 4),
  ('jewelry-watches',    'consumer-brands', 5),
  -- Technology
  ('ai-platforms',       'technology', 1),
  ('cloud',              'technology', 2),
  ('cybersecurity',      'technology', 3),
  ('saas',               'technology', 4),
  ('mobile-operators',   'technology', 5),
  -- Real Estate
  ('residential-developers', 'real-estate', 1),
  ('property-portals',       'real-estate', 2),
  ('brokerages',             'real-estate', 3),
  ('coworking',              'real-estate', 4),
  ('rental-platforms',       'real-estate', 5),
  -- Automotive
  ('automakers',         'automotive-mobility', 1),
  ('ev-brands',          'automotive-mobility', 2),
  ('ride-hailing',       'automotive-mobility', 3),
  ('car-rental-leasing', 'automotive-mobility', 4),
  ('charging-networks',  'automotive-mobility', 5),
  -- Food
  ('grocery-chains',     'food-restaurants', 1),
  ('quick-commerce',     'food-restaurants', 2),
  ('fast-food',          'food-restaurants', 3),
  ('coffee-chains',      'food-restaurants', 4),
  ('casual-dining',      'food-restaurants', 5);

-- Subsector translations — provide PT/ES/EN labels
INSERT INTO blog_subsector_translations (subsector_id, lang, label) VALUES
  -- Financial Services
  ('banks','pt','Bancos'),                    ('banks','es','Bancos'),                    ('banks','en','Banks'),
  ('fintech-neobanks','pt','Fintech / Neobancos'), ('fintech-neobanks','es','Fintech / Neobancos'), ('fintech-neobanks','en','Fintech / Neobanks'),
  ('insurance','pt','Seguros'),               ('insurance','es','Seguros'),               ('insurance','en','Insurance'),
  ('payments-wallets','pt','Pagamentos / Carteiras digitais'), ('payments-wallets','es','Pagos / Wallets'), ('payments-wallets','en','Payments / Wallets'),
  ('wealth-investing','pt','Investimentos / Wealth'), ('wealth-investing','es','Inversión / Wealth'), ('wealth-investing','en','Wealth / Investing'),
  -- Healthcare
  ('hospitals','pt','Hospitais'),             ('hospitals','es','Hospitales'),            ('hospitals','en','Hospitals / Health Systems'),
  ('health-plans','pt','Planos de Saúde'),    ('health-plans','es','Planes de Salud'),    ('health-plans','en','Health Plans'),
  ('telehealth','pt','Telemedicina'),         ('telehealth','es','Telemedicina'),         ('telehealth','en','Telehealth'),
  ('pharma-brands','pt','Farmacêuticas'),     ('pharma-brands','es','Farmacéuticas'),     ('pharma-brands','en','Pharma Brands'),
  ('labs-diagnostics','pt','Laboratórios / Diagnósticos'), ('labs-diagnostics','es','Laboratorios / Diagnóstico'), ('labs-diagnostics','en','Labs / Diagnostics'),
  -- Education
  ('universities','pt','Universidades'),      ('universities','es','Universidades'),      ('universities','en','Universities'),
  ('business-schools','pt','Escolas de Negócios'), ('business-schools','es','Escuelas de Negocios'), ('business-schools','en','Business Schools'),
  ('online-learning','pt','Educação Online'), ('online-learning','es','Educación Online'),('online-learning','en','Online Learning'),
  ('k12-schools','pt','Escolas K-12'),        ('k12-schools','es','Colegios K-12'),       ('k12-schools','en','K-12 / International Schools'),
  ('bootcamps','pt','Bootcamps / Cursos técnicos'), ('bootcamps','es','Bootcamps / Cursos técnicos'), ('bootcamps','en','Bootcamps / Vocational'),
  -- Retail
  ('marketplaces','pt','Marketplaces'),       ('marketplaces','es','Marketplaces'),       ('marketplaces','en','Marketplaces'),
  ('grocery-ecommerce','pt','Supermercados Online'), ('grocery-ecommerce','es','Supermercados Online'), ('grocery-ecommerce','en','Grocery E-commerce'),
  ('electronics-retail','pt','Eletrônicos'),  ('electronics-retail','es','Electrónica'),  ('electronics-retail','en','Electronics Retail'),
  ('home-goods','pt','Casa e Móveis'),        ('home-goods','es','Hogar y Muebles'),      ('home-goods','en','Home Goods / Furniture'),
  ('pharmacy-retail','pt','Farmácias'),       ('pharmacy-retail','es','Farmacias'),       ('pharmacy-retail','en','Pharmacy Retail'),
  -- Travel
  ('hotels-resorts','pt','Hotéis e Resorts'), ('hotels-resorts','es','Hoteles y Resorts'),('hotels-resorts','en','Hotels / Resorts'),
  ('airlines','pt','Companhias Aéreas'),      ('airlines','es','Aerolíneas'),             ('airlines','en','Airlines'),
  ('otas-metasearch','pt','OTAs / Metabuscadores'), ('otas-metasearch','es','OTAs / Metabuscadores'), ('otas-metasearch','en','OTAs / Metasearch'),
  ('vacation-rentals','pt','Aluguel por Temporada'), ('vacation-rentals','es','Alquiler Vacacional'), ('vacation-rentals','en','Vacation Rentals'),
  ('tours-experiences','pt','Tours e Experiências'), ('tours-experiences','es','Tours y Experiencias'), ('tours-experiences','en','Tours / Experiences'),
  -- Consumer Brands
  ('beauty-cosmetics','pt','Beleza / Cosméticos'), ('beauty-cosmetics','es','Belleza / Cosméticos'), ('beauty-cosmetics','en','Beauty / Cosmetics'),
  ('luxury-fashion','pt','Moda de Luxo'),     ('luxury-fashion','es','Moda de Lujo'),     ('luxury-fashion','en','Luxury Fashion'),
  ('apparel-fast-fashion','pt','Moda / Fast Fashion'), ('apparel-fast-fashion','es','Moda / Fast Fashion'), ('apparel-fast-fashion','en','Apparel / Fast Fashion'),
  ('sportswear','pt','Esportivo'),            ('sportswear','es','Deportivo'),            ('sportswear','en','Sportswear'),
  ('jewelry-watches','pt','Joias / Relógios'),('jewelry-watches','es','Joyería / Relojes'),('jewelry-watches','en','Jewelry / Watches'),
  -- Technology
  ('ai-platforms','pt','Plataformas de IA'),  ('ai-platforms','es','Plataformas de IA'),  ('ai-platforms','en','AI Platforms'),
  ('cloud','pt','Cloud / Nuvem'),             ('cloud','es','Cloud / Nube'),              ('cloud','en','Cloud'),
  ('cybersecurity','pt','Cibersegurança'),    ('cybersecurity','es','Ciberseguridad'),    ('cybersecurity','en','Cybersecurity'),
  ('saas','pt','SaaS'),                       ('saas','es','SaaS'),                       ('saas','en','SaaS'),
  ('mobile-operators','pt','Operadoras de Celular'), ('mobile-operators','es','Operadoras Móviles'), ('mobile-operators','en','Mobile Operators'),
  -- Real Estate
  ('residential-developers','pt','Construtoras Residenciais'), ('residential-developers','es','Promotoras Residenciales'), ('residential-developers','en','Residential Developers'),
  ('property-portals','pt','Portais Imobiliários'), ('property-portals','es','Portales Inmobiliarios'), ('property-portals','en','Property Portals'),
  ('brokerages','pt','Imobiliárias'),         ('brokerages','es','Inmobiliarias'),        ('brokerages','en','Brokerages'),
  ('coworking','pt','Coworking'),             ('coworking','es','Coworking'),             ('coworking','en','Coworking / Flexible Office'),
  ('rental-platforms','pt','Plataformas de Aluguel'), ('rental-platforms','es','Plataformas de Alquiler'), ('rental-platforms','en','Rental Platforms'),
  -- Automotive
  ('automakers','pt','Montadoras'),           ('automakers','es','Fabricantes'),          ('automakers','en','Automakers'),
  ('ev-brands','pt','Veículos Elétricos'),    ('ev-brands','es','Vehículos Eléctricos'),  ('ev-brands','en','EV Brands'),
  ('ride-hailing','pt','Apps de Mobilidade'), ('ride-hailing','es','Apps de Movilidad'),  ('ride-hailing','en','Ride-Hailing'),
  ('car-rental-leasing','pt','Aluguel de Carros'), ('car-rental-leasing','es','Alquiler de Coches'), ('car-rental-leasing','en','Car Rental / Leasing'),
  ('charging-networks','pt','Redes de Recarga'), ('charging-networks','es','Redes de Recarga'), ('charging-networks','en','Charging Networks'),
  -- Food
  ('grocery-chains','pt','Redes de Supermercado'), ('grocery-chains','es','Cadenas de Supermercado'), ('grocery-chains','en','Grocery Chains'),
  ('quick-commerce','pt','Quick Commerce'),   ('quick-commerce','es','Quick Commerce'),   ('quick-commerce','en','Quick Commerce'),
  ('fast-food','pt','Fast Food'),             ('fast-food','es','Fast Food'),             ('fast-food','en','Fast Food'),
  ('coffee-chains','pt','Redes de Café'),     ('coffee-chains','es','Cadenas de Café'),   ('coffee-chains','en','Coffee Chains'),
  ('casual-dining','pt','Restaurantes Casual'),('casual-dining','es','Restaurantes Casual'),('casual-dining','en','Casual Dining');
