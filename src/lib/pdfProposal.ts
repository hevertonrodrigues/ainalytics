/**
 * Programmatic PDF Proposal Generator
 *
 * Builds a professional, branded PDF proposal document using jsPDF.
 * Mirrors the data and sections from the full public proposal page.
 */
import { jsPDF } from 'jspdf';
import type { ProposalData } from '@/pages/proposal/proposalShared';
import { formatCurrency, formatDate } from '@/pages/proposal/proposalShared';

// ─── Color palette ──────────────────────────────────────────
const C = {
  bg:        '#FFFFFF',
  primary:   '#4f46e5', // indigo-600
  secondary: '#7c3aed', // violet-600
  accent:    '#6366f1', // indigo-500
  textDark:  '#1a1a2e',
  textMid:   '#475569',
  textLight: '#94a3b8',
  success:   '#059669',
  warning:   '#d97706',
  error:     '#dc2626',
  border:    '#e2e8f0',
  bgLight:   '#f8fafc',
  bgCard:    '#f1f5f9',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TFunc = any;

// ─── Helper: hex → RGB ─────────────────────────────────────
function hex(c: string): [number, number, number] {
  const h = c.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

// ─── Helper: lighten a hex color ────────────────────────────
function lighten(color: string, amount: number): string {
  const [r, g, b] = hex(color);
  const lr = Math.min(255, Math.round(r + (255 - r) * amount));
  const lg = Math.min(255, Math.round(g + (255 - g) * amount));
  const lb = Math.min(255, Math.round(b + (255 - b) * amount));
  return `#${lr.toString(16).padStart(2, '0')}${lg.toString(16).padStart(2, '0')}${lb.toString(16).padStart(2, '0')}`;
}

// ─── Main generator ─────────────────────────────────────────
export function generateProposalPdf(
  proposal: ProposalData,
  t: TFunc,
  lang: string,
): Blob {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = pdf.internal.pageSize.getWidth();   // 210
  const H = pdf.internal.pageSize.getHeight();  // 297
  const ML = 18;
  const MR = 18;
  const CW = W - ML - MR;
  let y = 0;
  let pageNum = 1;

  const defaultLang = proposal.default_lang || 'en';
  const features = proposal.custom_features[defaultLang] || proposal.custom_features['en'] || [];
  const description = proposal.custom_description[defaultLang] || proposal.custom_description['en'] || '';

  // i18n helpers — get arrays from t()
  const solutionItems: string[] = (t('proposal.full.solutionItems', { returnObjects: true }) as string[]) || [];
  const advantages: string[] = (t('proposal.full.advantages', { returnObjects: true }) as string[]) || [];
  const advantageDescs: string[] = (t('proposal.full.advantageDescs', { returnObjects: true }) as string[]) || [];

  // ── Utility: ensure space or add new page ──
  function ensureSpace(needed: number) {
    if (y + needed > H - 22) {
      addFooter();
      pdf.addPage();
      pageNum++;
      y = 22;
    }
  }

  // ── Utility: add footer ──
  function addFooter() {
    // Thin line
    pdf.setDrawColor(...hex(C.border));
    pdf.setLineWidth(0.3);
    pdf.line(ML, H - 14, W - MR, H - 14);

    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...hex(C.textLight));
    pdf.text('Confidential — Prepared by Ainalytics', ML, H - 9);
    pdf.text(`Page ${pageNum}`, W - MR, H - 9, { align: 'right' });
  }

  // ── Utility: section header with accent bar ──
  function sectionHeader(label: string, title: string, accentColor = C.primary) {
    ensureSpace(20);
    // Label
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...hex(accentColor));
    pdf.text(label.toUpperCase(), ML, y);
    y += 5;
    // Accent bar
    pdf.setFillColor(...hex(accentColor));
    pdf.rect(ML, y, 24, 1, 'F');
    y += 6;
    // Title
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...hex(C.textDark));
    const titleLines = pdf.splitTextToSize(title, CW);
    for (const line of titleLines) {
      ensureSpace(8);
      pdf.text(line, ML, y);
      y += 7;
    }
    y += 4;
  }

  // ── Utility: body text block ──
  function textBlock(text: string, fontSize = 9.5, color = C.textMid) {
    pdf.setFontSize(fontSize);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...hex(color));
    const lines = pdf.splitTextToSize(text, CW);
    for (const line of lines) {
      ensureSpace(5);
      pdf.text(line, ML, y);
      y += fontSize * 0.47;
    }
    y += 3;
  }

  // ── Utility: rounded rect ──
  function roundedRect(x: number, yPos: number, w: number, h: number, r: number, fill: string, stroke?: string) {
    pdf.setFillColor(...hex(fill));
    if (stroke) {
      pdf.setDrawColor(...hex(stroke));
      pdf.setLineWidth(0.3);
    }
    pdf.roundedRect(x, yPos, w, h, r, r, stroke ? 'FD' : 'F');
  }

  // ══════════════════════════════════════════════════════════
  // PAGE 1 — COVER
  // ══════════════════════════════════════════════════════════

  // Full-width gradient header band
  const gradH = 100;
  pdf.setFillColor(...hex(C.primary));
  pdf.rect(0, 0, W, gradH, 'F');

  // Secondary accent stripe
  pdf.setFillColor(...hex(C.secondary));
  pdf.rect(0, gradH - 12, W, 12, 'F');

  // Brand name
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.text('AINALYTICS', ML, 20);

  // "Prepared for" label
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(255, 255, 255);
  pdf.text(t('proposal.public.preparedFor', 'PREPARED FOR').toUpperCase(), ML, 40);

  // Client name (large)
  if (proposal.client_name) {
    pdf.setFontSize(30);
    pdf.setFont('helvetica', 'bold');
    const clientLines = pdf.splitTextToSize(proposal.client_name, CW);
    let clientY = 52;
    for (const line of clientLines) {
      pdf.text(line, ML, clientY);
      clientY += 13;
    }
    // Company name below
    if (proposal.company_name) {
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'normal');
      pdf.text(proposal.company_name, ML, clientY + 2);
    }
  } else if (proposal.company_name) {
    pdf.setFontSize(30);
    pdf.setFont('helvetica', 'bold');
    const compLines = pdf.splitTextToSize(proposal.company_name, CW);
    let compY = 52;
    for (const line of compLines) {
      pdf.text(line, ML, compY);
      compY += 13;
    }
  } else {
    pdf.setFontSize(30);
    pdf.setFont('helvetica', 'bold');
    pdf.text(proposal.custom_plan_name, ML, 52);
  }

  // Plan name + date below gradient
  y = gradH + 10;
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(...hex(C.textDark));
  pdf.text(proposal.custom_plan_name, ML, y);
  y += 7;

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...hex(C.textLight));
  pdf.text(formatDate(proposal.created_at, lang), ML, y);
  y += 4;

  if (proposal.valid_until) {
    pdf.setTextColor(...hex(C.warning));
    pdf.text(`${t('proposal.public.validUntilLabel', 'Valid until:')} ${formatDate(proposal.valid_until, lang)}`, ML, y);
    y += 4;
  }

  y += 12;

  // ── Cover pricing box ──
  const priceBoxH = 40;
  roundedRect(ML, y, CW, priceBoxH, 4, C.bgLight, C.border);

  // Price
  const priceStr = formatCurrency(proposal.custom_price, proposal.currency);
  pdf.setFontSize(28);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(...hex(C.primary));
  pdf.text(priceStr, W / 2, y + 18, { align: 'center' });

  // Billing interval
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...hex(C.textMid));
  const intervalLabel = proposal.billing_interval === 'monthly'
    ? t('proposal.public.billedMonthly', 'Billed monthly')
    : t('proposal.public.billedYearly', 'Billed yearly');
  pdf.text(intervalLabel, W / 2, y + 28, { align: 'center' });

  // Savings
  if (proposal.base_plan && proposal.base_plan.price > proposal.custom_price) {
    pdf.setFontSize(8);
    pdf.setTextColor(...hex(C.success));
    const savings = formatCurrency(proposal.base_plan.price - proposal.custom_price, proposal.currency);
    pdf.text(
      `${t('proposal.public.savings', 'You save')} ${savings} vs. ${proposal.base_plan.name}`,
      W / 2, y + 35, { align: 'center' },
    );
  }

  y += priceBoxH + 8;

  // Cover footer
  addFooter();

  // ══════════════════════════════════════════════════════════
  // PAGE 2 — ABOUT US
  // ══════════════════════════════════════════════════════════
  pdf.addPage();
  pageNum++;
  y = 22;

  sectionHeader(
    t('proposal.full.aboutUsLabel', 'About Us'),
    t('proposal.full.aboutUsTitle', 'Who We Are'),
    C.primary,
  );
  textBlock(t('proposal.full.aboutUsText', ''));

  y += 6;

  // ── THE PROBLEM ──
  sectionHeader(
    t('proposal.full.problemLabel', 'The Challenge'),
    t('proposal.full.problemTitle', 'The Problem We Solve'),
    C.error,
  );
  textBlock(t('proposal.full.problemText', ''));

  addFooter();

  // ══════════════════════════════════════════════════════════
  // PAGE 3 — OUR SOLUTION
  // ══════════════════════════════════════════════════════════
  pdf.addPage();
  pageNum++;
  y = 22;

  sectionHeader(
    t('proposal.full.solutionLabel', 'Our Solution'),
    t('proposal.full.solutionTitle', 'How We Help'),
    C.accent,
  );

  if (solutionItems.length > 0) {
    solutionItems.forEach((item: string, idx: number) => {
      ensureSpace(10);
      const num = String(idx + 1).padStart(2, '0');

      // Number
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...hex(C.primary));
      pdf.text(num, ML, y + 4);

      // Text
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(...hex(C.textMid));
      const lines = pdf.splitTextToSize(item, CW - 14);
      lines.forEach((line: string, li: number) => {
        ensureSpace(5);
        pdf.text(line, ML + 12, y + 4 + li * 4);
      });
      y += Math.max(8, lines.length * 4 + 3);
    });
    y += 4;
  }

  // ── COMPETITIVE ADVANTAGES ──
  sectionHeader(
    t('proposal.full.advantagesLabel', 'Why Choose Us'),
    t('proposal.full.advantagesTitle', 'Competitive Advantages'),
    C.secondary,
  );

  if (advantages.length > 0) {
    advantages.forEach((adv: string, idx: number) => {
      ensureSpace(14);

      // Card background
      const cardH = advantageDescs[idx] ? 16 : 9;
      roundedRect(ML, y, CW, cardH, 2, C.bgLight, C.border);

      // Title
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...hex(C.textDark));
      pdf.text(adv, ML + 4, y + 6);

      // Description
      if (advantageDescs[idx]) {
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(...hex(C.textMid));
        const descLines = pdf.splitTextToSize(advantageDescs[idx], CW - 8);
        pdf.text(descLines[0] || '', ML + 4, y + 12);
      }

      y += cardH + 3;
    });
    y += 2;
  }

  addFooter();

  // ══════════════════════════════════════════════════════════
  // PLAN DETAILS + FEATURES
  // ══════════════════════════════════════════════════════════
  pdf.addPage();
  pageNum++;
  y = 22;

  // Description
  if (description) {
    sectionHeader(
      t('proposal.public.planDetails', 'Plan Details'),
      proposal.custom_plan_name,
      C.primary,
    );
    textBlock(description);
    y += 4;
  }

  // Features
  if (features.length > 0) {
    sectionHeader(
      t('proposal.public.whatsIncluded', "What's Included"),
      t('proposal.features', 'Features'),
      C.accent,
    );

    // Two-column feature grid
    const colW = (CW - 6) / 2;
    const leftX = ML;
    const rightX = ML + colW + 6;

    features.forEach((feat: string, idx: number) => {
      const isLeft = idx % 2 === 0;
      if (isLeft) ensureSpace(10);

      const x = isLeft ? leftX : rightX;
      const featureY = isLeft ? y : y; // Both on same y for pairs

      // Dot
      pdf.setFillColor(...hex(C.primary));
      pdf.circle(x + 2, featureY + 3, 1, 'F');

      // Text
      pdf.setFontSize(8.5);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(...hex(C.textDark));
      const fLines = pdf.splitTextToSize(feat, colW - 8);
      fLines.slice(0, 2).forEach((line: string, li: number) => {
        pdf.text(line, x + 6, featureY + 3 + li * 3.5);
      });

      if (!isLeft || idx === features.length - 1) {
        y += Math.max(8, fLines.length * 3.5 + 3);
      }
    });
    y += 4;
  }

  // ── PRICING SECTION ──
  sectionHeader(
    t('proposal.public.investment', 'Investment'),
    proposal.billing_interval === 'monthly'
      ? t('proposal.public.monthlyInvestment', 'Monthly Investment')
      : t('proposal.public.yearlyInvestment', 'Yearly Investment'),
    C.primary,
  );

  ensureSpace(35);
  const pBoxY = y;
  const pBoxH = 30;

  // Gradient-like box
  roundedRect(ML, pBoxY, CW, pBoxH, 4, lighten(C.primary, 0.92), C.primary);

  // Price
  pdf.setFontSize(24);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(...hex(C.primary));
  pdf.text(priceStr, W / 2, pBoxY + 14, { align: 'center' });

  // Interval
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...hex(C.textMid));
  pdf.text(intervalLabel, W / 2, pBoxY + 22, { align: 'center' });

  y = pBoxY + pBoxH + 8;

  addFooter();

  // ══════════════════════════════════════════════════════════
  // LAST PAGE — NEXT STEPS + CONTACT
  // ══════════════════════════════════════════════════════════
  pdf.addPage();
  pageNum++;
  y = 22;

  sectionHeader(
    t('proposal.full.nextStepsLabel', 'Next Steps'),
    t('proposal.full.nextStepsTitle', 'Ready to Get Started?'),
    C.success,
  );

  textBlock(t('proposal.public.ctaText', 'Accept this proposal to begin your journey with Ainalytics.'));

  y += 4;

  // Contact info box
  ensureSpace(30);
  const contactBoxY = y;
  roundedRect(ML, contactBoxY, CW, 24, 4, C.bgCard, C.border);

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(...hex(C.textDark));
  pdf.text(t('proposal.public.haveQuestions', 'Have questions?'), ML + 6, contactBoxY + 9);

  const contactEmail = `contact@${proposal.company_domain || 'ainalytics.com'}`;
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...hex(C.primary));
  pdf.text(contactEmail, ML + 6, contactBoxY + 17);

  y = contactBoxY + 30;

  // Confidentiality notice
  ensureSpace(12);
  pdf.setFontSize(7.5);
  pdf.setFont('helvetica', 'italic');
  pdf.setTextColor(...hex(C.textLight));
  const confLines = pdf.splitTextToSize(
    t('proposal.public.footerNote', 'This proposal is confidential and intended solely for the named recipient.'),
    CW,
  );
  for (const line of confLines) {
    pdf.text(line, ML, y);
    y += 3.5;
  }

  // Final page footer
  addFooter();

  // ── Return as blob ──
  return pdf.output('blob');
}
