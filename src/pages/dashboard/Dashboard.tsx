import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  TrendingUp,
  TrendingDown,
  FileText,
  AlertTriangle,
  BarChart3,
  Activity,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';

// ────────────────────────────────────────────────────────────
// Dummy data
// ────────────────────────────────────────────────────────────

const KPI_DATA = [
  { key: 'totalDocuments', value: '12,847', change: '+12%', up: true },
  { key: 'detectedErrors', value: '1,230', change: '-8%', up: false },
  { key: 'anomalies', value: '276', change: '+3%', up: true },
  { key: 'accuracy', value: '94.7%', change: '+1.2%', up: true },
];

const RISK_DATA = [
  { label: 'Days with High Manual Effort', pct: 72 },
  { label: 'Duplicate Entries', pct: 61 },
  { label: 'Transactions Near Period End', pct: 85 },
  { label: 'Transactions Near Period Start', pct: 54 },
  { label: 'Cash Account Postings', pct: 91 },
  { label: 'Bank & Non-Cash Account Activity', pct: 48 },
];

const DOC_STATUS = [
  { name: 'Invoice Q3', type: 'XML', company: 'Silverline Logistics Co', pct: 79, color: 'magenta' },
  { name: 'Expense Report', type: 'XLSX', company: 'Riverbuild Solutions', pct: 67, color: 'purple' },
  { name: 'Credit Note 21', type: 'PDF', company: 'Trademark Holdings', pct: 82, color: 'cyan' },
  { name: 'Payment Run', type: 'CSV', company: 'Technomatrix Inc', pct: 59, color: 'magenta' },
];

const VOLUME_TABLE = [
  { bucket: '< 100', debit: '-81,986.54', credit: '152,750', net: '70,764' },
  { bucket: '100–1K', debit: '-1,892,268', credit: '2,394,038', net: '501,749' },
  { bucket: '1K–10K', debit: '-14,034,670', credit: '14,631,832', net: '597,432' },
  { bucket: '10K–50K', debit: '-28,197,020', credit: '12,175,620', net: '-221,401' },
  { bucket: '50K–1M', debit: '-3,487,530', credit: '4,129,816', net: '642,286' },
];

const BAR_CHART_DATA = [
  { label: '> 1M', credit: 15, debit: 5 },
  { label: '50K – 1M', credit: 45, debit: 55 },
  { label: '1K – 50K', credit: 20, debit: 15 },
  { label: '< 100', credit: 10, debit: 8 },
];

const ANOMALY_CHART = [
  { day: 'Mon', value: 235 },
  { day: 'Tue', value: 124 },
  { day: 'Wed', value: 152 },
  { day: 'Thu', value: 180 },
  { day: 'Fri', value: 276 },
];

// ────────────────────────────────────────────────────────────
// Dashboard
// ────────────────────────────────────────────────────────────

export function Dashboard() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { currentTenant } = useTenant();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-7 w-72" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="dashboard-card p-5 space-y-3">
              <div className="skeleton h-3 w-20" />
              <div className="skeleton h-8 w-28" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="dashboard-card p-6"><div className="skeleton h-64 w-full" /></div>
          <div className="dashboard-card p-6"><div className="skeleton h-64 w-full" /></div>
        </div>
      </div>
    );
  }

  return (
    <div className="stagger-enter space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-xl font-bold text-text-primary">
          {t('dashboard.welcomeUser', { name: profile?.full_name || '' })}
        </h1>
        {currentTenant && (
          <p className="text-sm text-text-muted mt-0.5">{currentTenant.name}</p>
        )}
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {KPI_DATA.map((kpi) => (
          <KPICard key={kpi.key} kpi={kpi} t={t} />
        ))}
      </div>

      {/* Row 2: Bar Chart + Document Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BarChartCard t={t} />
        <DocumentStatusCard t={t} />
      </div>

      {/* Row 3: Risk Indicators + Volume Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RiskIndicatorsCard t={t} />
        <VolumeTableCard t={t} />
      </div>

      {/* Row 4: Anomaly Chart */}
      <AnomalyChartCard t={t} />
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────

function KPICard({ kpi, t }: { kpi: typeof KPI_DATA[number]; t: ReturnType<typeof useTranslation>['t'] }) {
  const labels: Record<string, string> = {
    totalDocuments: t('analytics.totalDocuments'),
    detectedErrors: t('analytics.detectedErrors'),
    anomalies: t('analytics.anomalies'),
    accuracy: t('analytics.accuracy'),
  };

  return (
    <div className="dashboard-card p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="kpi-label">{labels[kpi.key] || kpi.key}</span>
        <span className={`kpi-trend ${kpi.up ? 'kpi-trend-up' : 'kpi-trend-down'}`}>
          {kpi.up ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
          {kpi.change}
        </span>
      </div>
      <p className="kpi-value">{kpi.value}</p>
    </div>
  );
}

function BarChartCard({ t }: { t: ReturnType<typeof useTranslation>['t'] }) {
  return (
    <div className="dashboard-card p-6">
      <div className="card-header">
        <h2 className="card-title">
          <BarChart3 className="w-4 h-4 text-brand-secondary" />
          {t('analytics.volumeBySize')}
        </h2>
        <div className="flex items-center gap-3 text-xs text-text-muted">
          <span className="flex items-center gap-1.5">
            <span className="legend-dot bg-brand-primary" />
            Credit
          </span>
          <span className="flex items-center gap-1.5">
            <span className="legend-dot bg-chart-magenta" />
            Debit
          </span>
        </div>
      </div>
      <div className="space-y-3">
        {BAR_CHART_DATA.map((row) => (
          <div key={row.label} className="flex items-center gap-3">
            <span className="w-20 text-xs text-text-muted font-mono text-right shrink-0">{row.label}</span>
            <div className="flex-1 flex gap-1">
              <div className="chart-bar chart-bar-purple" style={{ width: `${row.credit}%` }} />
              <div className="chart-bar chart-bar-magenta" style={{ width: `${row.debit}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DocumentStatusCard({ t }: { t: ReturnType<typeof useTranslation>['t'] }) {
  const colorMap: Record<string, string> = {
    magenta: 'bg-chart-magenta',
    purple: 'bg-brand-primary',
    cyan: 'bg-chart-cyan',
  };

  return (
    <div className="dashboard-card p-6">
      <div className="card-header">
        <h2 className="card-title">
          <FileText className="w-4 h-4 text-brand-secondary" />
          {t('analytics.documentStatus')}
        </h2>
        <span className="text-xs text-success font-medium">+12% Document Review</span>
      </div>
      <div className="space-y-4">
        {DOC_STATUS.map((doc) => (
          <div key={doc.name} className="flex items-center gap-3">
            <div className="doc-icon">
              <FileText className="w-4 h-4 text-text-muted" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-text-primary truncate">{doc.name}</span>
                <span className="badge">{doc.type}</span>
              </div>
              <span className="text-xs text-text-muted truncate block">{doc.company}</span>
            </div>
            <span className="text-sm font-semibold text-text-primary font-mono w-10 text-right">{doc.pct}%</span>
            <div className="w-20">
              <div className="progress-bar">
                <div
                  className={`progress-bar-fill ${colorMap[doc.color]}`}
                  style={{ width: `${doc.pct}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RiskIndicatorsCard({ t }: { t: ReturnType<typeof useTranslation>['t'] }) {
  return (
    <div className="dashboard-card p-6">
      <h2 className="card-title mb-5">
        <AlertTriangle className="w-4 h-4 text-chart-magenta" />
        {t('analytics.riskIndicators')}
      </h2>
      <div className="space-y-5">
        {RISK_DATA.map((item) => (
          <div key={item.label}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-text-primary">{item.label}</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-text-muted mb-1">
              <span>Low Risk</span>
              <span>High Risk</span>
            </div>
            <div className="risk-bar">
              <div className="risk-bar-fill" style={{ width: `${item.pct}%` }}>
                <div className="risk-bar-dot" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function VolumeTableCard({ t }: { t: ReturnType<typeof useTranslation>['t'] }) {
  return (
    <div className="dashboard-card p-6">
      <h2 className="card-title mb-5">
        <BarChart3 className="w-4 h-4 text-brand-secondary" />
        {t('analytics.volumeUSD')}
      </h2>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Size Bucket</th>
              <th className="text-right">Debit (D)</th>
              <th className="text-right">Credit (C)</th>
              <th className="text-right">Net Total</th>
            </tr>
          </thead>
          <tbody>
            {VOLUME_TABLE.map((row) => (
              <tr key={row.bucket}>
                <td className="text-text-secondary">{row.bucket}</td>
                <td className="text-right text-error">{row.debit}</td>
                <td className="text-right text-success">{row.credit}</td>
                <td className={`text-right font-semibold ${
                  row.net.startsWith('-') ? 'text-error' : 'text-text-primary'
                }`}>{row.net}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AnomalyChartCard({ t }: { t: ReturnType<typeof useTranslation>['t'] }) {
  const maxVal = Math.max(...ANOMALY_CHART.map((d) => d.value));
  const highlighted = ANOMALY_CHART.reduce((max, d) => d.value > max.value ? d : max, ANOMALY_CHART[0]!);

  return (
    <div className="dashboard-card p-6">
      <div className="card-header">
        <h2 className="card-title">
          <Activity className="w-4 h-4 text-chart-cyan" />
          {t('analytics.identifiedAnomalies')}
        </h2>
        <div className="text-right">
          <p className="text-xs text-text-muted">{t('analytics.detectedErrors')}</p>
          <p className="kpi-value">1,230 <span className="text-sm font-normal text-text-muted">Cases</span></p>
        </div>
      </div>
      <div className="flex items-end gap-3 h-40">
        {ANOMALY_CHART.map((d) => {
          const h = (d.value / maxVal) * 100;
          const isMax = d === highlighted;
          return (
            <div key={d.day} className="flex-1 flex flex-col items-center gap-2">
              <span className="text-xs font-mono text-text-secondary">{d.value}</span>
              <div className="w-full relative" style={{ height: `${h}%` }}>
                <div className={`anomaly-bar${isMax ? ' anomaly-bar-highlight' : ''}`} />
              </div>
              <span className="text-xs text-text-muted">{d.day}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
