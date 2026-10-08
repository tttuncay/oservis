import { useState } from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';
import type {
  IncomeExpenseReport,
  OccupancyReport,
  ReceivablesReport,
  ReportJob,
  VehicleProfitabilityReport,
} from '@servisapp/shared';
import type { FinanceReportPath } from '@servisapp/contracts';
import { api } from '@/api/client';
import {
  useIncomeExpenseReport,
  useOccupancyReport,
  useReceivablesReport,
  useReportJob,
  useVehicleProfitReport,
} from '@/api/finance-hooks';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { downloadReport, formatDate, formatMoney, formatMonth, isNegative } from '@/lib/money';
import { t } from '@/i18n';

/**
 * The four reports of FR-FIN-230 to FR-FIN-270, with FR-FIN-280's exports.
 *
 * ## Every figure is rendered, none is computed
 *
 * The tables below read totals straight off the DTO. Not one `reduce` appears in this
 * file: a total summed in the browser could disagree with the total in the PDF the same
 * endpoint produces, and "the report says two different things" is the failure the shared
 * template and server-side totals exist to prevent (SDD §11.6, §1.2 P2).
 *
 * ## A long range comes back as a job — and so does every PDF
 *
 * NFR-PER-080. The server decides from the span; the screen notices it received a
 * {@link ReportJob} instead of a report and switches to polling. Phase 10 added the
 * second case: a PDF export is always a job, whatever range it covers, because rendering
 * one launches a browser and that lives in the worker (SDD §2.2, §11.6).
 */
export function ReportsPage() {
  const [range, setRange] = useState({ from: defaultFrom(), to: defaultTo() });

  return (
    <>
      <PageHeader title={t('finance.report.title')} />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{t('common.from')}</span>
          <Input
            type="date"
            value={range.from}
            onChange={(event) => setRange({ ...range, from: event.target.value })}
            className="w-44"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{t('common.to')}</span>
          <Input
            type="date"
            value={range.to}
            onChange={(event) => setRange({ ...range, to: event.target.value })}
            className="w-44"
          />
        </label>
      </div>

      <Tabs defaultValue="income-expense">
        <TabsList>
          <TabsTrigger value="income-expense">{t('finance.report.incomeExpense')}</TabsTrigger>
          <TabsTrigger value="receivables">{t('finance.report.receivables')}</TabsTrigger>
          <TabsTrigger value="vehicle-profit">{t('finance.report.vehicleProfit')}</TabsTrigger>
          <TabsTrigger value="occupancy">{t('finance.report.occupancy')}</TabsTrigger>
        </TabsList>

        <TabsContent value="income-expense">
          <IncomeExpensePanel range={range} />
        </TabsContent>
        <TabsContent value="receivables">
          <ReceivablesPanel />
        </TabsContent>
        <TabsContent value="vehicle-profit">
          <VehicleProfitPanel range={range} />
        </TabsContent>
        <TabsContent value="occupancy">
          <OccupancyPanel />
        </TabsContent>
      </Tabs>
    </>
  );
}

interface Range {
  from: string;
  to: string;
  /** Index signature so a range can be handed straight to the export query. */
  [key: string]: string;
}

/** True when the endpoint answered with a dispatched job rather than a report. */
function isJob(value: unknown): value is ReportJob {
  return typeof value === 'object' && value !== null && 'status' in value && 'kind' in value;
}

/**
 * FR-FIN-280 — Excel and PDF, from the same endpoint the table was drawn from.
 *
 * ## The two buttons no longer do the same thing
 *
 * Excel is fetched and saved, as before. **PDF is dispatched**: the server answers 202
 * with a {@link ReportJob} because rendering one launches a headless Chromium, which
 * belongs in the worker replica set and not on a request path (SDD §2.2, §11.6). Before
 * Phase 10 this button downloaded a structurally-valid *stub* in production — the API
 * had only the deterministic fake bound — so the change is a fix rather than a
 * regression in convenience.
 */
function ExportButtons({
  report,
  query,
  filename,
}: {
  report: FinanceReportPath;
  query: Record<string, string | number | boolean | undefined>;
  filename: string;
}) {
  const [busy, setBusy] = useState<'XLSX' | 'PDF' | null>(null);
  const [job, setJob] = useState<ReportJob | null>(null);

  async function saveExcel() {
    setBusy('XLSX');
    try {
      await downloadReport(
        `/finance/reports/${report}`,
        { ...query, format: 'XLSX' },
        `${filename}.xlsx`,
      );
    } finally {
      setBusy(null);
    }
  }

  async function requestPdf() {
    setBusy('PDF');
    try {
      setJob(await api.finance.reports.exportPdf(report, query));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mb-3 flex flex-col items-end gap-2">
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => void saveExcel()}>
          <FileSpreadsheet className="mr-2 size-4" />
          {t('finance.report.exportExcel')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={busy !== null}
          onClick={() => void requestPdf()}
        >
          <Download className="mr-2 size-4" />
          {t('finance.report.exportPdf')}
        </Button>
      </div>

      {job ? (
        <div className="w-full max-w-md">
          <QueuedReport job={job} />
        </div>
      ) : null}
    </div>
  );
}

/** NFR-PER-080 — the asynchronous path, polled until it settles. */
function QueuedReport({ job }: { job: ReportJob }) {
  const polled = useReportJob(job.id);
  const current = polled.data ?? job;

  if (current.status === 'READY' && current.downloadUrl) {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm">
        <p className="mb-2 font-medium text-emerald-900">{t('finance.report.jobReady')}</p>
        <Button size="sm" onClick={() => window.open(current.downloadUrl as string, '_blank')}>
          <Download className="mr-2 size-4" />
          {t('common.download')}
        </Button>
      </div>
    );
  }

  if (current.status === 'FAILED') {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        {t('finance.report.jobFailed')}
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-muted/40 p-4 text-sm">
      <p className="font-medium">{t('finance.report.queued')}</p>
      <p className="text-muted-foreground">{t('finance.report.queuedHelp')}</p>
    </div>
  );
}

function IncomeExpensePanel({ range }: { range: Range }) {
  const query = useIncomeExpenseReport({ ...range, async: false });

  if (query.isLoading) return <Loading />;
  if (isJob(query.data)) return <QueuedReport job={query.data} />;

  const report = query.data as IncomeExpenseReport | undefined;
  if (!report) return <Empty />;

  return (
    <>
      <ExportButtons report="income-expense" query={range} filename="gelir-gider" />

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left">
            <th className="p-2">{t('common.period')}</th>
            <th className="p-2 text-right">{t('finance.report.accruedIncome')}</th>
            <th className="p-2 text-right">{t('finance.report.collectedIncome')}</th>
            <th className="p-2 text-right">{t('finance.report.expenses')}</th>
            <th className="p-2 text-right">{t('finance.report.netCash')}</th>
          </tr>
        </thead>
        <tbody>
          {report.months.map((month) => (
            <tr key={month.month} className="border-b">
              <td className="p-2">{formatMonth(month.month)}</td>
              <td className="p-2 text-right tabular-nums">
                {formatMoney(month.accruedIncome, report.currency)}
              </td>
              <td className="p-2 text-right tabular-nums">
                {formatMoney(month.collectedIncome, report.currency)}
              </td>
              <td className="p-2 text-right tabular-nums">
                {formatMoney(month.expenses, report.currency)}
              </td>
              <td
                className={`p-2 text-right font-medium tabular-nums ${
                  isNegative(month.netCash) ? 'text-destructive' : ''
                }`}
              >
                {formatMoney(month.netCash, report.currency)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 font-semibold">
            <td className="p-2">{t('common.total')}</td>
            <td className="p-2 text-right tabular-nums">
              {formatMoney(report.totals.accruedIncome, report.currency)}
            </td>
            <td className="p-2 text-right tabular-nums">
              {formatMoney(report.totals.collectedIncome, report.currency)}
            </td>
            <td className="p-2 text-right tabular-nums">
              {formatMoney(report.totals.expenses, report.currency)}
            </td>
            <td className="p-2 text-right tabular-nums">
              {formatMoney(report.totals.netCash, report.currency)}
            </td>
          </tr>
        </tfoot>
      </table>

      <h3 className="mb-2 mt-6 font-medium">{t('finance.report.byCategory')}</h3>
      <ul className="divide-y text-sm">
        {report.expensesByCategory.map((row) => (
          <li key={row.category} className="flex justify-between py-2">
            <span>{t(`finance.expense.categories.${row.category}`)}</span>
            <span className="tabular-nums">{formatMoney(row.amount, report.currency)}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

function ReceivablesPanel() {
  const query = useReceivablesReport({ sort: 'AGE', dir: 'desc', async: false });

  if (query.isLoading) return <Loading />;
  if (isJob(query.data)) return <QueuedReport job={query.data} />;

  const report = query.data as ReceivablesReport | undefined;
  if (!report) return <Empty />;

  return (
    <>
      <ExportButtons
        report="receivables"
        query={{ sort: 'AGE', dir: 'desc' }}
        filename="alacaklar"
      />

      <div className="mb-4 flex gap-6 rounded-md border bg-muted/40 p-3 text-sm">
        <div>
          <p className="text-muted-foreground">{t('common.total')}</p>
          <p className="font-semibold tabular-nums">
            {formatMoney(report.totals.balance, report.currency)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">{t('finance.instalment.statuses.OVERDUE')}</p>
          <p className="font-semibold tabular-nums text-destructive">
            {formatMoney(report.totals.overdueBalance, report.currency)}
          </p>
        </div>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left">
            <th className="p-2">{t('finance.student')}</th>
            <th className="p-2">{t('common.dueDate')}</th>
            <th className="p-2 text-right">{t('finance.instalment.daysOverdue')}</th>
            <th className="p-2 text-right">{t('common.balance')}</th>
            <th className="p-2">{t('finance.report.guardian')}</th>
            <th className="p-2">{t('finance.report.guardianPhone')}</th>
          </tr>
        </thead>
        <tbody>
          {report.rows.map((row) => (
            <tr key={row.instalmentId} className="border-b">
              <td className="p-2 font-medium">{row.studentName}</td>
              <td className="p-2">{formatDate(row.dueDate)}</td>
              <td className="p-2 text-right tabular-nums">
                {row.daysOverdue > 0 ? row.daysOverdue : '—'}
              </td>
              <td className="p-2 text-right font-medium tabular-nums">
                {formatMoney(row.balance, report.currency)}
              </td>
              <td className="p-2">{row.guardianName ?? '—'}</td>
              <td className="p-2 tabular-nums">{row.guardianPhone ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function VehicleProfitPanel({ range }: { range: Range }) {
  const query = useVehicleProfitReport({ ...range, async: false });

  if (query.isLoading) return <Loading />;
  if (isJob(query.data)) return <QueuedReport job={query.data} />;

  const report = query.data as VehicleProfitabilityReport | undefined;
  if (!report) return <Empty />;

  return (
    <>
      <ExportButtons report="vehicle-profit" query={range} filename="arac-karlilik" />

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left">
            <th className="p-2">{t('finance.vehicle')}</th>
            <th className="p-2 text-right">{t('finance.report.accruedRevenue')}</th>
            <th className="p-2 text-right">{t('finance.report.collectedRevenue')}</th>
            <th className="p-2 text-right">{t('finance.report.directExpenses')}</th>
            <th className="p-2 text-right">{t('finance.report.apportionedOverhead')}</th>
            <th className="p-2 text-right">{t('finance.report.accruedProfit')}</th>
            <th className="p-2 text-right">{t('finance.report.cashProfit')}</th>
          </tr>
        </thead>
        <tbody>
          {report.rows.map((row) => (
            <tr key={row.vehicleId} className="border-b">
              <td className="p-2 font-medium">{row.plate}</td>
              <td className="p-2 text-right tabular-nums">
                {formatMoney(row.accruedRevenue, report.currency)}
              </td>
              <td className="p-2 text-right tabular-nums">
                {formatMoney(row.collectedRevenue, report.currency)}
              </td>
              <td className="p-2 text-right tabular-nums">
                {formatMoney(row.directExpenses, report.currency)}
              </td>
              <td className="p-2 text-right tabular-nums">
                {formatMoney(row.apportionedOverhead, report.currency)}
              </td>
              <td
                className={`p-2 text-right font-medium tabular-nums ${
                  isNegative(row.accruedProfit) ? 'text-destructive' : ''
                }`}
              >
                {formatMoney(row.accruedProfit, report.currency)}
              </td>
              <td
                className={`p-2 text-right tabular-nums ${
                  isNegative(row.cashProfit) ? 'text-destructive' : ''
                }`}
              >
                {formatMoney(row.cashProfit, report.currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-4 text-xs text-muted-foreground">{t('finance.report.revenueNote')}</p>
    </>
  );
}

function OccupancyPanel() {
  const query = useOccupancyReport({ async: false });

  if (query.isLoading) return <Loading />;
  if (isJob(query.data)) return <QueuedReport job={query.data} />;

  const report = query.data as OccupancyReport | undefined;
  if (!report) return <Empty />;

  return (
    <>
      <ExportButtons report="occupancy" query={{}} filename="doluluk" />

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left">
            <th className="p-2">{t('finance.vehicle')}</th>
            <th className="p-2 text-right">{t('finance.report.capacity')}</th>
            <th className="p-2 text-right">{t('finance.report.assigned')}</th>
            <th className="p-2 text-right">{t('finance.report.utilisation')}</th>
            <th className="p-2">{t('common.status')}</th>
          </tr>
        </thead>
        <tbody>
          {report.rows.map((row) => (
            <tr key={row.vehicleId} className="border-b">
              <td className="p-2 font-medium">{row.plate}</td>
              <td className="p-2 text-right tabular-nums">{row.capacity}</td>
              <td className="p-2 text-right tabular-nums">{row.assigned}</td>
              <td className="p-2 text-right tabular-nums">%{row.utilisationPercent}</td>
              <td className="p-2">
                {row.overCapacity ? (
                  <Badge variant="destructive">{t('finance.report.overCapacity')}</Badge>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-4 text-xs text-muted-foreground">
        {t('finance.report.averageAttendance')}: {t('finance.report.attendancePending')}
      </p>
    </>
  );
}

function Loading() {
  return <p className="p-6 text-sm text-muted-foreground">{t('common.loading')}</p>;
}

function Empty() {
  return <EmptyState title={t('finance.report.title')} body={t('finance.report.empty')} />;
}

/** The start of the current academic year, which is the range an Admin usually wants. */
function defaultFrom(): string {
  const now = new Date();
  const year = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;

  return `${year}-09-01`;
}

function defaultTo(): string {
  return new Date().toISOString().slice(0, 10);
}
