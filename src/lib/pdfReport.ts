/**
 * Programmatic PDF Report Generator
 *
 * Builds a professional, print-friendly PDF report from the company's
 * GEO analysis data using jsPDF — no DOM capture.
 */
import { jsPDF } from 'jspdf';
import type { Company, AiReport, CompanyPage, GeoFactorScore, GeoTopRecommendation } from '@/types';

// ─── Color palette (light theme for print) ─────────────────
const C = {
  bg:        '#FFFFFF',
  primary:   '#6366f1', // indigo
  secondary: '#8b5cf6', // violet
  textDark:  '#1a1a2e',
  textMid:   '#475569',
  textLight: '#94a3b8',
  success:   '#22c55e',
  warning:   '#f59e0b',
  error:     '#ef4444',
  info:      '#3b82f6',
  border:    '#e2e8f0',
  bgLight:   '#f8fafc',
  bgCard:    '#f1f5f9',
};

// Status badge colors
const STATUS_COLORS: Record<string, string> = {
  excellent: C.success,
  good:      '#16a34a',
  warning:   C.warning,
  critical:  C.error,
};

// Category colors
const CATEGORY_COLORS: Record<string, string> = {
  Technical: C.info,
  Content:   C.success,
  Authority: C.warning,
  Semantic:  C.secondary,
};

// ─── Helper: hex to RGB ────────────────────────────────────
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TFunc = any;

// ─── Main generator ────────────────────────────────────────
export function generatePdfReport(
  company: Company,
  report: AiReport,
  pages: CompanyPage[],
  t: TFunc,
): Blob {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = pdf.internal.pageSize.getWidth();   // 210
  const H = pdf.internal.pageSize.getHeight();  // 297
  const ML = 15; // margin left
  const MR = 15; // margin right
  const CW = W - ML - MR; // content width
  let y = 0;
  let pageNum = 1;

  // ── Utility: ensure space or add new page ──
  function ensureSpace(needed: number) {
    if (y + needed > H - 20) {
      addFooter();
      pdf.addPage();
      pageNum++;
      y = 20;
    }
  }

  // ── Utility: add footer to current page ──
  function addFooter() {
    pdf.setFontSize(7);
    pdf.setTextColor(...hex(C.textLight));
    pdf.setFont('helvetica', 'normal');
    const footerDate = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    pdf.text(t('company.pdfGeneratedOn', { date: footerDate }), ML, H - 8);
    pdf.text(t('company.pdfPoweredBy', 'Powered by AINalytics'), W / 2, H - 8, { align: 'center' });
    pdf.text(t('company.pdfPageNumber', { number: pageNum }), W - MR, H - 8, { align: 'right' });
    // thin line
    pdf.setDrawColor(...hex(C.border));
    pdf.setLineWidth(0.3);
    pdf.line(ML, H - 12, W - MR, H - 12);
  }

  // ── Utility: section header ──
  function sectionHeader(title: string, accentColor = C.primary) {
    ensureSpace(14);
    // accent bar
    pdf.setFillColor(...hex(accentColor));
    pdf.rect(ML, y, 3, 8, 'F');
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...hex(C.textDark));
    pdf.text(title, ML + 6, y + 6);
    y += 12;
  }

  // ── Utility: wrapped text block ──
  function textBlock(text: string, fontSize = 9, color = C.textMid) {
    pdf.setFontSize(fontSize);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...hex(color));
    const lines = pdf.splitTextToSize(text, CW);
    for (const line of lines) {
      ensureSpace(5);
      pdf.text(line, ML, y);
      y += fontSize * 0.45;
    }
    y += 2;
  }

  // ── Utility: draw a rounded rect ──
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
  const gradHeight = 85;
  pdf.setFillColor(...hex(C.primary));
  pdf.rect(0, 0, W, gradHeight, 'F');
  // Secondary overlay stripe
  pdf.setFillColor(...hex(C.secondary));
  pdf.rect(0, gradHeight - 16, W, 16, 'F');

  // Brand
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text('AINALYTICS', ML, 18);

  // Title
  pdf.setFontSize(26);
  pdf.setFont('helvetica', 'bold');
  const companyTitle = company.company_name || company.domain;
  const titleLines = pdf.splitTextToSize(companyTitle, CW);
  let titleY = 38;
  for (const line of titleLines) {
    pdf.text(line, ML, titleY);
    titleY += 12;
  }

  // Subtitle
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');
  pdf.text(t('company.pdfReportTitle', 'GEO Analysis Report'), ML, titleY + 2);

  // Meta info bar (plain text — no emojis, jsPDF Helvetica doesn't support them)
  y = gradHeight + 8;
  pdf.setFontSize(9);
  pdf.setTextColor(...hex(C.textMid));
  const metaParts: string[] = [];
  if (company.domain) metaParts.push(company.domain);
  if (report.industry) metaParts.push(report.industry);
  if (report.country) metaParts.push(report.country);
  const dateStr = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  metaParts.push(dateStr);
  pdf.text(metaParts.join('  |  '), ML, y);
  y += 12;

  // ── GEO Score Display ──
  if (report.composite_score !== undefined && report.readiness_level !== undefined) {
    ensureSpace(55);
    const scoreBoxY = y;
    const boxH = 48;
    roundedRect(ML, scoreBoxY, CW, boxH, 3, C.bgLight, C.border);

    // ── LEFT COLUMN: Big score number ──
    const score = Math.round(report.composite_score);
    const scoreColor = score >= 80 ? C.success : score >= 60 ? '#16a34a' : score >= 40 ? C.warning : C.error;

    pdf.setFontSize(40);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...hex(scoreColor));
    pdf.text(`${score}`, ML + 14, scoreBoxY + 28);

    // /100 suffix
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...hex(C.textLight));
    pdf.setFontSize(40);
    const scoreW = pdf.getTextWidth(`${score}`);
    pdf.setFontSize(14);
    pdf.text('/100', ML + 14 + scoreW + 1, scoreBoxY + 28);

    // GEO Score label
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...hex(C.textMid));
    pdf.text(t('company.geoScore', 'GEO Score'), ML + 14, scoreBoxY + 36);

    // ── CENTER COLUMN: Readiness badge + points ──
    const centerX = ML + 55;
    const readinessLabel = report.readiness_label || `Level ${report.readiness_level}`;
    const badgeColor = report.readiness_level >= 4 ? C.success : report.readiness_level >= 3 ? '#16a34a' : report.readiness_level >= 2 ? C.warning : C.error;

    const badgeW = 46;
    roundedRect(centerX, scoreBoxY + 16, badgeW, 12, 3, lighten(badgeColor, 0.85), badgeColor);
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...hex(badgeColor));
    pdf.text(readinessLabel, centerX + badgeW / 2, scoreBoxY + 24, { align: 'center' });

    // Points to next level
    if (report.points_to_next_level && report.next_level) {
      pdf.setFontSize(7.5);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(...hex(C.textMid));
      pdf.text(
        t('company.pdfPointsTo', { points: report.points_to_next_level, level: report.next_level.label }),
        centerX, scoreBoxY + 38,
      );
    }

    // ── RIGHT COLUMN: Category score bars ──
    if (report.category_scores) {
      const catLabelX = ML + CW - 70;
      const barX = catLabelX + 26;
      const barW = 30;
      const cats: [string, number, string][] = [
        [t('company.pdfTechnical', 'Technical'), report.category_scores.technical ?? 0, CATEGORY_COLORS.Technical || C.info],
        [t('company.pdfContent', 'Content'), report.category_scores.content ?? 0, CATEGORY_COLORS.Content || C.success],
        [t('company.pdfAuthority', 'Authority'), report.category_scores.authority ?? 0, CATEGORY_COLORS.Authority || C.warning],
        [t('company.pdfSemantic', 'Semantic'), report.category_scores.semantic ?? 0, CATEGORY_COLORS.Semantic || C.secondary],
      ];
      let catY = scoreBoxY + 8;
      for (const [label, val, color] of cats) {
        // Label
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(...hex(C.textMid));
        pdf.text(label, catLabelX, catY + 3);
        // Bar background
        roundedRect(barX, catY, barW, 4, 1, lighten(color, 0.8));
        // Bar fill
        const fillW = Math.max(1, (val / 100) * barW);
        roundedRect(barX, catY, fillW, 4, 1, color);
        // Score text
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(...hex(color));
        pdf.text(`${Math.round(val)}`, barX + barW + 3, catY + 3);
        catY += 9;
      }
    }

    y = scoreBoxY + boxH + 5;
  } else if (report.geo_score !== undefined) {
    // Fallback: old simple score
    ensureSpace(20);
    pdf.setFontSize(28);
    pdf.setFont('helvetica', 'bold');
    const sc = Math.round(report.geo_score);
    const scoreColor = sc >= 80 ? C.success : sc >= 60 ? C.warning : C.error;
    pdf.setTextColor(...hex(scoreColor));
    pdf.text(`${sc}/100`, ML, y + 10);
    pdf.setFontSize(9);
    pdf.setTextColor(...hex(C.textMid));
    pdf.text(t('company.geoScore', 'GEO Score'), ML + 45, y + 10);
    y += 20;
  }

  // ══════════════════════════════════════════════════════════
  // AI SUMMARY
  // ══════════════════════════════════════════════════════════
  if (report.summary) {
    sectionHeader(t('company.summary', 'AI Summary'));
    textBlock(report.summary);
    y += 4;
  }

  // ══════════════════════════════════════════════════════════
  // 25-FACTOR SCORECARD
  // ══════════════════════════════════════════════════════════
  if (report.factor_scores && report.factor_scores.length > 0) {
    sectionHeader(t('company.pdfGeoFactorScorecard', 'GEO Factor Scorecard'), C.info);

    // Table header
    ensureSpace(10);
    roundedRect(ML, y, CW, 7, 1, C.primary);
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(255, 255, 255);
    pdf.text(t('company.pdfFactor', 'Factor'), ML + 3, y + 5);
    pdf.text(t('company.pdfCategory', 'Category'), ML + 85, y + 5);
    pdf.text(t('company.pdfScore', 'Score'), ML + 115, y + 5);
    pdf.text(t('company.pdfStatus', 'Status'), ML + 150, y + 5);
    y += 9;

    const sortedFactors = [...report.factor_scores].sort((a, b) => b.score - a.score);
    sortedFactors.forEach((factor: GeoFactorScore, i: number) => {
      ensureSpace(9);
      const rowBg = i % 2 === 0 ? C.bg : C.bgLight;
      roundedRect(ML, y, CW, 7, 0, rowBg);

      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(...hex(C.textDark));
      const nameLines = pdf.splitTextToSize(factor.name, 78);
      pdf.text(nameLines[0], ML + 3, y + 5);

      // Category pill
      const catColor = CATEGORY_COLORS[factor.category] || C.textMid;
      pdf.setFontSize(6);
      pdf.setTextColor(...hex(catColor));
      pdf.setFont('helvetica', 'bold');
      pdf.text(factor.category, ML + 85, y + 5);

      // Score bar
      const barX = ML + 115;
      const barW = 28;
      roundedRect(barX, y + 1.5, barW, 3.5, 1, lighten(catColor, 0.8));
      const fillW = Math.max(0.5, (factor.score / 100) * barW);
      roundedRect(barX, y + 1.5, fillW, 3.5, 1, catColor);
      pdf.setFontSize(7);
      pdf.setTextColor(...hex(C.textDark));
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${Math.round(factor.score)}`, barX + barW + 2, y + 5);

      // Status badge
      const statusColor = STATUS_COLORS[factor.status] || C.textMid;
      roundedRect(ML + 150, y + 1, 22, 5, 1.5, lighten(statusColor, 0.85), statusColor);
      pdf.setFontSize(6);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...hex(statusColor));
      pdf.text(factor.status.toUpperCase(), ML + 161, y + 4.5, { align: 'center' });

      y += 8;
    });

    y += 4;
  }

  // ══════════════════════════════════════════════════════════
  // TOP RECOMMENDATIONS
  // ══════════════════════════════════════════════════════════
  if (report.top_recommendations && report.top_recommendations.length > 0) {
    sectionHeader(t('company.recommendations', 'Top Recommendations'), C.warning);

    report.top_recommendations.forEach((rec: GeoTopRecommendation, i: number) => {
      ensureSpace(18);
      // Card
      roundedRect(ML, y, CW, 15, 2, C.bgLight, C.border);
      // Priority number
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...hex(C.primary));
      pdf.text(`${i + 1}`, ML + 5, y + 10);

      // Factor name
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...hex(C.textDark));
      pdf.text(rec.factor_name, ML + 15, y + 6);

      // Recommendation text
      pdf.setFontSize(7.5);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(...hex(C.textMid));
      const recLines = pdf.splitTextToSize(rec.recommendation, CW - 52);
      pdf.text(recLines.slice(0, 2).join('\n'), ML + 15, y + 10.5);

      // Potential gain badge
      if (rec.potential_composite_gain > 0) {
        const gainStr = `+${rec.potential_composite_gain.toFixed(1)}`;
        roundedRect(ML + CW - 22, y + 3, 18, 9, 2, lighten(C.success, 0.85), C.success);
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(...hex(C.success));
        pdf.text(gainStr, ML + CW - 13, y + 9.5, { align: 'center' });
      }

      y += 17;
    });
    y += 3;
  }

  // ══════════════════════════════════════════════════════════
  // STRENGTHS & WEAKNESSES (two-column)
  // ══════════════════════════════════════════════════════════
  const hasStrengths = report.strengths && report.strengths.length > 0;
  const hasWeaknesses = report.weaknesses && report.weaknesses.length > 0;
  if (hasStrengths || hasWeaknesses) {
    sectionHeader(t('company.strengths', 'Strengths') + ' & ' + t('company.weaknesses', 'Weaknesses'));

    const colW = (CW - 4) / 2;
    const leftX = ML;
    const rightX = ML + colW + 4;

    // Strengths column header
    if (hasStrengths) {
      ensureSpace(8);
      roundedRect(leftX, y, colW, 6, 1, lighten(C.success, 0.85));
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...hex(C.success));
      pdf.text(`+ ${t('company.strengths', 'Strengths')}`, leftX + 3, y + 4.5);
    }

    // Weaknesses column header
    if (hasWeaknesses) {
      roundedRect(rightX, y, colW, 6, 1, lighten(C.warning, 0.85));
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...hex(C.warning));
      pdf.text(`! ${t('company.weaknesses', 'Weaknesses')}`, rightX + 3, y + 4.5);
    }
    y += 9;

    const maxItems = Math.max(report.strengths?.length || 0, report.weaknesses?.length || 0);
    for (let i = 0; i < maxItems; i++) {
      ensureSpace(10);
      const itemY = y;

      if (report.strengths?.[i]) {
        pdf.setFontSize(7.5);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(...hex(C.textDark));
        const sLines = pdf.splitTextToSize(`• ${report.strengths[i]}`, colW - 4);
        sLines.slice(0, 3).forEach((line: string, li: number) => {
          pdf.text(line, leftX + 2, itemY + 4 + li * 3.5);
        });
      }

      if (report.weaknesses?.[i]) {
        pdf.setFontSize(7.5);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(...hex(C.textDark));
        const wLines = pdf.splitTextToSize(`• ${report.weaknesses[i]}`, colW - 4);
        wLines.slice(0, 3).forEach((line: string, li: number) => {
          pdf.text(line, rightX + 2, itemY + 4 + li * 3.5);
        });
      }

      y += 10;
    }
    y += 3;
  }

  // ══════════════════════════════════════════════════════════
  // TAGS & CATEGORIES
  // ══════════════════════════════════════════════════════════
  const hasTags = report.tags && report.tags.length > 0;
  const hasCats = report.categories && report.categories.length > 0;
  if (hasTags || hasCats) {
    sectionHeader(
      [hasTags ? t('company.tags', 'Tags') : '', hasCats ? t('company.categories', 'Categories') : '']
        .filter(Boolean)
        .join(' & '),
      C.secondary,
    );

    if (hasTags) {
      ensureSpace(10);
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...hex(C.textDark));
      pdf.text(t('company.tags', 'Tags'), ML, y + 3);
      y += 6;

      let pillX = ML;
      for (const tag of report.tags) {
        const tw = pdf.getTextWidth(tag) + 8;
        if (pillX + tw > W - MR) {
          pillX = ML;
          y += 7;
          ensureSpace(7);
        }
        roundedRect(pillX, y, tw, 5.5, 2.5, lighten(C.primary, 0.85), C.primary);
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(...hex(C.primary));
        pdf.text(tag, pillX + 4, y + 4);
        pillX += tw + 3;
      }
      y += 9;
    }

    if (hasCats) {
      ensureSpace(10);
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...hex(C.textDark));
      pdf.text(t('company.categories', 'Categories'), ML, y + 3);
      y += 6;

      let pillX = ML;
      for (const cat of report.categories) {
        const tw = pdf.getTextWidth(cat) + 8;
        if (pillX + tw > W - MR) {
          pillX = ML;
          y += 7;
          ensureSpace(7);
        }
        roundedRect(pillX, y, tw, 5.5, 2.5, lighten(C.secondary, 0.85), C.secondary);
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(...hex(C.secondary));
        pdf.text(cat, pillX + 4, y + 4);
        pillX += tw + 3;
      }
      y += 9;
    }
    y += 2;
  }

  // ══════════════════════════════════════════════════════════
  // PRODUCTS & SERVICES
  // ══════════════════════════════════════════════════════════
  if (report.products_services && report.products_services.length > 0) {
    sectionHeader(t('company.productsServices', 'Products & Services'), C.info);

    // Table header
    ensureSpace(10);
    roundedRect(ML, y, CW, 7, 1, C.primary);
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(255, 255, 255);
    pdf.text(t('company.pdfName', 'Name'), ML + 3, y + 5);
    pdf.text(t('company.pdfType', 'Type'), ML + 60, y + 5);
    pdf.text(t('company.pdfDescription', 'Description'), ML + 82, y + 5);
    y += 9;

    report.products_services.forEach((ps, i) => {
      ensureSpace(9);
      const rowBg = i % 2 === 0 ? C.bg : C.bgLight;
      pdf.setFillColor(...hex(rowBg));
      pdf.rect(ML, y, CW, 7, 'F');

      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...hex(C.textDark));
      const nameText = pdf.splitTextToSize(ps.name, 54);
      pdf.text(nameText[0], ML + 3, y + 5);

      // Type badge
      const typeColor = ps.type === 'product' ? C.info : C.success;
      roundedRect(ML + 60, y + 1, 18, 5, 1.5, lighten(typeColor, 0.85), typeColor);
      pdf.setFontSize(5.5);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...hex(typeColor));
      pdf.text(ps.type.toUpperCase(), ML + 69, y + 4.5, { align: 'center' });

      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(...hex(C.textMid));
      const descLines = pdf.splitTextToSize(ps.description, CW - 85);
      pdf.text(descLines[0], ML + 82, y + 5);

      y += 8;
    });
    y += 4;
  }

  // ══════════════════════════════════════════════════════════
  // AI BOT ACCESS
  // ══════════════════════════════════════════════════════════
  if (report.ai_bot_access && Object.keys(report.ai_bot_access).length > 0) {
    sectionHeader(t('company.aiBotAccess', 'AI Bot Access'), C.info);

    const bots = Object.entries(report.ai_bot_access);
    const colW2 = (CW - 4) / 2;
    let botX = ML;
    let botCount = 0;

    for (const [bot, allowed] of bots) {
      if (botCount > 0 && botCount % 2 === 0) {
        y += 9;
        botX = ML;
      }
      ensureSpace(10);

      const color = allowed ? C.success : C.error;
      roundedRect(botX, y, colW2, 7, 2, lighten(color, 0.9), color);
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...hex(color));
      const icon = allowed ? '+' : 'x';
      pdf.text(`${icon} ${bot}`, botX + 4, y + 5);

      pdf.setFontSize(6);
      pdf.setFont('helvetica', 'normal');
      const statusText = allowed ? t('company.allowed', 'Allowed') : t('company.blocked', 'Blocked');
      pdf.text(statusText, botX + colW2 - 4, y + 5, { align: 'right' });

      botX = ML + colW2 + 4;
      botCount++;
    }
    y += 12;
  }

  // ══════════════════════════════════════════════════════════
  // PAGES ANALYZED
  // ══════════════════════════════════════════════════════════
  const validPages = pages.filter(p => p.status_code === 200);
  if (validPages.length > 0) {
    sectionHeader(`${t('company.pagesAnalyzed', 'Pages Analyzed')} (${validPages.length})`, C.primary);

    // Table header
    ensureSpace(10);
    roundedRect(ML, y, CW, 7, 1, C.primary);
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(255, 255, 255);
    pdf.text(t('company.pdfPage', 'Page'), ML + 3, y + 5);
    pdf.text(t('company.pdfWords', 'Words'), ML + 120, y + 5);
    pdf.text(t('company.pdfLoadTime', 'Load (ms)'), ML + 140, y + 5);
    pdf.text(t('company.pdfSchema', 'Schema'), ML + 165, y + 5);
    y += 9;

    // Show up to 30 pages
    const pagesToShow = validPages.slice(0, 30);
    pagesToShow.forEach((page, i) => {
      ensureSpace(8);
      const rowBg = i % 2 === 0 ? C.bg : C.bgLight;
      pdf.setFillColor(...hex(rowBg));
      pdf.rect(ML, y, CW, 7, 'F');

      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(...hex(C.textDark));
      const title = page.title || page.url;
      const titleTrunc = pdf.splitTextToSize(title, 105);
      pdf.text(titleTrunc[0], ML + 3, y + 5);

      pdf.setTextColor(...hex(C.textMid));
      pdf.text(`${page.word_count || 0}`, ML + 120, y + 5);
      pdf.text(`${page.load_time_ms || '-'}`, ML + 140, y + 5);

      // Schema indicator
      const schemaColor = page.has_structured_data ? C.success : C.textLight;
      pdf.setTextColor(...hex(schemaColor));
      pdf.text(page.has_structured_data ? t('company.pdfYes', 'Yes') : '-', ML + 167, y + 5);

      y += 7;
    });

    if (validPages.length > 30) {
      ensureSpace(6);
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'italic');
      pdf.setTextColor(...hex(C.textLight));
      pdf.text(t('company.pdfAndMore', { count: validPages.length - 30 }), ML + 3, y + 3);
      y += 6;
    }
    y += 4;
  }

  // ══════════════════════════════════════════════════════════
  // COMPETITORS
  // ══════════════════════════════════════════════════════════
  if (report.competitors && report.competitors.length > 0) {
    sectionHeader(t('company.competitors', 'Competitors'), C.warning);

    report.competitors.forEach((comp) => {
      ensureSpace(7);
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(...hex(C.textDark));
      pdf.text(`•  ${comp}`, ML + 3, y + 4);
      y += 6;
    });
    y += 3;
  }

  // ══════════════════════════════════════════════════════════
  // SCHEMA MARKUP TYPES
  // ══════════════════════════════════════════════════════════
  if (report.schema_markup_types && report.schema_markup_types.length > 0) {
    sectionHeader(t('company.schemaMarkup', 'Schema Markup'), C.success);

    ensureSpace(10);
    let pillX = ML;
    for (const type of report.schema_markup_types) {
      const tw = pdf.getTextWidth(type) + 8;
      if (pillX + tw > W - MR) {
        pillX = ML;
        y += 7;
        ensureSpace(7);
      }
      roundedRect(pillX, y, tw, 5.5, 2.5, lighten(C.success, 0.85), C.success);
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...hex(C.success));
      pdf.text(type, pillX + 4, y + 4);
      pillX += tw + 3;
    }
    y += 10;
  }

  // ══════════════════════════════════════════════════════════
  // CONTENT QUALITY & STRUCTURED DATA (fallback if no factor scores)
  // ══════════════════════════════════════════════════════════
  if (!report.factor_scores) {
    if (report.content_quality || report.structured_data_coverage) {
      sectionHeader(t('company.pdfContentDataOverview', 'Content & Data Overview'));
      
      ensureSpace(12);
      if (report.content_quality) {
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(...hex(C.textDark));
        pdf.text(`${t('company.contentQuality', 'Content Quality')}: `, ML, y + 4);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(...hex(C.textMid));
        pdf.text(report.content_quality, ML + 45, y + 4);
        y += 7;
      }
      if (report.structured_data_coverage) {
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(...hex(C.textDark));
        pdf.text(`${t('company.structuredData', 'Structured Data')}: `, ML, y + 4);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(...hex(C.textMid));
        pdf.text(report.structured_data_coverage, ML + 45, y + 4);
        y += 7;
      }
      y += 4;
    }
  }

  // ── Final footer ──
  addFooter();

  return pdf.output('blob');
}
