/**
 * Programmatic PDF Proposal Generator — Presentation Style
 *
 * Generates a 4:3 landscape presentation-style PDF with one concept per slide.
 * All slides have white backgrounds with gradient accent decorations.
 * Uses brand gradient: indigo (#4f46e5) → violet (#7c3aed) → pink (#fd79a8).
 */
import { jsPDF } from 'jspdf';
import type { ProposalData } from '@/pages/proposal/proposalShared';
import { formatCurrency, formatDate } from '@/pages/proposal/proposalShared';

// ─── 4:3 slide dimensions (10" × 7.5") ─────────────────────
const SLIDE_W = 254;
const SLIDE_H = 190.5;

// ─── Brand gradient palette ────────────────────────────────
const C = {
  white:     '#FFFFFF',
  primary:   '#4f46e5',  // indigo
  secondary: '#7c3aed',  // violet
  accent:    '#6366f1',  // indigo-500
  pink:      '#fd79a8',  // brand-accent pink
  dark:      '#0f172a',
  textDark:  '#1e293b',
  textMid:   '#475569',
  textLight: '#94a3b8',
  textFaint: '#cbd5e1',
  warning:   '#d97706',
  border:    '#e2e8f0',
  bgSoft:    '#f8fafc',
};

// Gradient steps from primary → secondary → pink
const GRADIENT_STEPS = [
  '#4f46e5', '#5a44e7', '#6542e9', '#7040eb',
  '#7c3aed', '#8a3de5', '#9840dd', '#a643d5',
  '#b446cd', '#c24ac0', '#d04db3', '#dd51a6',
  '#eb5999', '#f4618d', '#fd79a8',
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TFunc = any;

// ─── Helpers ────────────────────────────────────────────────
function hex(c: string): [number, number, number] {
  const h = c.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

function lighten(color: string, amount: number): string {
  const [r, g, b] = hex(color);
  return '#' + [r, g, b].map(ch =>
    Math.min(255, Math.round(ch + (255 - ch) * amount)).toString(16).padStart(2, '0'),
  ).join('');
}

// ─── Image loader ───────────────────────────────────────────
async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// ─── Main generator ─────────────────────────────────────────
export async function generateProposalPdf(
  proposal: ProposalData,
  t: TFunc,
  lang: string,
): Promise<Blob> {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [SLIDE_H, SLIDE_W] });

  const ML = 30;
  const MR = 30;
  const MT = 28;
  const CW = SLIDE_W - ML - MR;
  let slideNum = 0;

  const defaultLang = proposal.default_lang || 'en';
  const features = proposal.custom_features[defaultLang] || proposal.custom_features['en'] || [];
  const description = proposal.custom_description[defaultLang] || proposal.custom_description['en'] || '';
  const solutionItems: string[] = (t('proposal.full.solutionItems', { returnObjects: true }) as string[]) || [];
  const advantages: string[] = (t('proposal.full.advantages', { returnObjects: true }) as string[]) || [];
  const advantageDescs: string[] = (t('proposal.full.advantageDescs', { returnObjects: true }) as string[]) || [];

  // Load illustrations
  const [imgCover, imgProblem, imgSolution, imgFeatures, imgThankYou] = await Promise.all([
    loadImageAsBase64('/images/proposal/cover.png'),
    loadImageAsBase64('/images/proposal/problem.png'),
    loadImageAsBase64('/images/proposal/solution.png'),
    loadImageAsBase64('/images/proposal/features.png'),
    loadImageAsBase64('/images/proposal/thankyou.png'),
  ]);

  // ── Decorative: gradient bar (simulated via multi-step rects) ──
  function drawGradientBar(x: number, y: number, w: number, h: number) {
    const stepW = w / GRADIENT_STEPS.length;
    GRADIENT_STEPS.forEach((color, i) => {
      pdf.setFillColor(...hex(color));
      pdf.rect(x + i * stepW, y, stepW + 0.3, h, 'F'); // +0.3 to avoid gaps
    });
  }

  // ── Decorative: left accent column (vertical gradient strip) ──
  function drawLeftAccent() {
    const stripW = 4;
    const steps = GRADIENT_STEPS.length;
    const stepH = SLIDE_H / steps;
    GRADIENT_STEPS.forEach((color, i) => {
      pdf.setFillColor(...hex(lighten(color, 0.7)));
      pdf.rect(0, i * stepH, stripW, stepH + 0.3, 'F');
    });
  }

  // ── Decorative: bottom-right corner accent ──
  function drawCornerAccent() {
    // Small gradient circle pattern in bottom-right
    const cx = SLIDE_W - 20;
    const cy = SLIDE_H - 22;
    [0, 1, 2].forEach(i => {
      pdf.setFillColor(...hex(lighten(GRADIENT_STEPS[i * 5] || C.primary, 0.75)));
      pdf.circle(cx - i * 8, cy, 3 - i * 0.5, 'F');
    });
  }

  // ── Utility: add illustration ──
  function addIllustration(imgData: string | null, x: number, y: number, size: number, opacity = 0.6) {
    if (!imgData) return;
    pdf.addImage(imgData, 'PNG', x, y, size, size);
    if (opacity < 1) {
      pdf.setGState(pdf.GState({ opacity: 1 - opacity }));
      pdf.setFillColor(255, 255, 255);
      pdf.rect(x, y, size, size, 'F');
      pdf.setGState(pdf.GState({ opacity: 1 }));
    }
  }

  // ── New slide ──
  function newSlide() {
    if (slideNum > 0) pdf.addPage();
    slideNum++;
  }

  // ── Branded footer ──
  function slideFooter() {
    // Gradient bar above footer
    drawGradientBar(0, SLIDE_H - 8, SLIDE_W, 1.2);

    pdf.setFontSize(6.5);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...hex(C.textLight));
    pdf.text('AINALYTICS', ML, SLIDE_H - 3.5);
    pdf.text('Confidential', SLIDE_W / 2, SLIDE_H - 3.5, { align: 'center' });
    pdf.text(`${slideNum}`, SLIDE_W - MR, SLIDE_H - 3.5, { align: 'right' });
  }

  // ── Section label ──
  function sectionLabel(text: string, x: number, yPos: number, color = C.primary) {
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...hex(color));
    pdf.text(text.toUpperCase(), x, yPos);
    // Gradient accent underline (mini)
    const lineW = 24;
    const steps = 6;
    const stepW = lineW / steps;
    for (let i = 0; i < steps; i++) {
      const gradIdx = Math.round((i / (steps - 1)) * (GRADIENT_STEPS.length - 1));
      pdf.setFillColor(...hex(GRADIENT_STEPS[gradIdx]!));
      pdf.rect(x + i * stepW, yPos + 1.5, stepW + 0.2, 0.8, 'F');
    }
  }

  // ══════════════════════════════════════════════════════════
  // SLIDE 1 — COVER (white background)
  // ══════════════════════════════════════════════════════════
  newSlide();

  // Top gradient bar (thick, prominent)
  drawGradientBar(0, 0, SLIDE_W, 5);

  // Left accent column
  drawLeftAccent();

  // Illustration (right side)
  addIllustration(imgCover, SLIDE_W - 115, 25, 90, 0.5);

  // Brand
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(...hex(C.primary));
  pdf.text('AINALYTICS', ML + 8, MT - 6);

  // "Prepared for"
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...hex(C.textLight));
  pdf.text(t('proposal.public.preparedFor', 'PREPARED FOR').toUpperCase(), ML + 8, MT + 16);

  // Client name
  pdf.setTextColor(...hex(C.textDark));
  if (proposal.client_name) {
    pdf.setFontSize(36);
    pdf.setFont('helvetica', 'bold');
    const clientLines = pdf.splitTextToSize(proposal.client_name, CW * 0.55);
    let cy = MT + 34;
    for (const line of clientLines) {
      pdf.text(line, ML + 8, cy);
      cy += 15;
    }
    if (proposal.company_name) {
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(...hex(C.textMid));
      pdf.text(proposal.company_name, ML + 8, cy + 4);
    }
  } else if (proposal.company_name) {
    pdf.setFontSize(36);
    pdf.setFont('helvetica', 'bold');
    pdf.text(proposal.company_name, ML + 8, MT + 34);
  } else {
    pdf.setFontSize(36);
    pdf.setFont('helvetica', 'bold');
    pdf.text(proposal.custom_plan_name, ML + 8, MT + 34);
  }

  // Bottom area: plan name + date
  // Small gradient divider
  drawGradientBar(ML + 8, SLIDE_H - 42, 50, 0.8);

  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(...hex(C.textDark));
  pdf.text(proposal.custom_plan_name, ML + 8, SLIDE_H - 34);

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...hex(C.textLight));
  pdf.text(formatDate(proposal.created_at, lang), ML + 8, SLIDE_H - 28);

  // Bottom gradient bar
  drawGradientBar(0, SLIDE_H - 8, SLIDE_W, 1.2);

  // Corner accent dots
  drawCornerAccent();

  // ══════════════════════════════════════════════════════════
  // SLIDE 2 — ABOUT US
  // ══════════════════════════════════════════════════════════
  newSlide();
  drawLeftAccent();
  slideFooter();
  drawCornerAccent();

  sectionLabel(t('proposal.full.aboutUsLabel', 'About Us'), ML + 8, MT);

  pdf.setFontSize(22);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(...hex(C.textDark));
  pdf.text(t('proposal.full.aboutUsTitle', 'Who We Are'), ML + 8, MT + 14);

  addIllustration(imgCover, SLIDE_W - 100, MT + 16, 65, 0.4);

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...hex(C.textMid));
  const aboutLines = pdf.splitTextToSize(t('proposal.full.aboutUsText', ''), CW * 0.6);
  let ay = MT + 26;
  for (const line of aboutLines.slice(0, 20)) {
    pdf.text(line, ML + 8, ay);
    ay += 5;
  }

  // ══════════════════════════════════════════════════════════
  // SLIDE 3 — THE PROBLEM
  // ══════════════════════════════════════════════════════════
  newSlide();
  drawLeftAccent();
  slideFooter();
  drawCornerAccent();

  sectionLabel(t('proposal.full.problemLabel', 'The Challenge'), ML + 8, MT, C.secondary);

  pdf.setFontSize(22);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(...hex(C.textDark));
  pdf.text(t('proposal.full.problemTitle', 'The Problem We Solve'), ML + 8, MT + 14);

  addIllustration(imgProblem, SLIDE_W - 100, MT + 16, 65, 0.4);

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...hex(C.textMid));
  const probLines = pdf.splitTextToSize(t('proposal.full.problemText', ''), CW * 0.6);
  let py = MT + 26;
  for (const line of probLines.slice(0, 20)) {
    pdf.text(line, ML + 8, py);
    py += 5;
  }

  // ══════════════════════════════════════════════════════════
  // SLIDE 4 — OUR SOLUTION
  // ══════════════════════════════════════════════════════════
  if (solutionItems.length > 0) {
    newSlide();
    drawLeftAccent();
    slideFooter();
    drawCornerAccent();

    sectionLabel(t('proposal.full.solutionLabel', 'Our Solution'), ML + 8, MT, C.accent);

    pdf.setFontSize(22);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...hex(C.textDark));
    pdf.text(t('proposal.full.solutionTitle', 'How We Help'), ML + 8, MT + 14);

    addIllustration(imgSolution, SLIDE_W - 100, MT + 10, 70, 0.35);

    let sy = MT + 28;
    solutionItems.forEach((item: string, idx: number) => {
      if (sy > SLIDE_H - 22) return;
      const num = String(idx + 1).padStart(2, '0');

      // Gradient-colored number
      const gradIdx = Math.round((idx / Math.max(solutionItems.length - 1, 1)) * (GRADIENT_STEPS.length - 1));
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...hex(GRADIENT_STEPS[gradIdx]!));
      pdf.text(num, ML + 8, sy);

      pdf.setFontSize(9.5);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(...hex(C.textMid));
      const lines = pdf.splitTextToSize(item, CW * 0.55 - 16);
      lines.slice(0, 2).forEach((line: string, li: number) => {
        pdf.text(line, ML + 22, sy + li * 4.2);
      });

      sy += Math.max(9, lines.length * 4.2 + 4);
    });
  }

  // ══════════════════════════════════════════════════════════
  // SLIDE 5 — COMPETITIVE ADVANTAGES
  // ══════════════════════════════════════════════════════════
  if (advantages.length > 0) {
    newSlide();
    drawLeftAccent();
    slideFooter();
    drawCornerAccent();

    sectionLabel(t('proposal.full.advantagesLabel', 'Why Choose Us'), ML + 8, MT, C.secondary);

    pdf.setFontSize(22);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...hex(C.textDark));
    pdf.text(t('proposal.full.advantagesTitle', 'Competitive Advantages'), ML + 8, MT + 14);

    const colW = (CW - 16) / 2;
    let advY = MT + 28;
    let col = 0;

    advantages.forEach((adv: string, idx: number) => {
      if (advY > SLIDE_H - 30 && col === 0) return;
      const x = col === 0 ? ML + 8 : ML + 8 + colW + 8;

      const cardH = advantageDescs[idx] ? 22 : 14;
      pdf.setFillColor(...hex(C.bgSoft));
      pdf.setDrawColor(...hex(C.border));
      pdf.setLineWidth(0.3);
      pdf.roundedRect(x, advY, colW, cardH, 2, 2, 'FD');

      // Gradient dot
      const gradIdx = Math.round((idx / Math.max(advantages.length - 1, 1)) * (GRADIENT_STEPS.length - 1));
      pdf.setFillColor(...hex(GRADIENT_STEPS[gradIdx]!));
      pdf.circle(x + 5, advY + 6, 1.2, 'F');

      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...hex(C.textDark));
      const titleLines = pdf.splitTextToSize(adv, colW - 14);
      pdf.text(titleLines[0] || '', x + 10, advY + 7);

      if (advantageDescs[idx]) {
        pdf.setFontSize(7.5);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(...hex(C.textMid));
        const descLines = pdf.splitTextToSize(advantageDescs[idx], colW - 14);
        descLines.slice(0, 2).forEach((line: string, li: number) => {
          pdf.text(line, x + 10, advY + 13 + li * 3.5);
        });
      }

      if (col === 1) {
        advY += cardH + 5;
        col = 0;
      } else {
        col = 1;
      }
    });
  }

  // ══════════════════════════════════════════════════════════
  // SLIDE 6 — PLAN DETAILS
  // ══════════════════════════════════════════════════════════
  if (description) {
    newSlide();
    drawLeftAccent();
    slideFooter();
    drawCornerAccent();

    sectionLabel(t('proposal.public.planDetails', 'Plan Details'), ML + 8, MT);

    pdf.setFontSize(22);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...hex(C.textDark));
    const planTitle = pdf.splitTextToSize(proposal.custom_plan_name, CW);
    pdf.text(planTitle[0] || proposal.custom_plan_name, ML + 8, MT + 14);

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...hex(C.textMid));
    const descLines = pdf.splitTextToSize(description, CW - 8);
    let dy = MT + 28;
    for (const line of descLines.slice(0, 22)) {
      pdf.text(line, ML + 8, dy);
      dy += 5;
    }
  }

  // ══════════════════════════════════════════════════════════
  // SLIDE 7+ — FEATURES
  // ══════════════════════════════════════════════════════════
  if (features.length > 0) {
    const perSlide = 10;
    for (let page = 0; page < Math.ceil(features.length / perSlide); page++) {
      newSlide();
      drawLeftAccent();
      slideFooter();
      drawCornerAccent();

      sectionLabel(t('proposal.public.whatsIncluded', "What's Included"), ML + 8, MT, C.accent);

      pdf.setFontSize(22);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...hex(C.textDark));
      pdf.text(
        page === 0
          ? t('proposal.features', 'Features')
          : `${t('proposal.features', 'Features')} (${page + 1})`,
        ML + 8, MT + 14,
      );

      if (page === 0) {
        addIllustration(imgFeatures, SLIDE_W - 85, SLIDE_H - 85, 55, 0.35);
      }

      const chunk = features.slice(page * perSlide, (page + 1) * perSlide);
      const colW = (CW - 16) / 2;

      chunk.forEach((feat: string, idx: number) => {
        const isLeft = idx % 2 === 0;
        const x = isLeft ? ML + 8 : ML + 8 + colW + 8;
        const row = Math.floor(idx / 2);
        const fy = MT + 28 + row * 13;

        pdf.setFillColor(...hex(C.bgSoft));
        pdf.setDrawColor(...hex(C.border));
        pdf.setLineWidth(0.2);
        pdf.roundedRect(x, fy, colW, 10, 2, 2, 'FD');

        // Gradient dot per feature
        const gradIdx = Math.round((idx / Math.max(chunk.length - 1, 1)) * (GRADIENT_STEPS.length - 1));
        pdf.setFillColor(...hex(GRADIENT_STEPS[gradIdx]!));
        pdf.circle(x + 4, fy + 5, 1, 'F');

        pdf.setFontSize(8.5);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(...hex(C.textDark));
        const fLines = pdf.splitTextToSize(feat, colW - 12);
        pdf.text(fLines[0] || '', x + 8, fy + 5.5);
        if (fLines[1]) {
          pdf.setFontSize(7);
          pdf.text(fLines[1], x + 8, fy + 9);
        }
      });
    }
  }

  // ══════════════════════════════════════════════════════════
  // PRICING SLIDE (white background with gradient accents)
  // ══════════════════════════════════════════════════════════
  newSlide();

  // Top gradient bar (thick)
  drawGradientBar(0, 0, SLIDE_W, 5);

  // Left accent column
  drawLeftAccent();

  // Right accent column (mirror)
  const stripW = 4;
  GRADIENT_STEPS.forEach((color, i) => {
    pdf.setFillColor(...hex(lighten(color, 0.7)));
    pdf.rect(SLIDE_W - stripW, i * (SLIDE_H / GRADIENT_STEPS.length), stripW, SLIDE_H / GRADIENT_STEPS.length + 0.3, 'F');
  });

  slideFooter();

  // Investment label
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...hex(C.textLight));
  pdf.text(t('proposal.public.investment', 'INVESTMENT').toUpperCase(), SLIDE_W / 2, MT + 8, { align: 'center' });

  // Interval label
  pdf.setFontSize(13);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...hex(C.textMid));
  const intervalLabel = proposal.billing_interval === 'monthly'
    ? t('proposal.public.monthlyInvestment', 'Monthly Investment')
    : t('proposal.public.yearlyInvestment', 'Yearly Investment');
  pdf.text(intervalLabel, SLIDE_W / 2, MT + 20, { align: 'center' });

  // Gradient divider above price
  drawGradientBar((SLIDE_W - 80) / 2, MT + 28, 80, 1);

  // PRICE (large centered)
  const priceStr = formatCurrency(proposal.custom_price, proposal.currency);
  pdf.setFontSize(52);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(...hex(C.primary));
  pdf.text(priceStr, SLIDE_W / 2, SLIDE_H / 2 + 8, { align: 'center' });

  // Billing note
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...hex(C.textMid));
  const billedLabel = proposal.billing_interval === 'monthly'
    ? t('proposal.public.billedMonthly', 'Billed monthly')
    : t('proposal.public.billedYearly', 'Billed yearly');
  pdf.text(billedLabel, SLIDE_W / 2, SLIDE_H / 2 + 20, { align: 'center' });

  // Savings pill
  if (proposal.base_plan && proposal.base_plan.price > proposal.custom_price) {
    const savings = formatCurrency(proposal.base_plan.price - proposal.custom_price, proposal.currency);
    const savingsText = `${t('proposal.public.savings', 'You save')} ${savings} vs. ${proposal.base_plan.name}`;
    const sw = pdf.setFontSize(9).getTextWidth(savingsText) + 14;
    const sx = (SLIDE_W - sw) / 2;
    // Gradient pill background
    const pillSteps = 8;
    const pillStepW = sw / pillSteps;
    for (let i = 0; i < pillSteps; i++) {
      const gradIdx = Math.round((i / (pillSteps - 1)) * (GRADIENT_STEPS.length - 1));
      pdf.setFillColor(...hex(GRADIENT_STEPS[gradIdx]!));
      if (i === 0) {
        pdf.roundedRect(sx + i * pillStepW, SLIDE_H / 2 + 26, pillStepW + 0.3, 8, 3, 0, 'F');
      } else if (i === pillSteps - 1) {
        pdf.roundedRect(sx + i * pillStepW, SLIDE_H / 2 + 26, pillStepW + 0.3, 8, 0, 3, 'F');
      } else {
        pdf.rect(sx + i * pillStepW, SLIDE_H / 2 + 26, pillStepW + 0.3, 8, 'F');
      }
    }
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(255, 255, 255);
    pdf.text(savingsText, SLIDE_W / 2, SLIDE_H / 2 + 32, { align: 'center' });
  }

  // Validity in brand pink — ONLY here
  if (proposal.valid_until) {
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...hex(C.pink));
    pdf.text(
      `${t('proposal.public.validUntilLabel', 'Valid until:')} ${formatDate(proposal.valid_until, lang)}`,
      SLIDE_W / 2, SLIDE_H - 18, { align: 'center' },
    );
  }

  // ══════════════════════════════════════════════════════════
  // NEXT STEPS SLIDE
  // ══════════════════════════════════════════════════════════
  newSlide();
  drawLeftAccent();
  slideFooter();
  drawCornerAccent();

  sectionLabel(t('proposal.full.nextStepsLabel', 'Next Steps'), ML + 8, MT, C.pink);

  pdf.setFontSize(22);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(...hex(C.textDark));
  pdf.text(t('proposal.full.nextStepsTitle', 'Ready to Get Started?'), ML + 8, MT + 14);

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...hex(C.textMid));
  const ctaLines = pdf.splitTextToSize(
    t('proposal.public.ctaText', 'Accept this proposal to begin your journey with Ainalytics.'),
    CW * 0.7,
  );
  let ctaY = MT + 28;
  for (const line of ctaLines) {
    pdf.text(line, ML + 8, ctaY);
    ctaY += 5;
  }

  // ══════════════════════════════════════════════════════════
  // THANK YOU SLIDE (white)
  // ══════════════════════════════════════════════════════════
  newSlide();

  // Top gradient bar (thick)
  drawGradientBar(0, 0, SLIDE_W, 5);
  drawLeftAccent();

  // Right accent column  
  GRADIENT_STEPS.forEach((color, i) => {
    pdf.setFillColor(...hex(lighten(color, 0.7)));
    pdf.rect(SLIDE_W - stripW, i * (SLIDE_H / GRADIENT_STEPS.length), stripW, SLIDE_H / GRADIENT_STEPS.length + 0.3, 'F');
  });

  // Illustration (centered)
  addIllustration(imgThankYou, (SLIDE_W - 70) / 2, 20, 70, 0.5);

  // Thank you
  pdf.setFontSize(36);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(...hex(C.textDark));
  pdf.text(t('proposal.full.thankYou', 'Thank you.'), SLIDE_W / 2, SLIDE_H / 2 + 20, { align: 'center' });

  // Gradient divider
  drawGradientBar((SLIDE_W - 60) / 2, SLIDE_H / 2 + 25, 60, 1);

  // Client / company
  pdf.setFontSize(13);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...hex(C.textMid));
  pdf.text(
    proposal.client_name
      ? `${proposal.client_name}${proposal.company_name ? ` — ${proposal.company_name}` : ''}`
      : proposal.company_name || proposal.custom_plan_name,
    SLIDE_W / 2, SLIDE_H / 2 + 36, { align: 'center' },
  );

  // Brand
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(...hex(C.primary));
  pdf.text('AINALYTICS', SLIDE_W / 2, SLIDE_H - 22, { align: 'center' });

  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...hex(C.textLight));
  pdf.text('ainalytics.com', SLIDE_W / 2, SLIDE_H - 16, { align: 'center' });

  // Confidentiality
  pdf.setFontSize(6);
  pdf.setTextColor(...hex(C.textLight));
  pdf.text(
    t('proposal.public.footerNote', 'This proposal is confidential and intended solely for the named recipient.'),
    SLIDE_W / 2, SLIDE_H - 10, { align: 'center' },
  );

  // Bottom gradient bar
  drawGradientBar(0, SLIDE_H - 5, SLIDE_W, 1.2);

  return pdf.output('blob');
}
