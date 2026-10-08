import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download, FileSpreadsheet } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import type { StudentImportReport } from '@servisapp/shared';
import { api } from '@/api/client';
import { keys, useResourceMutation } from '@/api/hooks';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { MutatingButton } from '@/components/MutatingButton';
import { ErrorState } from '@/components/ErrorState';
import { PageHeader } from '@/components/PageHeader';
import { parsePreview, type PreviewTable } from './parse-preview';
import { t } from '@/i18n';

/**
 * FR-CMP-110 — bulk student import: client-side parse and preview, server-side
 * validation, row-level error report (SDD §15.2).
 *
 * The three stages are deliberately separate screens' worth of state on one page,
 * because the Admin's question changes at each: *does my file look right* → *what got
 * in* → *what is still being looked up*.
 */
export function StudentImportPage() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewTable | null>(null);
  const [report, setReport] = useState<StudentImportReport | null>(null);

  const upload = useResourceMutation(
    (chosen: File) => api.students.import(chosen),
    [keys.students],
  );

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-2 gap-1.5">
        <Link to="/admin/students">
          <ArrowLeft aria-hidden className="h-4 w-4" />
          {t('common.back')}
        </Link>
      </Button>

      <PageHeader
        title={t('import.title')}
        description={t('import.description')}
        actions={
          <Button variant="outline" className="gap-1.5" onClick={() => void downloadTemplate()}>
            <Download aria-hidden className="h-4 w-4" />
            {t('import.downloadTemplate')}
          </Button>
        }
      />

      <div className="max-w-4xl space-y-6">
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <input
              ref={fileInput}
              type="file"
              accept=".csv,.xlsx,text/csv"
              className="hidden"
              onChange={async (event) => {
                const chosen = event.target.files?.[0] ?? null;
                setFile(chosen);
                setReport(null);
                setPreview(chosen ? await parsePreview(chosen) : null);
                event.target.value = '';
              }}
            />
            <MutatingButton
              variant="outline"
              className="gap-1.5"
              onClick={() => fileInput.current?.click()}
            >
              <FileSpreadsheet aria-hidden className="h-4 w-4" />
              {t('import.chooseFile')}
            </MutatingButton>

            {file ? (
              <span className="text-sm text-muted-foreground">
                {t('import.selectedFile', { name: file.name })}
              </span>
            ) : null}

            {file ? (
              <MutatingButton
                className="ml-auto"
                disabled={upload.isPending}
                onClick={async () => {
                  setReport(await upload.mutateAsync(file));
                }}
              >
                {upload.isPending ? t('import.uploading') : t('import.upload')}
              </MutatingButton>
            ) : null}
          </CardContent>
        </Card>

        {upload.error ? <ErrorState error={upload.error} /> : null}

        {preview && !report ? <PreviewCard preview={preview} /> : null}
        {report ? <ReportCard report={report} /> : null}
      </div>
    </>
  );
}

async function downloadTemplate(): Promise<void> {
  const blob = await api.students.importTemplate();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'servisapp-ogrenci-sablonu.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}

/** The columns as the file has them, so a misalignment is visible before the upload. */
function PreviewCard({ preview }: { preview: PreviewTable }) {
  if (preview.unreadable) {
    // An `.xlsx` the browser cannot read. The server parses it perfectly well, so this
    // says so rather than refusing the upload.
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('import.preview')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t('import.previewDescription')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('import.preview')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{t('import.previewDescription')}</p>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {preview.headers.map((header, index) => (
                  <TableHead key={`${header}-${index}`}>{header}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.rows.map((row, rowIndex) => (
                <TableRow key={rowIndex}>
                  {preview.headers.map((_header, cellIndex) => (
                    <TableCell key={cellIndex}>{row[cellIndex] ?? ''}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * The FR-CMP-110 report: *"a validation report identifying rejected rows and reasons"*.
 *
 * The row number is the one in the spreadsheet, header included, so an Admin can open the
 * file and go straight to it. Field-level detail is shown where the failure was a
 * validation one, because "row 43 is invalid" is not actionable and "row 43: telephone"
 * is.
 *
 * Exported for `StudentImportPage.spec.tsx`. The alternative was to drive the page's file
 * input and its upload mutation to reach this table, which would have made a test about
 * *what a rejected row says* depend on a `File`, a `FormData` and a stubbed multipart
 * response — three things that have nothing to do with the requirement.
 */
export function ReportCard({ report }: { report: StudentImportReport }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('import.resultTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-6 text-sm">
          <Figure label={t('import.totalRows')} value={report.totalRows} />
          <Figure label={t('import.imported')} value={report.imported} />
          <Figure label={t('import.skipped')} value={report.skipped} hint={t('import.skippedHint')} />
          <Figure label={t('import.rejected')} value={report.rejected.length} />
        </div>

        {report.geocodingQueued > 0 ? (
          <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            {t('import.geocodingQueued', { count: report.geocodingQueued })}
          </p>
        ) : null}

        {report.rejected.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">{t('import.rejectedTitle')}</p>
            <div className="max-h-96 overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">{t('import.rowNumber')}</TableHead>
                    <TableHead>{t('import.reason')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.rejected.map((rejection) => (
                    <TableRow key={rejection.row}>
                      <TableCell className="tabular-nums">{rejection.row}</TableCell>
                      <TableCell className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="destructive">
                            {t(`import.rejection${rejection.code}`)}
                          </Badge>
                          {/* The server's Turkish sentence, not its code (NFR-USA-060). */}
                          <span className="text-sm">{rejection.message}</span>
                        </div>
                        {rejection.fields?.length ? (
                          <ul className="pl-1 text-xs text-muted-foreground">
                            {rejection.fields.map((field) => (
                              <li key={field.field}>
                                {field.field}: {field.message}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Figure({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="space-y-0.5" title={hint}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

/**
 * SDD §21 TI-08's progress report, for the addresses queued behind the import.
 *
 * Exported separately because it polls, and a component that polls should be mounted
 * deliberately rather than as a side effect of rendering a report.
 */
export function ImportProgress({ importId }: { importId: string }) {
  const query = useQuery({
    queryKey: ['students', 'import', importId] as const,
    queryFn: () => api.students.importProgress(importId),
    // Geocoding is rate-limited on the worker (SDD §21 TI-08), so a five-second poll is
    // faster than the work can complete and stops on its own when it does.
    refetchInterval: (result) => (result.state.data?.complete ? false : 5_000),
  });

  const progress = query.data;
  if (!progress) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('import.progressTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-6 text-sm">
        <span>{t('import.progressResolved', { count: progress.resolved })}</span>
        <span>{t('import.progressPending', { count: progress.pending })}</span>
        <span>{t('import.progressFailed', { count: progress.failed })}</span>
        {progress.complete ? (
          <p className="basis-full text-muted-foreground">{t('import.progressComplete')}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
