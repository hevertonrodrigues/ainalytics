/**
 * Programmatic PDF Proposal Generator — Presentation Style
 *
 * Generates a 4:3 landscape presentation-style PDF with one concept per slide,
 * matching the minimalist, clean aesthetic of the full public proposal page.
 * Includes abstract Gemini nano-style illustrations.
 */
import { jsPDF } from 'jspdf';
import type { ProposalData } from '@/pages/proposal/proposalShared';
import { formatCurrency, formatDate } from '@/pages/proposal/proposalShared';

// ─── 4:3 slide dimensions (10" × 7.5" = 254mm × 190.5mm) ──
const SLIDE_W = 254;
const SLIDE_H = 190.5;

// ─── Color palette (using Ainalytics brand colors) ──────────
const C = {
  white:     '#FFFFFF',
  primary:   '#4f46e5',  // indigo
  secondary: '#7c3aed',  // violet
  accent:    '#6366f1',  // indigo-500
  pink:      '#fd79a8',  // brand-accent pink
  dark:      '#0f172a',  // navy
  textDark:  '#1e293b',
  textMid:   '#475569',
  textLight: '#94a3b8',
  textFaint: '#cbd5e1',
  warning:   '#d97706',
  border:    '#e2e8f0',
  bgSlide:   '#FFFFFF',
  bgSoft:    '#f8fafc',
};

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

// ─── Image loader helper ────────────────────────────────────
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

// ─── Main generator (async for image loading) ───────────────
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

  // ── Utility: add illustration to slide ──
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

  function addIllustrationDark(imgData: string | null, x: number, y: number, size: number) {
    if (!imgData) return;
    pdf.addImage(imgData, 'PNG', x, y, size, size);
  }

  // ── New slide ──
  function newSlide() {
    if (slideNum > 0) pdf.addPage();
    slideNum++;
  }

  // ── Branded footer bar ──
  function slideFooter() {
    pdf.setFillColor(...hex(C.primary));
    pdf.rect(0, SLIDE_H - 8, SLIDE_W * 0.5, 0.8, 'F');
    pdf.setFillColor(...hex(C.pink));
    pdf.rect(SLIDE_W * 0.5, SLIDE_H - 8, SLIDE_W * 0.5, 0.8, 'F');

    pdf.setFontSize(6.5);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...hex(C.textLight));
    pdf.text('AINALYTICS', ML, SLIDE_H - 4);
    pdf.text('Confidential', SLIDE_W / 2, SLIDE_H - 4, { align: 'center' });
    pdf.text(`${slideNum}`, SLIDE_W - MR, SLIDE_H - 4, { align: 'right' });
  }

  // ── Section label (small uppercase with accent line) ──
  function sectionLabel(text: string, x: number, yPos: number, color = C.primary) {
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...hex(color));
    pdf.text(text.toUpperCase(), x, yPos);
    pdf.setFillColor(...hex(color));
    pdf.rect(x, yPos + 1.5, 20, 0.6, 'F');
  }

  // ══════════════════════════════════════════════════════════
  // SLIDE 1 — TITLE / COVER
  // ══════════════════════════════════════════════════════════
  newSlide();

  // Dark background
  pdf.setFillColor(...hex(C.dark));
  pdf.rect(0, 0, SLIDE_W, SLIDE_H, 'F');

  // Gradient accent bar: indigo → pink
  pdf.setFillColor(...hex(C.primary));
  pdf.rect(0, 0, SLIDE_W * 0.6, 3, 'F');
  pdf.setFillColor(...hex(C.pink));
  pdf.rect(SLIDE_W * 0.6, 0, SLIDE_W * 0.4, 3, 'F');

  // Illustration (right side, behind text)
  addIllustrationDark(imgCover, SLIDE_W - 110, 20, 100);

  // Brand
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255);
  pdf.text('AINALYTICS', ML, MT);

  // "Prepared for"
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...hex(C.textLight));
  pdf.text(t('proposal.public.preparedFor', 'PREPARED FOR').toUpperCase(), ML, MT + 20);

  // Client name (hero)
  pdf.setTextColor(255, 255, 255);
  if (proposal.client_name) {
    pdf.setFontSize(36);
    pdf.setFont('helvetica', 'bold');
    const clientLines = pdf.splitTextToSize(proposal.client_name, CW * 0.65);
    let cy = MT + 38;
    for (const line of clientLines) {
      pdf.text(line, ML, cy);
      cy += 15;
    }
    if (proposal.company_name) {
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(...hex(C.textFaint));
      pdf.text(proposal.company_name, ML, cy + 4);
    }
  } else if (proposal.company_name) {
    pdf.setFontSize(36);
    pdf.setFont('helvetica', 'bold');
    pdf.text(proposal.company_name, ML, MT + 38);
  } else {
    pdf.setFontSize(36);
    pdf.setFont('helvetica', 'bold');
    pdf.text(proposal.custom_plan_name, ML, MT + 38);
  }

  // Divider line
  pdf.setFillColor(...hex(C.textLight));
  pdf.rect(ML, SLIDE_H - 42, 40, 0.3, 'F');

  // Plan name
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255);
  pdf.text(proposal.custom_plan_name, ML, SLIDE_H - 34);

  // Date only (validity removed from cover)
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...hex(C.textLight));
  pdf.text(formatDate(proposal.created_at, lang), ML, SLIDE_H - 28);

  // ══════════════════════════════════════════════════════════
  // SLIDE 2 — ABOUT US
  // ══════════════════════════════════════════════════════════
  newSlide();
  slideFooter();

  sectionLabel(t('proposal.full.aboutUsLabel', 'About Us'), ML, MT);

  pdf.setFontSize(22);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(...hex(C.textDark));
  pdf.text(t('proposal.full.aboutUsTitle', 'Who We Are'), ML, MT + 14);

  // Illustration (right side, softened)
  addIllustration(imgCover, SLIDE_W - 100, MT + 20, 65, 0.35);

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...hex(C.textMid));
  const aboutText = t('proposal.full.aboutUsText', '');
  const aboutLines = pdf.splitTextToSize(aboutText, CW * 0.65);
  let ay = MT + 26;
  for (const line of aboutLines.slice(0, 20)) {
    pdf.text(line, ML, ay);
    ay += 5;
  }

  // ══════════════════════════════════════════════════════════
  // SLIDE 3 — THE PROBLEM
  // ══════════════════════════════════════════════════════════
  newSlide();
  slideFooter();

  sectionLabel(t('proposal.full.problemLabel', 'The Challenge'), ML, MT, C.secondary);

  pdf.setFontSize(22);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(...hex(C.textDark));
  pdf.text(t('proposal.full.problemTitle', 'The Problem We Solve'), ML, MT + 14);

  // Illustration (right side, softened)
  addIllustration(imgProblem, SLIDE_W - 100, MT + 20, 65, 0.35);

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...hex(C.textMid));
  const probText = t('proposal.full.problemText', '');
  const probLines = pdf.splitTextToSize(probText, CW * 0.65);
  let py = MT + 26;
  for (const line of probLines.slice(0, 20)) {
    pdf.text(line, ML, py);
    py += 5;
  }

  // ══════════════════════════════════════════════════════════
  // SLIDE 4 — OUR SOLUTION
  // ══════════════════════════════════════════════════════════
  if (solutionItems.length > 0) {
    newSlide();
    slideFooter();

    sectionLabel(t('proposal.full.solutionLabel', 'Our Solution'), ML, MT, C.accent);

    pdf.setFontSize(22);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...hex(C.textDark));
    pdf.text(t('proposal.full.solutionTitle', 'How We Help'), ML, MT + 14);

    // Illustration (right side)
    addIllustration(imgSolution, SLIDE_W - 100, MT + 10, 70, 0.3);

    let sy = MT + 28;
    solutionItems.forEach((item: string, idx: number) => {
      if (sy > SLIDE_H - 22) return;
      const num = String(idx + 1).padStart(2, '0');

      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...hex(C.primary));
      pdf.text(num, ML, sy);

      pdf.setFontSize(9.5);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(...hex(C.textMid));
      const lines = pdf.splitTextToSize(item, CW * 0.6 - 16);
      lines.slice(0, 2).forEach((line: string, li: number) => {
        pdf.text(line, ML + 14, sy + li * 4.2);
      });

      sy += Math.max(9, lines.length * 4.2 + 4);
    });
  }

  // ══════════════════════════════════════════════════════════
  // SLIDE 5 — COMPETITIVE ADVANTAGES
  // ══════════════════════════════════════════════════════════
  if (advantages.length > 0) {
    newSlide();
    slideFooter();

    sectionLabel(t('proposal.full.advantagesLabel', 'Why Choose Us'), ML, MT, C.secondary);

    pdf.setFontSize(22);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...hex(C.textDark));
    pdf.text(t('proposal.full.advantagesTitle', 'Competitive Advantages'), ML, MT + 14);

    const colW = (CW - 10) / 2;
    let advY = MT + 28;
    let col = 0;

    advantages.forEach((adv: string, idx: number) => {
      if (advY > SLIDE_H - 30 && col === 0) return;
      const x = col === 0 ? ML : ML + colW + 10;

      const cardH = advantageDescs[idx] ? 22 : 14;
      pdf.setFillColor(...hex(C.bgSoft));
      pdf.setDrawColor(...hex(C.border));
      pdf.setLineWidth(0.3);
      pdf.roundedRect(x, advY, colW, cardH, 2, 2, 'FD');

      // Brand accent dot
      pdf.setFillColor(...hex(C.pink));
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
    slideFooter();

    sectionLabel(t('proposal.public.planDetails', 'Plan Details'), ML, MT);

    pdf.setFontSize(22);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...hex(C.textDark));
    const planTitle = pdf.splitTextToSize(proposal.custom_plan_name, CW);
    pdf.text(planTitle[0] || proposal.custom_plan_name, ML, MT + 14);

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...hex(C.textMid));
    const descLines = pdf.splitTextToSize(description, CW);
    let dy = MT + 28;
    for (const line of descLines.slice(0, 22)) {
      pdf.text(line, ML, dy);
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
      slideFooter();

      sectionLabel(t('proposal.public.whatsIncluded', "What's Included"), ML, MT, C.accent);

      pdf.setFontSize(22);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...hex(C.textDark));
      pdf.text(
        page === 0
          ? t('proposal.features', 'Features')
          : `${t('proposal.features', 'Features')} (${page + 1})`,
        ML, MT + 14,
      );

      // Illustration on first features page only
      if (page === 0) {
        addIllustration(imgFeatures, SLIDE_W - 85, SLIDE_H - 90, 60, 0.3);
      }

      const chunk = features.slice(page * perSlide, (page + 1) * perSlide);
      const colW = (CW - 10) / 2;

      chunk.forEach((feat: string, idx: number) => {
        const isLeft = idx % 2 === 0;
        const x = isLeft ? ML : ML + colW + 10;
        const row = Math.floor(idx / 2);
        const fy = MT + 28 + row * 13;

        pdf.setFillColor(...hex(C.bgSoft));
        pdf.setDrawColor(...hex(C.border));
        pdf.setLineWidth(0.2);
        pdf.roundedRect(x, fy, colW, 10, 2, 2, 'FD');

        pdf.setFillColor(...hex(C.primary));
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
  // PRICING SLIDE (dark)
  // ══════════════════════════════════════════════════════════
  newSlide();

  pdf.setFillColor(...hex(C.dark));
  pdf.rect(0, 0, SLIDE_W, SLIDE_H, 'F');

  // Gradient bar: indigo → pink
  pdf.setFillColor(...hex(C.primary));
  pdf.rect(0, 0, SLIDE_W * 0.5, 3, 'F');
  pdf.setFillColor(...hex(C.pink));
  pdf.rect(SLIDE_W * 0.5, 0, SLIDE_W * 0.5, 3, 'F');

  // Investment label
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...hex(C.textLight));
  pdf.text(t('proposal.public.investment', 'INVESTMENT').toUpperCase(), SLIDE_W / 2, MT + 10, { align: 'center' });

  // Interval label
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...hex(C.textFaint));
  const intervalLabel = proposal.billing_interval === 'monthly'
    ? t('proposal.public.monthlyInvestment', 'Monthly Investment')
    : t('proposal.public.yearlyInvestment', 'Yearly Investment');
  pdf.text(intervalLabel, SLIDE_W / 2, MT + 24, { align: 'center' });

  // PRICE
  const priceStr = formatCurrency(proposal.custom_price, proposal.currency);
  pdf.setFontSize(52);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255);
  pdf.text(priceStr, SLIDE_W / 2, SLIDE_H / 2 + 6, { align: 'center' });

  // Billing note
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...hex(C.textLight));
  const billedLabel = proposal.billing_interval === 'monthly'
    ? t('proposal.public.billedMonthly', 'Billed monthly')
    : t('proposal.public.billedYearly', 'Billed yearly');
  pdf.text(billedLabel, SLIDE_W / 2, SLIDE_H / 2 + 18, { align: 'center' });

  // Savings pill
  if (proposal.base_plan && proposal.base_plan.price > proposal.custom_price) {
    const savings = formatCurrency(proposal.base_plan.price - proposal.custom_price, proposal.currency);
    const savingsText = `${t('proposal.public.savings', 'You save')} ${savings} vs. ${proposal.base_plan.name}`;
    const sw = pdf.setFontSize(9).getTextWidth(savingsText) + 12;
    const sx = (SLIDE_W - sw) / 2;
    pdf.setFillColor(...hex(lighten(C.pink, 0.15)));
    pdf.roundedRect(sx, SLIDE_H / 2 + 24, sw, 8, 3, 3, 'F');
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(255, 255, 255);
    pdf.text(savingsText, SLIDE_W / 2, SLIDE_H / 2 + 30, { align: 'center' });
  }

  // Validity — shown ONLY here, in brand pink
  if (proposal.valid_until) {
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...hex(C.pink));
    pdf.text(
      `${t('proposal.public.validUntilLabel', 'Valid until:')} ${formatDate(proposal.valid_until, lang)}`,
      SLIDE_W / 2, SLIDE_H - 20, { align: 'center' },
    );
  }

  // Dark slide footer
  pdf.setFillColor(...hex(C.primary));
  pdf.rect(0, SLIDE_H - 8, SLIDE_W * 0.5, 0.8, 'F');
  pdf.setFillColor(...hex(C.pink));
  pdf.rect(SLIDE_W * 0.5, SLIDE_H - 8, SLIDE_W * 0.5, 0.8, 'F');
  pdf.setFontSize(6.5);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...hex(C.textLight));
  pdf.text('AINALYTICS', ML, SLIDE_H - 4);
  pdf.text('Confidential', SLIDE_W / 2, SLIDE_H - 4, { align: 'center' });
  pdf.text(`${slideNum}`, SLIDE_W - MR, SLIDE_H - 4, { align: 'right' });

  // ══════════════════════════════════════════════════════════
  // NEXT STEPS SLIDE (brand accent, not green)
  // ══════════════════════════════════════════════════════════
  newSlide();
  slideFooter();

  sectionLabel(t('proposal.full.nextStepsLabel', 'Next Steps'), ML, MT, C.pink);

  pdf.setFontSize(22);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(...hex(C.textDark));
  pdf.text(t('proposal.full.nextStepsTitle', 'Ready to Get Started?'), ML, MT + 14);

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...hex(C.textMid));
  const ctaText = t('proposal.public.ctaText', 'Accept this proposal to begin your journey with Ainalytics.');
  const ctaLines = pdf.splitTextToSize(ctaText, CW * 0.7);
  let ctaY = MT + 28;
  for (const line of ctaLines) {
    pdf.text(line, ML, ctaY);
    ctaY += 5;
  }

  // ══════════════════════════════════════════════════════════
  // THANK YOU SLIDE (dark closing)
  // ══════════════════════════════════════════════════════════
  newSlide();

  pdf.setFillColor(...hex(C.dark));
  pdf.rect(0, 0, SLIDE_W, SLIDE_H, 'F');

  // Gradient bar
  pdf.setFillColor(...hex(C.primary));
  pdf.rect(0, 0, SLIDE_W * 0.5, 3, 'F');
  pdf.setFillColor(...hex(C.pink));
  pdf.rect(SLIDE_W * 0.5, 0, SLIDE_W * 0.5, 3, 'F');

  // Illustration (centered, behind text)
  addIllustrationDark(imgThankYou, (SLIDE_W - 80) / 2, (SLIDE_H - 80) / 2 - 10, 80);

  // Thank you
  pdf.setFontSize(36);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255);
  pdf.text(t('proposal.full.thankYou', 'Thank you.'), SLIDE_W / 2, SLIDE_H / 2 - 8, { align: 'center' });

  // Subtitle (client/company)
  pdf.setFontSize(13);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...hex(C.textLight));
  pdf.text(
    proposal.client_name
      ? `${proposal.client_name}${proposal.company_name ? ` — ${proposal.company_name}` : ''}`
      : proposal.company_name || proposal.custom_plan_name,
    SLIDE_W / 2, SLIDE_H / 2 + 8, { align: 'center' },
  );

  // Brand at bottom
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(...hex(C.accent));
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
    SLIDE_W / 2, SLIDE_H - 8, { align: 'center' },
  );

  return pdf.output('blob');
}
