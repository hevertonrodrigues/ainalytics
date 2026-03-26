/**
 * Programmatic PDF Proposal Generator — Presentation Style
 *
 * Generates a 4:3 landscape presentation-style PDF with one concept per slide,
 * matching the minimalist, clean aesthetic of the full public proposal page.
 */
import { jsPDF } from 'jspdf';
import type { ProposalData } from '@/pages/proposal/proposalShared';
import { formatCurrency, formatDate } from '@/pages/proposal/proposalShared';

// ─── 4:3 slide dimensions (10" × 7.5" = 254mm × 190.5mm) ──
const SLIDE_W = 254;
const SLIDE_H = 190.5;

// ─── Color palette ──────────────────────────────────────────
const C = {
  white:     '#FFFFFF',
  primary:   '#4f46e5',
  secondary: '#7c3aed',
  accent:    '#6366f1',
  dark:      '#0f172a',
  textDark:  '#1e293b',
  textMid:   '#475569',
  textLight: '#94a3b8',
  textFaint: '#cbd5e1',
  success:   '#059669',
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

// ─── Main generator ─────────────────────────────────────────
export function generateProposalPdf(
  proposal: ProposalData,
  t: TFunc,
  lang: string,
): Blob {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [SLIDE_H, SLIDE_W] });

  const ML = 30; // margin left
  const MR = 30;
  const MT = 28; // margin top
  const CW = SLIDE_W - ML - MR; // content width
  let slideNum = 0;

  const defaultLang = proposal.default_lang || 'en';
  const features = proposal.custom_features[defaultLang] || proposal.custom_features['en'] || [];
  const description = proposal.custom_description[defaultLang] || proposal.custom_description['en'] || '';
  const solutionItems: string[] = (t('proposal.full.solutionItems', { returnObjects: true }) as string[]) || [];
  const advantages: string[] = (t('proposal.full.advantages', { returnObjects: true }) as string[]) || [];
  const advantageDescs: string[] = (t('proposal.full.advantageDescs', { returnObjects: true }) as string[]) || [];

  // ── New slide ──
  function newSlide() {
    if (slideNum > 0) pdf.addPage();
    slideNum++;
  }

  // ── Branded footer bar on every slide ──
  function slideFooter() {
    // Thin gradient line
    pdf.setFillColor(...hex(C.primary));
    pdf.rect(0, SLIDE_H - 8, SLIDE_W * 0.6, 0.8, 'F');
    pdf.setFillColor(...hex(C.secondary));
    pdf.rect(SLIDE_W * 0.6, SLIDE_H - 8, SLIDE_W * 0.4, 0.8, 'F');

    // Brand + page number
    pdf.setFontSize(6.5);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...hex(C.textLight));
    pdf.text('AINALYTICS', ML, SLIDE_H - 4);
    pdf.text('Confidential', SLIDE_W / 2, SLIDE_H - 4, { align: 'center' });
    pdf.text(`${slideNum}`, SLIDE_W - MR, SLIDE_H - 4, { align: 'right' });
  }

  // ── Section label (small uppercase) ──
  function sectionLabel(text: string, x: number, yPos: number, color = C.primary) {
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...hex(color));
    pdf.text(text.toUpperCase(), x, yPos);
    // Underline accent
    pdf.setFillColor(...hex(color));
    pdf.rect(x, yPos + 1.5, 20, 0.6, 'F');
  }

  // ══════════════════════════════════════════════════════════
  // SLIDE 1 — TITLE / COVER
  // ══════════════════════════════════════════════════════════
  newSlide();

  // Full-slide dark background
  pdf.setFillColor(...hex(C.dark));
  pdf.rect(0, 0, SLIDE_W, SLIDE_H, 'F');

  // Accent bar at top
  pdf.setFillColor(...hex(C.primary));
  pdf.rect(0, 0, SLIDE_W, 3, 'F');

  // Brand
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255);
  pdf.text('AINALYTICS', ML, MT);

  // "Prepared for" label
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...hex(C.textLight));
  pdf.text(t('proposal.public.preparedFor', 'PREPARED FOR').toUpperCase(), ML, MT + 20);

  // Client name (hero)
  pdf.setTextColor(255, 255, 255);
  if (proposal.client_name) {
    pdf.setFontSize(36);
    pdf.setFont('helvetica', 'bold');
    const clientLines = pdf.splitTextToSize(proposal.client_name, CW);
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
  pdf.rect(ML, SLIDE_H - 48, 40, 0.3, 'F');

  // Plan name
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255);
  pdf.text(proposal.custom_plan_name, ML, SLIDE_H - 38);

  // Date
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...hex(C.textLight));
  pdf.text(formatDate(proposal.created_at, lang), ML, SLIDE_H - 32);

  if (proposal.valid_until) {
    pdf.setTextColor(...hex(C.warning));
    pdf.text(
      `${t('proposal.public.validUntilLabel', 'Valid until:')} ${formatDate(proposal.valid_until, lang)}`,
      ML, SLIDE_H - 26,
    );
  }

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

  // Body text
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...hex(C.textMid));
  const aboutText = t('proposal.full.aboutUsText', '');
  const aboutLines = pdf.splitTextToSize(aboutText, CW);
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

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...hex(C.textMid));
  const probText = t('proposal.full.problemText', '');
  const probLines = pdf.splitTextToSize(probText, CW);
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

    let sy = MT + 28;
    solutionItems.forEach((item: string, idx: number) => {
      if (sy > SLIDE_H - 22) return; // safety
      const num = String(idx + 1).padStart(2, '0');

      // Number
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...hex(C.primary));
      pdf.text(num, ML, sy);

      // Text
      pdf.setFontSize(9.5);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(...hex(C.textMid));
      const lines = pdf.splitTextToSize(item, CW - 16);
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

    // Two-column card grid
    const colW = (CW - 10) / 2;
    let advY = MT + 28;
    let col = 0;

    advantages.forEach((adv: string, idx: number) => {
      if (advY > SLIDE_H - 30 && col === 0) return; // safety
      const x = col === 0 ? ML : ML + colW + 10;

      // Card
      const cardH = advantageDescs[idx] ? 22 : 14;
      pdf.setFillColor(...hex(C.bgSoft));
      pdf.setDrawColor(...hex(C.border));
      pdf.setLineWidth(0.3);
      pdf.roundedRect(x, advY, colW, cardH, 2, 2, 'FD');

      // Accent dot
      pdf.setFillColor(...hex(C.primary));
      pdf.circle(x + 5, advY + 6, 1.2, 'F');

      // Title
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...hex(C.textDark));
      const titleLines = pdf.splitTextToSize(adv, colW - 14);
      pdf.text(titleLines[0] || '', x + 10, advY + 7);

      // Description
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
  // SLIDE 6 — PLAN DETAILS (description)
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
  // SLIDE 7 — FEATURES
  // ══════════════════════════════════════════════════════════
  if (features.length > 0) {
    // Split features into slides of max 10
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

      const chunk = features.slice(page * perSlide, (page + 1) * perSlide);
      const colW = (CW - 10) / 2;

      chunk.forEach((feat: string, idx: number) => {
        const isLeft = idx % 2 === 0;
        const x = isLeft ? ML : ML + colW + 10;
        const row = Math.floor(idx / 2);
        const fy = MT + 28 + row * 13;

        // Feature card
        pdf.setFillColor(...hex(C.bgSoft));
        pdf.setDrawColor(...hex(C.border));
        pdf.setLineWidth(0.2);
        pdf.roundedRect(x, fy, colW, 10, 2, 2, 'FD');

        // Dot
        pdf.setFillColor(...hex(C.primary));
        pdf.circle(x + 4, fy + 5, 1, 'F');

        // Text
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
  // SLIDE — INVESTMENT / PRICING
  // ══════════════════════════════════════════════════════════
  newSlide();

  // Dark background for impact
  pdf.setFillColor(...hex(C.dark));
  pdf.rect(0, 0, SLIDE_W, SLIDE_H, 'F');

  // Accent bar at top
  pdf.setFillColor(...hex(C.primary));
  pdf.rect(0, 0, SLIDE_W, 3, 'F');

  // Section label
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

  // PRICE — large, centered
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

  // Savings callout
  if (proposal.base_plan && proposal.base_plan.price > proposal.custom_price) {
    const savings = formatCurrency(proposal.base_plan.price - proposal.custom_price, proposal.currency);

    // Savings pill
    const savingsText = `${t('proposal.public.savings', 'You save')} ${savings} vs. ${proposal.base_plan.name}`;
    const sw = pdf.setFontSize(9).getTextWidth(savingsText) + 12;
    const sx = (SLIDE_W - sw) / 2;
    pdf.setFillColor(...hex(lighten(C.success, 0.15)));
    pdf.roundedRect(sx, SLIDE_H / 2 + 24, sw, 8, 3, 3, 'F');
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(255, 255, 255);
    pdf.text(savingsText, SLIDE_W / 2, SLIDE_H / 2 + 30, { align: 'center' });
  }

  // Validity
  if (proposal.valid_until) {
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...hex(C.warning));
    pdf.text(
      `${t('proposal.public.validUntilLabel', 'Valid until:')} ${formatDate(proposal.valid_until, lang)}`,
      SLIDE_W / 2, SLIDE_H - 20, { align: 'center' },
    );
  }

  // Footer (light variant for dark bg)
  pdf.setFillColor(...hex(C.primary));
  pdf.rect(0, SLIDE_H - 8, SLIDE_W * 0.6, 0.8, 'F');
  pdf.setFillColor(...hex(C.secondary));
  pdf.rect(SLIDE_W * 0.6, SLIDE_H - 8, SLIDE_W * 0.4, 0.8, 'F');

  pdf.setFontSize(6.5);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...hex(C.textLight));
  pdf.text('AINALYTICS', ML, SLIDE_H - 4);
  pdf.text('Confidential', SLIDE_W / 2, SLIDE_H - 4, { align: 'center' });
  pdf.text(`${slideNum}`, SLIDE_W - MR, SLIDE_H - 4, { align: 'right' });

  // ══════════════════════════════════════════════════════════
  // SLIDE — NEXT STEPS
  // ══════════════════════════════════════════════════════════
  newSlide();
  slideFooter();

  sectionLabel(t('proposal.full.nextStepsLabel', 'Next Steps'), ML, MT, C.success);

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

  // Contact box
  const boxW = CW * 0.45;
  const boxH = 22;
  const boxY = SLIDE_H - 50;
  pdf.setFillColor(...hex(C.bgSoft));
  pdf.setDrawColor(...hex(C.border));
  pdf.setLineWidth(0.3);
  pdf.roundedRect(ML, boxY, boxW, boxH, 3, 3, 'FD');

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(...hex(C.textDark));
  pdf.text(t('proposal.public.haveQuestions', 'Have questions?'), ML + 6, boxY + 9);

  const contactEmail = `contact@${proposal.company_domain || 'ainalytics.com'}`;
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...hex(C.primary));
  pdf.text(contactEmail, ML + 6, boxY + 16);

  // ══════════════════════════════════════════════════════════
  // SLIDE — CLOSING / THANK YOU
  // ══════════════════════════════════════════════════════════
  newSlide();

  // Dark closing slide
  pdf.setFillColor(...hex(C.dark));
  pdf.rect(0, 0, SLIDE_W, SLIDE_H, 'F');

  // Accent bar at top
  pdf.setFillColor(...hex(C.primary));
  pdf.rect(0, 0, SLIDE_W, 3, 'F');

  // Thank you
  pdf.setFontSize(36);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255);
  pdf.text(t('proposal.full.thankYou', 'Thank you.'), SLIDE_W / 2, SLIDE_H / 2 - 10, { align: 'center' });

  // Subtitle
  pdf.setFontSize(13);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...hex(C.textLight));
  pdf.text(
    proposal.client_name
      ? `${proposal.client_name}${proposal.company_name ? ` — ${proposal.company_name}` : ''}`
      : proposal.company_name || proposal.custom_plan_name,
    SLIDE_W / 2, SLIDE_H / 2 + 6, { align: 'center' },
  );

  // Brand at bottom
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(...hex(C.accent));
  pdf.text('AINALYTICS', SLIDE_W / 2, SLIDE_H - 20, { align: 'center' });

  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...hex(C.textLight));
  pdf.text('ainalytics.com', SLIDE_W / 2, SLIDE_H - 14, { align: 'center' });

  // Confidentiality
  pdf.setFontSize(6);
  pdf.setTextColor(...hex(C.textLight));
  pdf.text(
    t('proposal.public.footerNote', 'This proposal is confidential and intended solely for the named recipient.'),
    SLIDE_W / 2, SLIDE_H - 8, { align: 'center' },
  );

  // ── Return as blob ──
  return pdf.output('blob');
}
