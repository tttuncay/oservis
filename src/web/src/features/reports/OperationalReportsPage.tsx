import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import type {
  AttendanceReportRow,
  CrewActivityReportRow,
  ExceptionKind,
  ExceptionReportRow,
  PunctualityReportRow,
  ReportJob,
} from '@servisapp/shared';
import { api } from '@/api/client';
import {
  useAttendanceReport,
  useCrewActivityReport,
  useExceptionReport,
  useOperationalReportJob,
  usePunctualityReport,
  useSchools,
  useVehicles,
} from '@/api/hooks';
import { DataTable } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { downloadReport } from '@/lib/money';
import { t } from '@/i18n';

type ReportTab = 'attendance' | 'punctuality' | 'crew-activity' | 'exceptions';

/**
 * FR-RPT-030 … FR-RPT-070 — the four operational reports on one screen.
 *
 * ## Tabs rather than four routes
 *
 * The four answer one question — *"how did the service run over this period"* — from one
 * date range, and an Admin comparing a fortnight's punctuality against the same
 * fortnight's exceptions should not be re-entering the dates. The range is held here and
 * shared; only the tab changes.
 *
 * ## Only the visible report is fetched
 *
 * Each hook is `enabled` on its own tab. Fetching all four on mount would be exactly the
 * fan-out SDD §15.3 forbids on the dashboard, applied to a screen where three of the four
 * answers would be thrown away.
 *
 * ## Export goes to the same route with `?format=`
 *
 * FR-RPT-070. The export sends the *current* filters, so what is saved is what is on
 * screen — there is no second query path and no way for the two to disagree (SDD §11.6,
 * and the arrangement the finance reports already use). Excel comes back as a file; a
 * PDF comes back as a job to poll, because rendering one belongs in the worker (SDD
 * §2.2, §11.6).
 */
export function OperationalReportsPage() {
  const [tab, setTab] = useState<ReportTab>('attendance');
  const [range, setRange] = useState(defaultRange);
  const [schoolId, setSchoolId] = useState<string | undefined>(undefined);
  const [vehicleId, setVehicleId] = useState<string | undefined>(undefined);

  const schools = useSchools({ limit: 100, sort: 'name', dir: 'asc', status: 'ACTIVE' });
  const vehicles = useVehicles({ limit: 100, sort: 'plate', dir: 'asc' });

  const attendanceQuery = { ...range, ...(schoolId ? { schoolId } : {}) };
  const punctualityQuery = { ...range, ...(vehicleId ? { vehicleId } : {}) };

  const attendance = useAttendanceReport(attendanceQuery, tab === 'attendance');
  const punctuality = usePunctualityReport(punctualityQuery, tab === 'punctuality');
  const crew = useCrewActivityReport(range, tab === 'crew-activity');
  const exceptions = useExceptionReport(range, tab === 'exceptions');

  const filtersFor = (which: ReportTab): Record<string, string | undefined> => {
    if (which === 'attendance') return attendanceQuery;
    if (which === 'punctuality') return punctualityQuery;
    return range;
  };

  return (
    <>
      <PageHeader title={t('reports.title')} />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <DateField
          label={t('common.from')}
          value={range.from}
          onChange={(from) => setRange((current) => ({ ...current, from }))}
        />
        <DateField
          label={t('common.to')}
          value={range.to}
          onChange={(to) => setRange((current) => ({ ...current, to }))}
        />

        {tab === 'attendance' ? (
          <Filter
            label={t('reports.school')}
            allLabel={t('reports.allSchools')}
            value={schoolId}
            onChange={setSchoolId}
            options={(schools.data?.data ?? []).map((school) => ({
              value: school.id,
              label: school.name,
            }))}
          />
        ) : null}

        {tab === 'punctuality' ? (
          <Filter
            label={t('reports.vehicle')}
            allLabel={t('reports.allVehicles')}
            value={vehicleId}
            onChange={setVehicleId}
            options={(vehicles.data?.data ?? []).map((vehicle) => ({
              value: vehicle.id,
              label: vehicle.plate,
            }))}
          />
        ) : null}

        <ExportButtons report={tab} filters={filtersFor(tab)} />
      </div>

      <Tabs value={tab} onValueChange={(next) => setTab(next as ReportTab)}>
        <TabsList>
          <TabsTrigger value="attendance">{t('reports.attendance')}</TabsTrigger>
          <TabsTrigger value="punctuality">{t('reports.punctuality')}</TabsTrigger>
          <TabsTrigger value="crew-activity">{t('reports.crewActivity')}</TabsTrigger>
          <TabsTrigger value="exceptions">{t('reports.exceptions')}</TabsTrigger>
        </TabsList>

        <TabsContent value="attendance" className="mt-4">
          {attendance.data ? (
            <Totals
              entries={[
                [t('document.attendance.students'), String(attendance.data.totals.students)],
                [t('document.attendance.boarded'), String(attendance.data.totals.boarded)],
                [t('document.attendance.noShow'), String(attendance.data.totals.noShow)],
                [
                  t('document.attendance.rate'),
                  attendance.data.totals.attendanceRate === null
                    ? t('crm.noRate')
                    : `%${attendance.data.totals.attendanceRate}`,
                ],
              ]}
            />
          ) : null}
          <DataTable
            columns={ATTENDANCE_COLUMNS}
            rows={attendance.data?.rows ?? []}
            loading={attendance.isPending}
            error={attendance.error}
            onRetry={() => void attendance.refetch()}
            emptyTitle={t('reports.attendance')}
            emptyBody={t('reports.empty')}
          />
        </TabsContent>

        <TabsContent value="punctuality" className="mt-4">
          {punctuality.data ? (
            <Totals
              entries={[
                [t('document.punctuality.stops'), String(punctuality.data.totals.stops)],
                [t('document.punctuality.onTime'), String(punctuality.data.totals.onTime)],
                [t('document.punctuality.late'), String(punctuality.data.totals.late)],
                [t('document.punctuality.skipped'), String(punctuality.data.totals.skipped)],
                [
                  t('document.punctuality.averageDelta'),
                  punctuality.data.totals.averageDeltaMinutes ?? t('crm.noRate'),
                ],
              ]}
            />
          ) : null}
          <DataTable
            columns={PUNCTUALITY_COLUMNS}
            rows={punctuality.data?.rows ?? []}
            loading={punctuality.isPending}
            error={punctuality.error}
            onRetry={() => void punctuality.refetch()}
            emptyTitle={t('reports.punctuality')}
            emptyBody={t('reports.empty')}
          />
        </TabsContent>

        <TabsContent value="crew-activity" className="mt-4">
          {crew.data ? (
            <Totals
              entries={[
                [t('document.crewActivity.staffCount'), String(crew.data.totals.staff)],
                [t('document.crewActivity.trips'), String(crew.data.totals.tripsOperated)],
                [t('document.crewActivity.hours'), crew.data.totals.hoursInService],
              ]}
            />
          ) : null}
          <DataTable
            columns={CREW_COLUMNS}
            rows={crew.data?.rows ?? []}
            loading={crew.isPending}
            error={crew.error}
            onRetry={() => void crew.refetch()}
            emptyTitle={t('reports.crewActivity')}
            emptyBody={t('reports.empty')}
          />
        </TabsContent>

        <TabsContent value="exceptions" className="mt-4">
          {exceptions.data ? (
            <Totals
              entries={(Object.keys(exceptions.data.totals) as (ExceptionKind | 'all')[])
                .filter((kind): kind is ExceptionKind => kind !== 'all')
                .map((kind) => [
                  t(`exceptionKind.${kind}`),
                  String(exceptions.data.totals[kind]),
                ])}
            />
          ) : null}
          <DataTable
            columns={EXCEPTION_COLUMNS}
            rows={exceptions.data?.rows ?? []}
            loading={exceptions.isPending}
            error={exceptions.error}
            onRetry={() => void exceptions.refetch()}
            emptyTitle={t('reports.exceptions')}
            emptyBody={t('reports.empty')}
          />
        </TabsContent>
      </Tabs>
    </>
  );
}

// ---- Columns ---------------------------------------------------------------------------

const ATTENDANCE_COLUMNS: ColumnDef<AttendanceReportRow, unknown>[] = [
  { id: 'studentName', accessorKey: 'studentName', header: t('document.attendance.student') },
  { id: 'schoolName', accessorKey: 'schoolName', header: t('document.attendance.school') },
  {
    id: 'className',
    header: t('document.attendance.className'),
    cell: ({ row }) => row.original.className ?? '—',
  },
  { id: 'expected', accessorKey: 'expected', header: t('document.attendance.expected') },
  { id: 'boarded', accessorKey: 'boarded', header: t('document.attendance.boarded') },
  { id: 'noShow', accessorKey: 'noShow', header: t('document.attendance.noShow') },
  {
    id: 'absentDeclared',
    accessorKey: 'absentDeclared',
    header: t('document.attendance.absentDeclared'),
  },
  { id: 'unrecorded', accessorKey: 'unrecorded', header: t('document.attendance.unrecorded') },
  {
    id: 'attendanceRate',
    header: t('document.attendance.rate'),
    // `null` is a dash, never `0.0`: a rate over no trips is unknown, and zero would read
    // as a child who never once boarded.
    cell: ({ row }) =>
      row.original.attendanceRate === null ? '—' : `%${row.original.attendanceRate}`,
  },
];

const PUNCTUALITY_COLUMNS: ColumnDef<PunctualityReportRow, unknown>[] = [
  { id: 'serviceDate', accessorKey: 'serviceDate', header: t('document.punctuality.date') },
  {
    id: 'direction',
    header: t('document.punctuality.direction'),
    cell: ({ row }) => t(`direction.${row.original.direction}`),
  },
  { id: 'vehiclePlate', accessorKey: 'vehiclePlate', header: t('document.punctuality.vehicle') },
  { id: 'sequence', accessorKey: 'sequence', header: t('document.punctuality.sequence') },
  {
    id: 'stopLabel',
    header: t('document.punctuality.stop'),
    cell: ({ row }) => row.original.stopLabel ?? '—',
  },
  {
    id: 'plannedAt',
    header: t('document.punctuality.planned'),
    cell: ({ row }) => clock(row.original.plannedAt),
  },
  {
    id: 'actualAt',
    header: t('document.punctuality.actual'),
    cell: ({ row }) => clock(row.original.actualAt),
  },
  {
    id: 'deltaMinutes',
    header: t('document.punctuality.delta'),
    // Signed, with a leading `+` on a delay: an unsigned column would make the reader
    // remember which direction is late.
    cell: ({ row }) =>
      row.original.deltaMinutes === null
        ? '—'
        : `${row.original.deltaMinutes > 0 ? '+' : ''}${row.original.deltaMinutes}`,
  },
  {
    id: 'state',
    header: t('document.punctuality.state'),
    cell: ({ row }) => t(`stopState.${row.original.state}`),
  },
];

const CREW_COLUMNS: ColumnDef<CrewActivityReportRow, unknown>[] = [
  { id: 'staffName', accessorKey: 'staffName', header: t('document.crewActivity.staff') },
  {
    id: 'kind',
    header: t('document.crewActivity.role'),
    cell: ({ row }) => t(`role.${row.original.kind}`),
  },
  { id: 'tripsOperated', accessorKey: 'tripsOperated', header: t('document.crewActivity.trips') },
  { id: 'hoursInService', accessorKey: 'hoursInService', header: t('document.crewActivity.hours') },
  {
    id: 'studentsCarried',
    accessorKey: 'studentsCarried',
    header: t('document.crewActivity.students'),
  },
];

const EXCEPTION_COLUMNS: ColumnDef<ExceptionReportRow, unknown>[] = [
  {
    id: 'at',
    header: t('document.exceptions.when'),
    cell: ({ row }) => `${row.original.serviceDate} ${clock(row.original.at)}`,
  },
  {
    id: 'kind',
    header: t('document.exceptions.kind'),
    cell: ({ row }) => t(`exceptionKind.${row.original.kind}`),
  },
  { id: 'vehiclePlate', accessorKey: 'vehiclePlate', header: t('document.exceptions.vehicle') },
  { id: 'driverName', accessorKey: 'driverName', header: t('document.exceptions.driver') },
  {
    id: 'stopLabel',
    header: t('document.exceptions.stop'),
    cell: ({ row }) => row.original.stopLabel ?? '—',
  },
  {
    id: 'studentName',
    header: t('document.exceptions.student'),
    cell: ({ row }) => row.original.studentName ?? '—',
  },
  {
    id: 'detail',
    header: t('document.exceptions.detail'),
    cell: ({ row }) => row.original.detail ?? '—',
  },
];

// ---- Pieces ---------------------------------------------------------------------------

function Totals({ entries }: { entries: [string, string][] }) {
  return (
    <Card className="mb-4">
      <CardContent className="flex flex-wrap gap-6 pt-6">
        {entries.map(([label, value]) => (
          <div key={label}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-semibold">{value}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/**
 * FR-RPT-070 — the same report, as a file, with the filters that are on screen.
 *
 * Excel is fetched and saved. **PDF is dispatched** and polled: rendering one launches a
 * headless Chromium, which SDD §2.2 puts in the worker replica set — so before Phase 10
 * this button downloaded a structurally-valid stub in production, which is the defect it
 * now fixes rather than a convenience it removes.
 */
function ExportButtons({
  report,
  filters,
}: {
  report: ReportTab;
  filters: Record<string, string | undefined>;
}) {
  const [busy, setBusy] = useState<'XLSX' | 'PDF' | null>(null);
  const [job, setJob] = useState<ReportJob | null>(null);

  async function saveExcel() {
    setBusy('XLSX');
    try {
      await downloadReport(`/reports/${report}`, { ...filters, format: 'XLSX' }, `${report}.xlsx`);
    } finally {
      setBusy(null);
    }
  }

  async function requestPdf() {
    setBusy('PDF');
    try {
      setJob(
        await api.reporting.exportPdf(
          report,
          filters as unknown as Parameters<typeof api.reporting.exportPdf>[1],
        ),
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="ml-auto flex flex-col items-end gap-2">
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => void saveExcel()}>
          {t('reports.exportXlsx')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={busy !== null}
          onClick={() => void requestPdf()}
        >
          {t('reports.exportPdf')}
        </Button>
      </div>

      {job ? <QueuedExport job={job} /> : null}
    </div>
  );
}

/**
 * A dispatched PDF, polled until it settles — NFR-PER-080's shape, reused.
 *
 * The wording is the finance screen's, from the same catalogue: an Admin who has
 * exported a receivables report and then a punctuality one should not be told two
 * different things about the same mechanism.
 */
function QueuedExport({ job }: { job: ReportJob }) {
  const polled = useOperationalReportJob(job.id);
  const current = polled.data ?? job;

  if (current.status === 'READY' && current.downloadUrl) {
    return (
      <Button size="sm" onClick={() => window.open(current.downloadUrl as string, '_blank')}>
        {t('common.download')}
      </Button>
    );
  }

  if (current.status === 'FAILED') {
    return <p className="text-sm text-destructive">{t('finance.report.jobFailed')}</p>;
  }

  return <p className="text-sm text-muted-foreground">{t('finance.report.queued')}</p>;
}

function Filter({
  label,
  allLabel,
  value,
  onChange,
  options,
}: {
  label: string;
  allLabel: string;
  value: string | undefined;
  onChange: (next: string | undefined) => void;
  options: { value: string; label: string }[];
}) {
  const ALL = '__all__';

  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <Select
        value={value ?? ALL}
        onValueChange={(next) => onChange(next === ALL ? undefined : next)}
      >
        <SelectTrigger className="w-52" aria-label={label}>
          <SelectValue placeholder={allLabel} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{allLabel}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <input
        type="date"
        aria-label={label}
        className="h-9 rounded-md border bg-background px-2"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

/**
 * The last thirty days.
 *
 * A month is the period a transport company reviews: it matches the invoicing cycle and
 * it is long enough that a single bad morning does not dominate the punctuality figures.
 */
function defaultRange(): { from: string; to: string } {
  const today = new Date();
  const from = new Date(today);
  from.setUTCDate(from.getUTCDate() - 29);

  return { from: iso(from), to: iso(today) };
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** `HH:mm` in the company's zone (SDD §13). */
function clock(iso: string | null): string {
  if (!iso) return '—';

  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}
