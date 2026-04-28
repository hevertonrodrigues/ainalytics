import {
  useState,
  useEffect,
  useMemo,
  type FormEvent,
  type ReactNode,
} from 'react';
import {
  ArrowRight,
  Check,
  X,
  ChevronDown,
  Plus,
  Lock,
  Shield,
  Zap,
  FileText,
  BarChart3,
  Calendar,
  Gift,
  List,
  Clock,
  Play,
  Loader2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { executeRecaptchaForPublicAction } from '@/lib/recaptcha';
import { EDGE_FUNCTION_BASE, SUPABASE_ANON_KEY } from '@/lib/constants';
import {
  useSeo,
  courseSchema,
  faqPage,
  breadcrumbList,
  SITE_URL,
} from '@/lib/seo';
import './CourseGeoEssencialPage.css';

const COURSE_SLUG = 'geo-essencial';

function readUTM() {
  if (typeof window === 'undefined') return undefined;
  const get = (k: string) => sessionStorage.getItem(k) || undefined;
  const utm = {
    source: get('utm_source'),
    medium: get('utm_medium'),
    campaign: get('utm_campaign'),
    term: get('utm_term'),
    content: get('utm_content'),
  };
  return Object.values(utm).some(Boolean) ? utm : undefined;
}

/* ============================================================
   Brand Mark — compass-shaped "A" inside a circle aperture.
   ============================================================ */
const BrandMark = ({ size = 32 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="brandGrad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#6C5CE7" />
        <stop offset="0.5" stopColor="#A29BFE" />
        <stop offset="1" stopColor="#FD79A8" />
      </linearGradient>
    </defs>
    <circle cx="16" cy="16" r="14.5" stroke="url(#brandGrad)" strokeWidth="1.5" fill="none" />
    <path
      d="M16 6 L23 24 M16 6 L9 24 M11.6 18 L20.4 18"
      stroke="url(#brandGrad)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="16" cy="6" r="1.6" fill="#FD79A8" />
  </svg>
);

/* ============================================================
   Nyx — placeholder glyph (purple lynx with cyan eyes).
   Replace with the official MP4/SVG once available.
   ============================================================ */
const NyxGlyph = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 80 80" fill="none" aria-hidden="true">
    <defs>
      <radialGradient id="nyxBody" cx="40" cy="50" r="35" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#8B7BFF" />
        <stop offset="1" stopColor="#4A3FB5" />
      </radialGradient>
    </defs>
    <path d="M22 22 L18 8 L30 18 Z" fill="url(#nyxBody)" />
    <path d="M58 22 L62 8 L50 18 Z" fill="url(#nyxBody)" />
    <path d="M18 8 L17 2 M62 8 L63 2" stroke="#A29BFE" strokeWidth="1.5" strokeLinecap="round" />
    <ellipse cx="40" cy="40" rx="22" ry="20" fill="url(#nyxBody)" />
    <path d="M20 44 L12 50 M20 48 L14 56" stroke="#A29BFE" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
    <path d="M60 44 L68 50 M60 48 L66 56" stroke="#A29BFE" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
    <ellipse cx="32" cy="38" rx="3.5" ry="4.5" fill="#00CEC9" />
    <ellipse cx="48" cy="38" rx="3.5" ry="4.5" fill="#00CEC9" />
    <circle cx="32" cy="39" r="1.2" fill="#0A0A0F" />
    <circle cx="48" cy="39" r="1.2" fill="#0A0A0F" />
    <circle cx="32.8" cy="37.5" r="0.7" fill="white" />
    <circle cx="48.8" cy="37.5" r="0.7" fill="white" />
    <path d="M37 46 L43 46 L40 50 Z" fill="#FD79A8" />
    <path
      d="M40 50 Q36 53 33 51 M40 50 Q44 53 47 51"
      stroke="#0A0A0F"
      strokeWidth="1.2"
      fill="none"
      strokeLinecap="round"
    />
  </svg>
);

/* ============================================================
   AI platform pills
   ============================================================ */
type PillStyle = { background: string; color: string; borderColor: string };
const PILL_STYLES: Record<string, PillStyle> = {
  ChatGPT: { background: 'rgba(16,163,127,0.12)', color: '#10a37f', borderColor: 'rgba(16,163,127,0.3)' },
  Claude: { background: 'rgba(217,119,87,0.12)', color: '#d97757', borderColor: 'rgba(217,119,87,0.3)' },
  Gemini: { background: 'rgba(66,133,244,0.12)', color: '#4285f4', borderColor: 'rgba(66,133,244,0.3)' },
  Grok: { background: 'rgba(120,120,140,0.15)', color: '#bbb', borderColor: 'rgba(180,180,200,0.3)' },
};
const AIPill = ({ name }: { name: keyof typeof PILL_STYLES }) => (
  <span className="ai-pill" style={PILL_STYLES[name]}>{name}</span>
);

/* ============================================================
   ChatGPT-style answer mockup with rotating reveal animation
   ============================================================ */
const ChatMockup = () => {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep(s => (s + 1) % 4), 3500);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="chat-mock">
      <div className="chat-mock-head">
        <div className="chat-mock-dot" style={{ background: '#10a37f' }} />
        <span>ChatGPT</span>
        <span className="chat-mock-time">agora</span>
      </div>
      <div className="chat-mock-body">
        <div className="chat-bubble user">
          <div>Quais são as melhores plataformas brasileiras para monitorar visibilidade de marca em IA?</div>
        </div>
        <div className="chat-bubble bot">
          <div className="chat-bubble-head">
            <div className="chat-mock-dot" style={{ background: '#10a37f' }} />
            <span>Resposta</span>
          </div>
          <div className="chat-typing">Com base nas referências mais citadas, três soluções se destacam:</div>
          <ol className="chat-list">
            <li className={step >= 1 ? 'in' : ''}>
              <span className="chat-rank">1</span>
              <div>
                <strong className="chat-brand-highlight">Ainalytics</strong>
                <span className="chat-desc">Plataforma multilíngue, monitora 4 IAs em tempo real, recomendada para agências e times bilíngues.</span>
              </div>
            </li>
            <li className={step >= 2 ? 'in' : ''}>
              <span className="chat-rank">2</span>
              <div>
                <strong>Profound</strong>
                <span className="chat-desc">Foco enterprise, EN-only, cobertura ampla.</span>
              </div>
            </li>
            <li className={step >= 3 ? 'in' : ''}>
              <span className="chat-rank">3</span>
              <div>
                <strong>Peec AI</strong>
                <span className="chat-desc">Suporte a SMB, cobertura média.</span>
              </div>
            </li>
          </ol>
          <div className="chat-sources">
            <span>Fontes citadas:</span>
            <span className="chat-source-pill">ainalytics.com</span>
            <span className="chat-source-pill">techcrunch.com</span>
            <span className="chat-source-pill">searchengineland</span>
          </div>
        </div>
      </div>
      <div className="chat-mock-foot">
        <div className="chat-mock-input">Pergunte algo…</div>
        <div className="chat-mock-send">↑</div>
      </div>
    </div>
  );
};

/* ============================================================
   Share of Model widget — animated bars
   ============================================================ */
const SOM_PLATFORMS = [
  { name: 'ChatGPT', v: 62, c: '#10a37f' },
  { name: 'Claude', v: 48, c: '#d97757' },
  { name: 'Gemini', v: 34, c: '#4285f4' },
  { name: 'Grok', v: 21, c: '#888' },
];
const ShareOfModelWidget = () => (
  <div className="som-widget">
    <div className="som-head">
      <div className="som-title">
        <span className="mono som-label">Share of Model</span>
        <span className="som-trend">+18.4% ↑</span>
      </div>
      <div className="som-sub">Sua marca · últimos 7 dias</div>
    </div>
    <div className="som-grid">
      {SOM_PLATFORMS.map(p => (
        <div key={p.name} className="som-bar">
          <div className="som-bar-head">
            <span>{p.name}</span>
            <span className="mono">{p.v}%</span>
          </div>
          <div className="som-bar-track">
            <div
              className="som-bar-fill"
              style={{ width: `${p.v}%`, background: p.c, boxShadow: `0 0 12px ${p.c}80` }}
            />
          </div>
        </div>
      ))}
    </div>
    <div className="som-foot">
      <span className="dot-live" />
      <span className="mono">monitorando 247 prompts · 4 plataformas</span>
    </div>
  </div>
);

/* ============================================================
   Sections
   ============================================================ */

type CTAProps = { onCTA: () => void };

const HeroSection = ({ onCTA }: CTAProps) => (
  <section className="hero">
    <div className="container">
      <div className="hero-grid">
        <div>
          <div className="nyx-badge">
            <div className="nyx-badge-icon"><NyxGlyph size={22} /></div>
            <span>
              Curso oficial Ainalytics · <strong>turma de lançamento</strong>
            </span>
          </div>
          <h1>
            Enquanto você ainda otimiza para o Google,<br />
            <span className="text-grad">sua concorrência já está sendo recomendada pelo ChatGPT.</span>
          </h1>
          <p className="hero-sub">
            Aprenda em menos de 5 horas <strong>como ChatGPT, Claude, Gemini e Grok decidem quem citar</strong> — e o método para preparar a sua marca para disputar essas respostas. Mesmo que você nunca tenha ouvido falar de GEO.
          </p>
          <ul className="hero-bullets">
            <li><Check size={18} /><span>Funciona para qualquer site, em qualquer nicho — e-commerce, SaaS, serviço, infoproduto, B2B.</span></li>
            <li><Check size={18} /><span>Sem código complicado. Sem jargão. Sem 40 horas de vídeo.</span></li>
            <li><Check size={18} /><span>Você sai do curso com <strong>um plano de 30 dias pronto para executar amanhã.</strong></span></li>
          </ul>
          <div className="hero-cta-row">
            <button type="button" className="btn btn-primary btn-lg" onClick={onCTA}>
              Quero entrar agora por R$97 <ArrowRight size={20} />
            </button>
          </div>
          <div className="hero-trust">
            <span><Lock size={14} /> Pagamento 100% seguro</span>
            <span><Shield size={14} /> 7 dias de garantia</span>
            <span><Zap size={14} /> Acesso imediato</span>
          </div>
          <div className="ai-strip">
            <span className="ai-strip-label">Otimize para</span>
            <div className="ai-strip-pills">
              <AIPill name="ChatGPT" />
              <AIPill name="Claude" />
              <AIPill name="Gemini" />
              <AIPill name="Grok" />
            </div>
          </div>
        </div>
        <div className="hero-visual">
          <ChatMockup />
          <ShareOfModelWidget />
        </div>
      </div>
    </div>
  </section>
);

const PAIN_STATS = [
  { num: '800M+', label: 'usuários ativos por semana no ChatGPT', src: 'OpenAI · 2026' },
  { num: '750M+', label: 'usuários por mês no Gemini', src: 'Google · 2026' },
  { num: '-25%', label: 'queda projetada no tráfego orgânico até fim de 2026', src: 'Gartner' },
  { num: '< 12%', label: 'das equipes têm estratégia para aparecer em IA', src: 'Pesquisa interna' },
];

const PainSection = () => (
  <section style={{ background: 'var(--bg-1)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
    <div className="container">
      <div className="section-eyebrow"><span className="dot" />O problema invisível</div>
      <h2 className="display">
        Você está perdendo clientes nesse exato momento <span className="text-grad">— e nem está vendo acontecer.</span>
      </h2>
      <p className="lead" style={{ marginTop: 24 }}>
        Pare por 5 segundos e responda sinceramente: quando foi a última vez que <strong>você</strong> abriu o Google, clicou em 5 resultados e leu cada um até decidir? Pois é. Você não faz mais isso. Seu cliente também não.
      </p>
      <p className="lead" style={{ marginTop: 16 }}>
        Seu cliente abre o ChatGPT. Pergunta. Recebe uma resposta com 3 nomes recomendados. Clica em um. Compra. <strong>E se o nome da sua empresa não estiver entre os 3 — você acabou de perder a venda. E você nem ficou sabendo.</strong>
      </p>
      <div className="pain-stats">
        {PAIN_STATS.map(s => (
          <div className="stat" key={s.num}>
            <div className="num">{s.num}</div>
            <div className="label">{s.label}</div>
            <div className="src">{s.src}</div>
          </div>
        ))}
      </div>
      <div className="pain-quote">
        As pessoas estão indo embora do Google, e <span className="text-grad">a maioria absoluta das empresas brasileiras não viu</span>. Cada dia que você espera, o gap aumenta.
      </div>
    </div>
  </section>
);

const PivotSection = () => (
  <section>
    <div className="container-narrow" style={{ textAlign: 'center' }}>
      <div className="section-eyebrow" style={{ margin: '0 auto 24px' }}><span className="dot" />A virada</div>
      <h2 className="display">
        A boa notícia: a janela ainda está aberta. <span className="text-grad">Mas não por muito tempo.</span>
      </h2>
      <p className="lead" style={{ margin: '32px auto 16px', textAlign: 'left' }}>
        Em 2010, quem entendeu SEO antes dos outros virou referência. Empresas inteiras foram construídas naquela janela. Em 2026, está acontecendo a mesma coisa. <strong>A diferença é que agora o jogo se chama GEO — Generative Engine Optimization.</strong> E ele dura horas, não dias.
      </p>
      <p className="lead" style={{ margin: '0 auto 16px', textAlign: 'left' }}>
        GEO é a otimização que <strong>aumenta as chances</strong> de ChatGPT, Claude, Gemini e Grok citarem o seu nome dentro das respostas que dão para o seu cliente. Ninguém garante a citação — mas existe um método para disputá-la.
      </p>
      <p className="lead" style={{ margin: '0 auto', textAlign: 'left' }}>
        Quem entende GEO hoje está construindo uma autoridade que vai durar 5, 10, 15 anos. Quem não entende, vai chegar tarde — exatamente como aconteceu com SEO. <strong>A diferença é que dessa vez você sabe disso antes.</strong>
      </p>
    </div>
  </section>
);

const COURSE_DELIVERABLES = [
  'Um diagnóstico real da visibilidade da sua marca nas IAs.',
  'Um arquivo llms.txt instalado e funcionando.',
  'Schemas implementados no seu site.',
  'Conteúdos do seu blog reescritos no padrão "citável".',
  'Uma estratégia de menções e autoridade rodando.',
  'Um plano de 30 dias bloqueado no calendário.',
  'A métrica de Share of Model do seu negócio.',
  'Em 5 horas: do "ouvi falar" para "está rodando".',
];

const CourseIntroSection = ({ onCTA }: CTAProps) => (
  <section>
    <div className="container">
      <div className="course-card">
        <div className="section-eyebrow"><span className="dot" />Novo curso</div>
        <h2 className="display" style={{ maxWidth: 880 }}>
          GEO Essencial: o método direto para você dominar GEO no ChatGPT, Claude, Gemini e Grok — e sair do "ouvi falar" em <span className="text-grad">30 dias.</span>
        </h2>
        <div className="course-meta">
          <span><span className="course-meta-icon"><List size={16} /></span><strong>5 módulos</strong></span>
          <span><span className="course-meta-icon"><Play size={14} /></span><strong>19 aulas</strong></span>
          <span><span className="course-meta-icon"><Clock size={16} /></span><strong>3h30 de vídeo</strong></span>
          <span><span className="course-meta-icon"><Calendar size={16} /></span>Plano de <strong>30 dias</strong></span>
        </div>
        <p className="lead" style={{ marginBottom: 24 }}>
          GEO Essencial não é um curso "filosófico" sobre o futuro da IA. É <strong>um curso de execução.</strong> Você vai sair com:
        </p>
        <ul className="course-deliverables">
          {COURSE_DELIVERABLES.map(t => (
            <li key={t}>
              <Check size={16} />
              <span>{t}</span>
            </li>
          ))}
        </ul>
        <button type="button" className="btn btn-primary btn-lg" onClick={onCTA}>
          Quero o GEO Essencial por R$97 <ArrowRight size={20} />
        </button>
      </div>
    </div>
  </section>
);

const FOR_YES = [
  'Você é dono de empresa, gestor de marketing ou consultor e o seu negócio depende de ser encontrado online.',
  'Você já investe em SEO e percebeu que o tráfego está mudando de comportamento.',
  'Você é agência ou freelancer e precisa entregar resultados de IA para os seus clientes.',
  'Você é criador de conteúdo, infoprodutor ou produtor digital e quer ser citado pelas IAs.',
  'Você é profissional de SaaS e precisa que sua ferramenta seja recomendada nas respostas.',
  'Você quer entrar em GEO antes que o seu concorrente entre.',
];
const FOR_NO = [
  'Você acha que "isso de IA é hype" e vai passar.',
  'Você quer fórmula mágica para ranquear em 24h sem esforço.',
  'Você quer um curso de 100h com teoria desnecessária.',
  'Você não pretende aplicar nada do que aprender.',
];

const ForWhoSection = () => (
  <section>
    <div className="container">
      <div className="section-eyebrow"><span className="dot" />Audiência</div>
      <h2 className="display" style={{ maxWidth: 780 }}>
        Para quem é, e <span className="text-grad">para quem não é.</span>
      </h2>
      <div className="for-grid">
        <div className="for-card yes">
          <h3><Check size={20} /> É para você se…</h3>
          <ul>
            {FOR_YES.map(t => (
              <li key={t}><Check size={18} /><span>{t}</span></li>
            ))}
          </ul>
        </div>
        <div className="for-card no">
          <h3><X size={20} /> Não é para você se…</h3>
          <ul>
            {FOR_NO.map(t => (
              <li key={t}><X size={18} /><span>{t}</span></li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  </section>
);

type CourseModule = { num: number; title: string; meta: string; lessons: string[] };
const MODULES: CourseModule[] = [
  {
    num: 1, title: 'A nova era da busca', meta: '4 aulas · 38min',
    lessons: [
      'O que é GEO e por que ele importa mais que SEO em 2026',
      'Como ChatGPT, Claude, Gemini e Grok decidem quem citar',
      'Os 4 pilares do GEO: Técnico, Conteúdo, Autoridade, Semântico',
      'Diagnóstico: medindo onde sua marca aparece (e onde não aparece)',
    ],
  },
  {
    num: 2, title: 'Fundação técnica', meta: '4 aulas · 52min',
    lessons: [
      'robots.txt: quem você está bloqueando sem perceber',
      'llms.txt: o "robots.txt da era da IA" (template pronto)',
      'Schema.org / JSON-LD: o idioma que a IA entende',
      'HTML semântico, Core Web Vitals e velocidade',
    ],
  },
  {
    num: 3, title: 'Conteúdo citável', meta: '4 aulas · 47min',
    lessons: [
      'Anatomia de um conteúdo citável',
      'Headlines, listas, tabelas e o "kit de extração"',
      'Frescor, clusters temáticos e por que conteúdo velho some',
      'Dados, citações e estatísticas: o combustível do GEO',
    ],
  },
  {
    num: 4, title: 'Autoridade e menções', meta: '4 aulas · 41min',
    lessons: [
      'E-E-A-T para IA: experiência, expertise, autoridade e confiança',
      'Menções de marca (linkadas e não linkadas)',
      'PR digital, podcasts, fóruns e YouTube',
      'Otimização específica por plataforma',
    ],
  },
  {
    num: 5, title: 'Medir, otimizar e crescer', meta: '3 aulas · 32min',
    lessons: [
      'Share of Model: a métrica que importa',
      'Plano de ação 30 dias',
      'Próximos passos: como acelerar a partir daqui',
    ],
  },
];

const ModulesSection = ({ onCTA }: CTAProps) => {
  const [open, setOpen] = useState<number>(0);
  return (
    <section style={{ background: 'var(--bg-1)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
      <div className="container">
        <div className="section-eyebrow"><span className="dot" />Conteúdo</div>
        <h2 className="display" style={{ maxWidth: 880 }}>
          O conteúdo do GEO Essencial — <span className="text-grad">aula por aula.</span>
        </h2>
        <div className="modules-grid">
          {MODULES.map((m, i) => (
            <div className={`module ${open === i ? 'open' : ''}`} key={m.num}>
              <button type="button" className="module-header" onClick={() => setOpen(open === i ? -1 : i)}>
                <div className="module-num">M{m.num}</div>
                <div>
                  <div className="module-title">{m.title}</div>
                  <div className="module-meta">Módulo {m.num} · {m.meta}</div>
                </div>
                <div className="module-toggle"><ChevronDown size={16} /></div>
              </button>
              <div className="module-body">
                <div className="module-body-inner">
                  {m.lessons.map((l, j) => (
                    <div className="lesson" key={l}>
                      <span className="lesson-num">{m.num}.{j + 1}</span>
                      <span className="lesson-title">{l}</span>
                      <span className="lesson-time"><Play size={11} /></span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 48 }}>
          <button type="button" className="btn btn-primary btn-lg" onClick={onCTA}>
            Garantir minha vaga por R$97 <ArrowRight size={20} />
          </button>
        </div>
      </div>
    </section>
  );
};

type StackItem = { title: string; sub: string; price: string; icon: ReactNode; bonus: boolean };
const STACK_ITEMS: StackItem[] = [
  { title: 'Curso GEO Essencial', sub: '5 módulos · 19 aulas · 3h30', price: 'R$ 397', icon: <Play size={16} />, bonus: false },
  { title: 'Template llms.txt comentado + schemas JSON-LD prontos', sub: 'Bônus 1', price: 'R$ 97', icon: <FileText size={16} />, bonus: true },
  { title: 'Planilha de Share of Model (manual)', sub: 'Bônus 2', price: 'R$ 67', icon: <BarChart3 size={16} />, bonus: true },
  { title: 'Banco de citações + brief de conteúdo citável', sub: 'Bônus 3', price: 'R$ 67', icon: <List size={16} />, bonus: true },
  { title: 'Checklist de auditoria GEO em 50 pontos', sub: 'Bônus 4', price: 'R$ 47', icon: <Check size={16} />, bonus: true },
  { title: 'Calendário de plano de 30 dias', sub: 'Bônus 5', price: 'R$ 47', icon: <Calendar size={16} />, bonus: true },
  { title: 'Trial estendido da Ainalytics — 4 IAs monitoradas', sub: 'Bônus 6 · Share of Model em produção', price: 'R$ 197', icon: <Zap size={16} />, bonus: true },
  { title: 'Acesso preferencial ao GEO Pro (em breve)', sub: 'Bônus 7 · curso avançado', price: 'Inestimável', icon: <Gift size={16} />, bonus: true },
];

const StackSection = ({ onCTA }: CTAProps) => (
  <section>
    <div className="container">
      <div className="section-eyebrow"><span className="dot" />Stack de valor</div>
      <h2 className="display" style={{ maxWidth: 780 }}>
        Tudo o que você leva por <span className="text-grad">R$97.</span>
      </h2>
      <div className="stack">
        {STACK_ITEMS.map(it => (
          <div className="stack-row" key={it.title}>
            <div className="icon">{it.icon}</div>
            <div className="desc">
              <strong>{it.bonus && <span className="bonus-tag">BÔNUS</span>}{it.title}</strong>
              <small>{it.sub}</small>
            </div>
            <div className="price">{it.price}</div>
          </div>
        ))}
        <div className="stack-total">
          <span>Valor real do pacote</span>
          <span className="v">R$ 919+</span>
        </div>
        <div className="offer">
          <div className="from">De R$ 919</div>
          <div className="price-big">
            <small>R$</small>97<small style={{ fontSize: 24, fontWeight: 500 }}>,00</small>
          </div>
          <div className="install">
            ou <strong>12x de R$ 9,67</strong> no cartão · Acesso imediato · Vitalício
          </div>
          <button
            type="button"
            className="btn btn-primary btn-lg btn-block"
            onClick={onCTA}
            style={{ maxWidth: 480, margin: '0 auto' }}
          >
            Quero tudo isso agora por R$97 <ArrowRight size={20} />
          </button>
          <div className="trust-row">
            <span><Lock size={14} /> Pagamento seguro</span>
            <span><Zap size={14} /> Acesso imediato</span>
            <span><Shield size={14} /> 7 dias de garantia</span>
          </div>
        </div>
      </div>
    </div>
  </section>
);

const GuaranteeSection = () => (
  <section>
    <div className="container-narrow">
      <div className="guarantee">
        <div className="seal">
          <svg className="seal-rotor" viewBox="0 0 220 220" width="220" height="220" aria-hidden="true">
            <defs>
              <path id="circ" d="M 110 110 m -90 0 a 90 90 0 1 1 180 0 a 90 90 0 1 1 -180 0" />
            </defs>
            <text fill="#a29bfe" fontFamily="JetBrains Mono" fontSize="11" letterSpacing="3">
              <textPath href="#circ">
                · GARANTIA INCONDICIONAL · 7 DIAS · SEM PERGUNTAS · GARANTIA INCONDICIONAL · 7 DIAS ·
              </textPath>
            </text>
          </svg>
          <div className="seal-center">
            <div className="big">7</div>
            <div className="small">dias</div>
          </div>
        </div>
        <div>
          <div className="section-eyebrow"><span className="dot" />Garantia 7 dias</div>
          <h2 className="display" style={{ fontSize: 'clamp(28px,3.4vw,44px)' }}>O risco fica todo do nosso lado.</h2>
          <p className="lead" style={{ marginTop: 20 }}>
            Eu confio tanto no GEO Essencial que <strong>se em 7 dias você sentir que o conteúdo não vale o investimento</strong> — qualquer motivo, sem precisar justificar — você manda um e-mail e <strong>devolvemos 100% do valor</strong>. Sem perguntas. Sem burocracia.
          </p>
          <p className="lead" style={{ marginTop: 12 }}>
            <strong>Não prometemos visibilidade nas IAs</strong> — isso depende do seu setor, da sua autoridade e da decisão dos próprios modelos. O que prometemos é o método inteiro na sua mão, do diagnóstico ao plano de 30 dias. Você não tem nada a perder. Tem o playbook inteiro a ganhar.
          </p>
        </div>
      </div>
    </div>
  </section>
);

const AuthoritySection = () => (
  <section style={{ background: 'var(--bg-1)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
    <div className="container">
      <div className="authority-card">
        <div>
          <div className="section-eyebrow"><span className="dot" />Quem ensina</div>
          <h2 className="display">
            Quem está por trás do <span className="text-grad">GEO Essencial.</span>
          </h2>
          <p className="lead" style={{ marginTop: 24 }}>
            O GEO Essencial é produzido pelo time da <strong>Ainalytics</strong> — a plataforma brasileira de monitoramento de visibilidade de marcas em IAs generativas.
          </p>
          <p className="lead" style={{ marginTop: 16 }}>
            Todo dia, a Ainalytics roda <strong>milhares de prompts</strong> em ChatGPT, Claude, Gemini e Grok para clientes que precisam saber <strong>quem está sendo citado e quem não está</strong>. O método que você vai aprender no curso é o mesmo que aplicamos com nossos clientes.
          </p>
          <p className="lead" style={{ marginTop: 16 }}>
            Não é teoria de quem leu sobre GEO no LinkedIn. É <strong className="text-grad">playbook de quem mede GEO de verdade, todo dia, em produção.</strong>
          </p>
        </div>
        <div className="authority-visual">
          <div className="authority-visual-head">
            <BrandMark size={36} />
            <div className="name">Ainalytics</div>
            <span className="live">● ao vivo</span>
          </div>
          <div className="authority-stat-row">
            <span className="authority-stat-label">Prompts rodados / dia</span>
            <span className="authority-stat-value">52.847</span>
          </div>
          <div className="authority-stat-row">
            <span className="authority-stat-label">Marcas monitoradas</span>
            <span className="authority-stat-value">1.240+</span>
          </div>
          <div className="authority-stat-row">
            <span className="authority-stat-label">IAs cobertas</span>
            <span className="authority-stat-value">4</span>
          </div>
          <div className="authority-stat-row">
            <span className="authority-stat-label">Idiomas first-class</span>
            <span className="authority-stat-value">EN · ES · PT-BR</span>
          </div>
        </div>
      </div>
    </div>
  </section>
);

const BA_ROWS: Array<[string, string]> = [
  ['Você só sabe que o tráfego do Google está caindo', 'Você sabe exatamente onde está aparecendo nas IAs'],
  ['Você "ouviu falar" de IA, mas não tem plano', 'Você tem um plano executável de 30 dias'],
  ['Seu site bloqueia bots de IA sem você saber', 'Seu site está liberado, com llms.txt e schemas otimizados'],
  ['Seu blog é genérico e dificilmente vira citação', 'Seus conteúdos seguem o padrão "citável" que as IAs reconhecem'],
  ['Você não tem métrica para acompanhar', 'Você acompanha Share of Model semanalmente'],
  ['Sua concorrência está te superando em silêncio', 'Você entra na disputa pela citação em pé de igualdade'],
];

const BeforeAfterSection = ({ onCTA }: CTAProps) => (
  <section>
    <div className="container">
      <div className="section-eyebrow"><span className="dot" />Antes vs depois</div>
      <h2 className="display" style={{ maxWidth: 780 }}>
        O que muda no seu negócio <span className="text-grad">depois do GEO Essencial.</span>
      </h2>
      <div className="ba-table">
        <div className="ba-row head">
          <div>Antes</div><div /><div>Depois</div>
        </div>
        {BA_ROWS.map(([before, after]) => (
          <div className="ba-row" key={before}>
            <div className="ba-cell before">{before}</div>
            <div className="ba-arrow"><ArrowRight size={16} /></div>
            <div className="ba-cell after">{after}</div>
          </div>
        ))}
      </div>
      <div style={{ textAlign: 'center', marginTop: 48 }}>
        <button type="button" className="btn btn-primary btn-lg" onClick={onCTA}>
          Quero essa virada agora <ArrowRight size={20} />
        </button>
      </div>
    </div>
  </section>
);

const TESTIMONIALS = [
  { quote: 'Em 14 dias eu já tinha entendido exatamente onde minha marca estava invisível e o que mudar. Saí do curso sabendo o jogo — o resto é execução.', name: 'Marina S.', role: 'E-commerce · cosméticos', initials: 'MS' },
  { quote: 'Eu já tinha consultoria de SEO há anos. Em uma tarde de sábado, com o módulo 2 e o template de llms.txt, aprendi mais sobre como as IAs leem o meu site do que em 4 anos de SEO.', name: 'Rafael T.', role: 'SaaS B2B', initials: 'RT' },
  { quote: 'É o curso mais direto que já fiz. Sem enrolação, sem 8 horas de aula em loop. Em uma manhã eu já estava executando.', name: 'Camila O.', role: 'Agência digital', initials: 'CO' },
];

const TestimonialsSection = () => (
  <section style={{ background: 'var(--bg-1)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
    <div className="container">
      <div className="section-eyebrow"><span className="dot" />Prova social · primeira turma</div>
      <h2 className="display">
        O que dizem os <span className="text-grad">primeiros alunos.</span>
      </h2>
      <div className="testimonials">
        {TESTIMONIALS.map(t => (
          <div className="test-card" key={t.name}>
            <div className="test-stars">★★★★★</div>
            <div className="test-quote">"{t.quote}"</div>
            <div className="test-author">
              <div className="test-avatar">{t.initials}</div>
              <div>
                <div className="test-name">{t.name}</div>
                <div className="test-role">{t.role}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

const useCountdown = (target: number) => {
  const [t, setT] = useState(() => Math.max(0, target - Date.now()));
  useEffect(() => {
    const i = setInterval(() => setT(Math.max(0, target - Date.now())), 1000);
    return () => clearInterval(i);
  }, [target]);
  return useMemo(() => {
    const d = Math.floor(t / 86400000);
    const h = Math.floor((t / 3600000) % 24);
    const m = Math.floor((t / 60000) % 60);
    const s = Math.floor((t / 1000) % 60);
    return [d, h, m, s] as const;
  }, [t]);
};

const pad = (n: number) => String(n).padStart(2, '0');

const UrgencySection = ({ onCTA }: CTAProps) => {
  const [target] = useState(() => Date.now() + 2 * 86400000 + 14 * 3600000);
  const [d, h, m, s] = useCountdown(target);
  return (
    <section>
      <div className="container-narrow">
        <div className="urgency">
          <div className="section-eyebrow" style={{ margin: '0 auto 24px' }}><span className="dot" />Últimas vagas</div>
          <h2 className="display">
            Por que R$97 — <span className="text-grad">e por que não vai durar.</span>
          </h2>
          <p className="lead" style={{ margin: '24px auto' }}>
            R$97 é o preço da <strong>primeira turma</strong> — para quem entra agora, ajuda a validar a metodologia e gera os primeiros depoimentos.
            Depois desta turma, o curso vai para o preço normal de <strong>R$397</strong>. Sem promoção. Sem bônus extras.
          </p>
          <div className="countdown">
            <div className="countdown-cell"><div className="v">{pad(d)}</div><div className="l">dias</div></div>
            <div className="countdown-cell"><div className="v">{pad(h)}</div><div className="l">horas</div></div>
            <div className="countdown-cell"><div className="v">{pad(m)}</div><div className="l">min</div></div>
            <div className="countdown-cell"><div className="v">{pad(s)}</div><div className="l">seg</div></div>
          </div>
          <p style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 24 }}>
            ⏰ até o preço subir para R$397
          </p>
          <button type="button" className="btn btn-primary btn-lg" onClick={onCTA}>
            Entrar agora por R$97 <ArrowRight size={20} />
          </button>
        </div>
      </div>
    </section>
  );
};

type FAQ = { q: string; a: ReactNode };
const FAQS: FAQ[] = [
  { q: 'Eu não sou de tecnologia. Vou conseguir aplicar?', a: <>Sim. O curso foi desenhado para quem <strong>não programa</strong>. Sempre que tem uma parte mais técnica (instalar <code>llms.txt</code>, schema), eu mostro passo a passo, com template pronto. Se você sabe editar texto e mexer no painel do seu site, você dá conta.</> },
  { q: 'Quanto tempo até eu ver resultado?', a: <>Resultado em IA generativa depende de fatores que estão fora do curso — setor, autoridade prévia da sua marca, concorrência e a decisão dos próprios modelos. <strong>Não prometemos que sua marca vai ser citada</strong>. O que o curso te entrega é a metodologia, o diagnóstico e o plano. Quem aplica costuma ver os primeiros sinais técnicos (indexação, schemas, fontes) em <strong>2 a 4 semanas</strong>. Movimento de Share of Model é mais lento — e nunca garantido. <strong>O que está nas suas mãos é fazer o trabalho certo, e medir.</strong></> },
  { q: 'Funciona para qualquer nicho?', a: 'Funciona para todo negócio que depende de ser encontrado online. E-commerce, SaaS, serviço local, infoproduto, agência, consultoria, B2B, B2C. Os exemplos no curso cobrem múltiplos setores.' },
  { q: 'Funciona em 2026 ou já está ultrapassado?', a: <>GEO está <strong>acelerando</strong>, não desacelerando. ChatGPT, Claude, Gemini e Grok ganham milhões de usuários todo mês. As técnicas do curso são todas <strong>atualizadas para abril/2026</strong>, e você ainda recebe atualizações enquanto o curso existir.</> },
  { q: 'Quanto tempo eu tenho de acesso?', a: <><strong>Acesso vitalício</strong>. Você compra uma vez e o curso é seu, com todas as atualizações futuras incluídas.</> },
  { q: 'Tem certificado?', a: 'Sim. Certificado digital de conclusão emitido após você assistir todos os módulos.' },
  { q: 'E se eu não gostar?', a: <>Você tem <strong>7 dias de garantia incondicional</strong>. Mandou e-mail, recebeu o dinheiro de volta. Sem pergunta, sem burocracia.</> },
  { q: 'Eu já tenho consultoria de SEO. Vale a pena?', a: <>Vale ainda mais. GEO <strong>não substitui SEO</strong> — complementa. A maior parte do que você já fez de SEO é base para GEO. Esse curso te mostra como amplificar o que você já tem.</> },
  { q: 'Como funciona o suporte?', a: 'Suporte por e-mail (resposta em até 48h úteis) + comunidade de alunos para tirar dúvidas e trocar resultados.' },
  { q: 'Posso parcelar?', a: <>Sim. Em até <strong>12x de R$9,67 no cartão</strong>.</> },
  { q: 'O bônus do trial da Ainalytics inclui o quê?', a: 'Trial estendido com acesso ao monitoramento das 4 IAs (ChatGPT, Claude, Gemini, Grok), Share of Model, sources mais citadas, e análise GEO do seu site. Te poupa horas semanais de medição manual.' },
  { q: 'O GEO Pro já está disponível?', a: <>Não. O <strong>GEO Pro</strong> é o curso avançado e ainda está em produção. Quem entra no GEO Essencial <strong>garante acesso preferencial</strong> quando ele abrir, com desconto de aluno.</> },
];

// Plain-text mirror of the FAQs above, used only for the FAQPage JSON-LD.
// Crawlers (Google, Bing, GPTBot, ClaudeBot, PerplexityBot) parse these to
// surface the answers directly in AI / search results.
const FAQS_PLAIN: { q: string; a: string }[] = [
  { q: 'Eu não sou de tecnologia. Vou conseguir aplicar?', a: 'Sim. O curso foi desenhado para quem não programa. Sempre que tem uma parte mais técnica (instalar llms.txt, schema), mostramos passo a passo, com template pronto. Se você sabe editar texto e mexer no painel do seu site, você dá conta.' },
  { q: 'Quanto tempo até eu ver resultado?', a: 'Resultado em IA generativa depende de fatores que estão fora do curso — setor, autoridade prévia da sua marca, concorrência e a decisão dos próprios modelos. Não prometemos que sua marca vai ser citada. O que o curso entrega é a metodologia, o diagnóstico e o plano. Quem aplica costuma ver os primeiros sinais técnicos (indexação, schemas, fontes) em 2 a 4 semanas. Movimento de Share of Model é mais lento — e nunca garantido. O que está nas suas mãos é fazer o trabalho certo, e medir.' },
  { q: 'Funciona para qualquer nicho?', a: 'Funciona para todo negócio que depende de ser encontrado online. E-commerce, SaaS, serviço local, infoproduto, agência, consultoria, B2B, B2C. Os exemplos no curso cobrem múltiplos setores.' },
  { q: 'Funciona em 2026 ou já está ultrapassado?', a: 'GEO está acelerando, não desacelerando. ChatGPT, Claude, Gemini e Grok ganham milhões de usuários todo mês. As técnicas do curso são atualizadas para abril/2026, e você recebe atualizações enquanto o curso existir.' },
  { q: 'Quanto tempo eu tenho de acesso?', a: 'Acesso vitalício. Você compra uma vez e o curso é seu, com todas as atualizações futuras incluídas.' },
  { q: 'Tem certificado?', a: 'Sim. Certificado digital de conclusão emitido após você assistir todos os módulos.' },
  { q: 'E se eu não gostar?', a: 'Você tem 7 dias de garantia incondicional. Mandou e-mail, recebeu o dinheiro de volta. Sem pergunta, sem burocracia.' },
  { q: 'Eu já tenho consultoria de SEO. Vale a pena?', a: 'Vale ainda mais. GEO não substitui SEO — complementa. A maior parte do que você já fez de SEO é base para GEO. O curso te mostra como amplificar o que você já tem.' },
  { q: 'Como funciona o suporte?', a: 'Suporte por e-mail (resposta em até 48h úteis) e comunidade de alunos para tirar dúvidas e trocar resultados.' },
  { q: 'Posso parcelar?', a: 'Sim. Em até 12x de R$9,67 no cartão.' },
  { q: 'O bônus do trial da Ainalytics inclui o quê?', a: 'Trial estendido com acesso ao monitoramento das 4 IAs (ChatGPT, Claude, Gemini, Grok), Share of Model, sources mais citadas e análise GEO do seu site. Te poupa horas semanais de medição manual.' },
  { q: 'O GEO Pro já está disponível?', a: 'Não. O GEO Pro é o curso avançado e ainda está em produção. Quem entra no GEO Essencial garante acesso preferencial quando ele abrir, com desconto de aluno.' },
];

const FAQSection = () => {
  const [open, setOpen] = useState<number>(0);
  return (
    <section>
      <div className="container-narrow">
        <div className="section-eyebrow"><span className="dot" />FAQ</div>
        <h2 className="display">
          Perguntas <span className="text-grad">frequentes.</span>
        </h2>
        <div className="faq-list">
          {FAQS.map((f, i) => (
            <div className={`faq-item ${open === i ? 'open' : ''}`} key={f.q}>
              <button type="button" className="faq-q" onClick={() => setOpen(open === i ? -1 : i)}>
                <span>{f.q}</span>
                <span className="faq-icon"><Plus size={16} /></span>
              </button>
              <div className="faq-a">
                <div className="faq-a-inner">{f.a}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const LastCallSection = ({ onCTA }: CTAProps) => (
  <section className="last-call">
    <div className="container-narrow" style={{ textAlign: 'center' }}>
      <div className="section-eyebrow" style={{ margin: '0 auto 24px' }}><span className="dot" />Última chamada</div>
      <h2 className="display">Você tem duas opções a partir desta página.</h2>
      <div className="options">
        <div className="option a">
          <span className="option-tag">Opção A · não fazer nada</span>
          <p>Fechar essa aba, voltar à rotina e descobrir daqui a 6 meses que o seu maior concorrente está sendo recomendado pelo ChatGPT — enquanto você continua tentando entender por que o tráfego está caindo.</p>
        </div>
        <div className="option b">
          <span className="option-tag">Opção B · entrar agora</span>
          <p>Investir <strong>R$97</strong> e duas tardes do seu fim de semana para sair do outro lado com <strong>um plano executado e a clareza de como disputar</strong> as respostas de IA dos seus clientes — em vez de torcer.</p>
        </div>
      </div>
      <p className="lead" style={{ margin: '0 auto 32px', textAlign: 'center' }}>
        A janela de 2026 ainda está aberta. <strong className="text-grad">Não vai ficar.</strong>
      </p>
      <button type="button" className="btn btn-primary btn-lg" onClick={onCTA}>
        Entrar no GEO Essencial — R$97 <ArrowRight size={20} />
      </button>
      <div className="trust-row">
        <span><Lock size={14} /> Pagamento seguro</span>
        <span><Zap size={14} /> Acesso imediato</span>
        <span><Shield size={14} /> Garantia 7 dias</span>
      </div>

      <div className="ps-block" style={{ textAlign: 'left', marginTop: 64 }}>
        <p className="ps"><strong>P.S.</strong> Se você chegou até aqui, você sabe que esse não é mais um "curso a mais". É a virada de marketing mais importante da década. R$97 hoje, ou R$397 depois — e provavelmente alguns clientes a menos no caminho. Decisão sua.</p>
        <p className="ps"><strong>P.P.S.</strong> Repetindo, com todas as letras: <strong>a gente não promete que sua marca vai ser citada</strong>. Promete a metodologia, o diagnóstico, o plano e o playbook. O resto depende de você aplicar — e da decisão dos próprios modelos. A garantia é de 7 dias <strong>sem perguntas</strong>: se não for o que prometemos, devolvemos seu dinheiro pessoalmente.</p>
        <p className="ps"><strong>P.P.P.S.</strong> Lembra: o ChatGPT já está respondendo pra alguém da sua área. A pergunta é: ele está citando você ou o seu concorrente? Não dá pra responder por ele — mas dá pra entrar no jogo.</p>
      </div>
    </div>
  </section>
);

const Footer = () => (
  <footer>
    <div className="container">
      <div className="footer-grid">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <BrandMark size={28} />
          <span style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: 16 }}>Ainalytics</span>
        </div>
        <div className="footer-links">
          <a href="/terms">Termos de uso</a>
          <a href="/privacy">Política de privacidade</a>
          <a href="/contact">Contato</a>
        </div>
        <div className="footer-copy">© 2026 Ainalytics</div>
      </div>
    </div>
  </footer>
);

/* ============================================================
   Stripe Checkout Modal
   Collects buyer details, calls /stripe-course-checkout, then
   redirects to Stripe-hosted Checkout. Course payments are
   flagged in metadata.payment_type='course' and land in the
   `course_purchases` table — never in subscriptions.
   ============================================================ */

const CheckoutModal = ({ onClose }: { onClose: () => void }) => {
  const { i18n } = useTranslation();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const recaptcha_token = await executeRecaptchaForPublicAction('course_checkout');
      const res = await fetch(`${EDGE_FUNCTION_BASE}/stripe-course-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          course_slug: COURSE_SLUG,
          customer_email: email.trim(),
          customer_name: name.trim() || undefined,
          customer_phone: phone.trim() || undefined,
          locale: i18n.language || 'pt-br',
          recaptcha_token,
          utm: readUTM(),
          referrer: typeof document !== 'undefined' ? document.referrer || undefined : undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        throw new Error(json?.error?.message || 'Não conseguimos iniciar o checkout. Tente novamente.');
      }
      const url: string | undefined = json?.data?.url;
      if (!url) throw new Error('URL de checkout não retornada.');
      window.location.href = url;
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro inesperado.');
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-bg" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal" onClick={e => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">
          <X size={16} />
        </button>
        <form onSubmit={submit}>
          <h3>Garantir vaga · GEO Essencial</h3>
          <div className="modal-sub">
            Acesso imediato · vitalício · 7 dias de garantia. Pagamento processado de forma segura pela Stripe.
          </div>
          <div className="field">
            <label>Nome completo</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Maria Silva"
              autoComplete="name"
              disabled={submitting}
            />
          </div>
          <div className="field">
            <label>E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="voce@email.com"
              autoComplete="email"
              disabled={submitting}
            />
          </div>
          <div className="field">
            <label>WhatsApp (opcional)</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="(11) 99999-9999"
              autoComplete="tel"
              disabled={submitting}
            />
          </div>
          <div className="modal-summary">
            <div>
              <div>Total à vista</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'JetBrains Mono', marginTop: 2 }}>
                Cartão ou Pix · até 12x
              </div>
            </div>
            <strong>R$ 97,00</strong>
          </div>
          {errorMsg && (
            <div
              style={{
                marginTop: 12,
                padding: '10px 14px',
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 10,
                color: '#fca5a5',
                fontSize: 13,
              }}
            >
              {errorMsg}
            </div>
          )}
          <button
            type="submit"
            className="btn btn-primary btn-lg btn-block"
            style={{ marginTop: 20 }}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="spin" /> Redirecionando…
              </>
            ) : (
              <>
                <Lock size={16} /> Ir para o pagamento seguro
              </>
            )}
          </button>
          <p style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center', marginTop: 12, fontFamily: 'JetBrains Mono' }}>
            Pagamento seguro via Stripe · 7 dias de garantia · Acesso imediato
          </p>
        </form>
      </div>
    </div>
  );
};

/* ============================================================
   Post-checkout banner (?checkout=success | canceled)
   ============================================================ */
type CheckoutResult = 'success' | 'canceled' | null;

function useCheckoutResult(): [CheckoutResult, () => void] {
  const [result, setResult] = useState<CheckoutResult>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const r = params.get('checkout');
    if (r === 'success' || r === 'canceled') {
      setResult(r);
    }
  }, []);
  const dismiss = () => {
    setResult(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('checkout');
    url.searchParams.delete('purchase_id');
    window.history.replaceState({}, '', url.toString());
  };
  return [result, dismiss];
}

const CheckoutResultBanner = ({ result, onDismiss }: { result: CheckoutResult; onDismiss: () => void }) => {
  if (!result) return null;
  const isSuccess = result === 'success';
  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 60,
        maxWidth: 'calc(100% - 32px)',
        padding: '14px 20px',
        background: isSuccess
          ? 'linear-gradient(135deg, rgba(34,197,94,0.18), rgba(0,206,201,0.12))'
          : 'rgba(239,68,68,0.12)',
        border: `1px solid ${isSuccess ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.35)'}`,
        borderRadius: 12,
        color: isSuccess ? '#bbf7d0' : '#fca5a5',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        backdropFilter: 'blur(12px)',
        boxShadow: '0 12px 40px -10px rgba(0,0,0,0.6)',
      }}
    >
      {isSuccess ? <Check size={18} /> : <X size={18} />}
      <span style={{ fontSize: 14 }}>
        {isSuccess
          ? 'Pagamento confirmado! Em instantes você recebe o acesso por e-mail.'
          : 'O pagamento foi cancelado. Pode tentar novamente quando quiser.'}
      </span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Fechar"
        style={{
          width: 24,
          height: 24,
          marginLeft: 4,
          borderRadius: 6,
          background: 'rgba(255,255,255,0.08)',
          color: 'inherit',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
};

/* ============================================================
   Page wrapper
   ============================================================ */
export function CourseGeoEssencialPage() {
  const [modal, setModal] = useState(false);
  const [checkoutResult, dismissCheckoutResult] = useCheckoutResult();
  const openCheckout = () => setModal(true);
  const closeCheckout = () => setModal(false);

  // SEO / GEO — title, description, canonical, OG, Twitter, JSON-LD.
  // Course + FAQPage + BreadcrumbList give Google rich results AND give
  // ChatGPT/Claude/Gemini/Perplexity highly-extractable structured data
  // for direct citation.
  useSeo({
    title: 'GEO Essencial · Curso de Generative Engine Optimization · Ainalytics',
    description:
      'Aprenda em menos de 5 horas como ChatGPT, Claude, Gemini e Grok decidem quem citar — e o método para preparar a sua marca para disputar essas respostas. 5 módulos · 19 aulas · 7 dias de garantia.',
    canonical: `${SITE_URL}/curso-geo-essencial`,
    robots: 'index,follow',
    og: {
      type: 'product',
      title: 'GEO Essencial · Curso oficial Ainalytics',
      description:
        'Curso direto para você dominar GEO no ChatGPT, Claude, Gemini e Grok — em 30 dias de execução.',
      image: `${SITE_URL}/landing-hero.png`,
      siteName: 'Ainalytics',
      locale: 'pt_BR',
    },
    twitter: { card: 'summary_large_image' },
    jsonLd: [
      courseSchema({
        name: 'GEO Essencial',
        description:
          'Curso direto para você dominar Generative Engine Optimization (GEO) no ChatGPT, Claude, Gemini e Grok — em 30 dias de execução. 5 módulos, 19 aulas, 3h30 de vídeo, com diagnóstico, llms.txt, schemas e plano de 30 dias.',
        url: `${SITE_URL}/curso-geo-essencial`,
        imageUrl: `${SITE_URL}/landing-hero.png`,
        priceBrl: 97,
        priceUsd: 20,
        durationMinutes: 210,
        numberOfLessons: 19,
      }),
      faqPage(FAQS_PLAIN.map(f => ({ question: f.q, answer: f.a }))),
      breadcrumbList([
        { name: 'Ainalytics', url: SITE_URL },
        { name: 'GEO Essencial', url: `${SITE_URL}/curso-geo-essencial` },
      ]),
    ],
  });

  // Reveal-on-scroll
  useEffect(() => {
    const els = document.querySelectorAll('.geo-course-page .reveal');
    if (els.length === 0) return;
    const io = new IntersectionObserver(
      entries => {
        entries.forEach(e => {
          if (e.isIntersecting) e.target.classList.add('in');
        });
      },
      { threshold: 0.1 },
    );
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);

  // Lock body scroll while modal is open
  useEffect(() => {
    if (!modal) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [modal]);

  return (
    <div className="geo-course-page">
      <CheckoutResultBanner result={checkoutResult} onDismiss={dismissCheckoutResult} />
      <div className="bg-fx" />
      <div className="tarja">
        <span className="pulse" />
        🔥 Oferta de lançamento — vagas limitadas para a primeira turma
      </div>
      <nav className="nav">
        <div className="nav-inner">
          <div className="brand">
            <div className="brand-mark"><BrandMark size={30} /></div>
            <span>Ainalytics</span>
            <span
              style={{
                fontSize: 11,
                color: 'var(--text-3)',
                fontFamily: 'JetBrains Mono',
                padding: '3px 8px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                marginLeft: 8,
              }}
            >
              EDU
            </span>
          </div>
          <div className="nav-links">
            <a href="#curso">O curso</a>
            <a href="#modulos">Módulos</a>
            <a href="#stack">O que inclui</a>
            <a href="#faq">FAQ</a>
          </div>
          <button type="button" className="nav-cta" onClick={openCheckout}>
            Entrar por R$97 →
          </button>
        </div>
      </nav>
      <main>
        <HeroSection onCTA={openCheckout} />
        <PainSection />
        <PivotSection />
        <div id="curso"><CourseIntroSection onCTA={openCheckout} /></div>
        <ForWhoSection />
        <div id="modulos"><ModulesSection onCTA={openCheckout} /></div>
        <div id="stack"><StackSection onCTA={openCheckout} /></div>
        <GuaranteeSection />
        <AuthoritySection />
        <BeforeAfterSection onCTA={openCheckout} />
        <TestimonialsSection />
        <UrgencySection onCTA={openCheckout} />
        <div id="faq"><FAQSection /></div>
        <LastCallSection onCTA={openCheckout} />
      </main>
      <Footer />
      {modal && <CheckoutModal onClose={closeCheckout} />}
    </div>
  );
}
