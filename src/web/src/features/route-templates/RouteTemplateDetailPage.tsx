import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Edit2 } from 'lucide-react';
import type { RouteTemplateDetail } from '@servisapp/shared';
import { api } from '@/api/client';
import { keys, useResourceMutation, useRouteTemplate, useStudents } from '@/api/hooks';
import { ErrorState } from '@/components/ErrorState';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { MutatingButton } from '@/components/MutatingButton';
import { useConfirm } from '@/components/ConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CapacityBadge } from './CapacityBadge';
import { RouteTemplateDialog, formatDays } from './RouteTemplateDialog';
import { t } from '@/i18n';

/** FR-CMP-080 — the route's student list, with FR-CMP-090's warning above it. */
export function RouteTemplateDetailPage() {
  const { templateId } = useParams<{ templateId: string }>();
  const query = useRouteTemplate(templateId);
  const [editing, setEditing] = useState(false);

  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;

  const template = query.data;
  if (!template) return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>;

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-2 gap-1.5">
        <Link to="/admin/route-templates">
          <ArrowLeft aria-hidden className="h-4 w-4" />
          {t('common.back')}
        </Link>
      </Button>

      <PageHeader
        title={template.name ?? template.vehiclePlate}
        description={`${template.schoolName} · ${t(`direction.${template.direction}`)} · ${template.vehiclePlate}`}
        actions={
          <div className="flex items-center gap-2">
            <CapacityBadge capacity={template.capacity} />
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditing(true)}>
              <Edit2 aria-hidden className="h-4 w-4" />
              {t('common.edit')}
            </Button>
          </div>
        }
      />

      <RouteOverviewCard template={template} />

      {/* The warning where the action that caused it happens, not on a later page load. */}
      {template.capacity.overCapacity ? (
        <div
          role="alert"
          className="mb-4 flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900"
        >
          <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="space-y-0.5 text-sm">
            <p className="font-medium">{t('capacity.overTitle')}</p>
            <p>{t('capacity.overBody', { overBy: template.capacity.overBy })}</p>
          </div>
        </div>
      ) : null}

      <StudentsPanel template={template} />

      {editing ? <RouteTemplateDialog template={template} onClose={() => setEditing(false)} /> : null}
    </>
  );
}

function RouteOverviewCard({ template }: { template: RouteTemplateDetail }) {
  const figures: [string, React.ReactNode][] = [
    [t('routeTemplate.school'), template.schoolName],
    [t('routeTemplate.direction'), t(`direction.${template.direction}`)],
    [t('routeTemplate.vehicle'), template.vehiclePlate],
    [t('routeTemplate.driver'), template.driverName ?? <span className="text-muted-foreground">—</span>],
    [t('routeTemplate.host'), template.hostName ?? <span className="text-muted-foreground">—</span>],
    [t('routeTemplate.departureTime'), template.departureTime ?? <span className="text-muted-foreground">—</span>],
    [t('routeTemplate.daysOfWeek'), formatDays(template.daysOfWeek)],
    [
      t('common.status'),
      <Badge key="status" variant={template.active ? 'default' : 'secondary'}>
        {template.active ? t('status.ACTIVE') : t('status.INACTIVE')}
      </Badge>,
    ],
  ];

  return (
    <dl className="mb-4 grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border p-4 text-sm sm:grid-cols-4 lg:grid-cols-8">
      {figures.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="mt-0.5 font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function StudentsPanel({ template }: { template: RouteTemplateDetail }) {
  const [adding, setAdding] = useState<string>('');
  const [filterSchool, setFilterSchool] = useState(true);

  const addStudents = useResourceMutation(
    (studentId: string) => api.routeTemplates.addStudents(template.id, { studentIds: [studentId] }),
    [keys.routeTemplates],
  );

  const removeStudent = useResourceMutation(
    (studentId: string) => api.routeTemplates.removeStudent(template.id, studentId),
    [keys.routeTemplates],
  );

  const confirm = useConfirm<{ id: string; fullName: string }>({
    title: (student) => t('confirm.deleteTitle', { name: student.fullName }),
    body: () => t('routeTemplate.removeStudent'),
    onConfirm: (student) => removeStudent.mutateAsync(student.id),
    pending: removeStudent.isPending,
  });

  const candidatesQuery = useStudents({
    schoolId: filterSchool ? template.schoolId : undefined,
    limit: 100,
    sort: 'fullName',
    dir: 'asc',
  });

  const already = useMemo(
    () => new Set(template.students.map((student) => student.id)),
    [template.students],
  );

  const options = useMemo(() => {
    return (candidatesQuery.data?.data ?? []).filter((student) => !already.has(student.id));
  }, [candidatesQuery.data?.data, already]);

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={adding} onValueChange={setAdding}>
            <SelectTrigger className="w-80" aria-label={t('routeTemplate.addStudents')}>
              <SelectValue placeholder={t('routeTemplate.addStudents')} />
            </SelectTrigger>
            <SelectContent>
              {options.length === 0 ? (
                <div className="py-2 px-3 text-xs text-muted-foreground">
                  {filterSchool
                    ? 'Bu okula kayıtlı eklenebilir öğrenci yok.'
                    : 'Eklenebilir öğrenci bulunamadı.'}
                </div>
              ) : (
                options.map((student) => (
                  <SelectItem key={student.id} value={student.id}>
                    {student.fullName}
                    {student.className ? ` (${student.className})` : ''}
                    {student.schoolName && student.schoolId !== template.schoolId
                      ? ` · ${student.schoolName}`
                      : ''}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>

          <MutatingButton
            disabled={adding === '' || addStudents.isPending}
            onClick={async () => {
              await addStudents.mutateAsync(adding);
              setAdding('');
            }}
          >
            {t('common.add')}
          </MutatingButton>

          <label className="flex cursor-pointer select-none items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <input
              type="checkbox"
              checked={filterSchool}
              onChange={(e) => setFilterSchool(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-input text-primary focus:ring-primary"
            />
            <span>Yalnızca bu okulun öğrencileri</span>
          </label>
        </div>

        {filterSchool && options.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Bu okula kayıtlı eklenebilir öğrenci bulunamadı. Şirketinizdeki diğer öğrencileri görmek için yukarıdaki kutucuğun işaretini kaldırabilirsiniz.
          </p>
        ) : null}

        {addStudents.error ? <ErrorState error={addStudents.error} /> : null}

        {template.students.length === 0 ? (
          <EmptyState
            title={t('routeTemplate.studentsEmptyTitle')}
            body={t('routeTemplate.studentsEmptyBody')}
          />
        ) : (
          <ul className="divide-y rounded-md border">
            {template.students.map((student) => (
              <li key={student.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                <Link
                  to={`/admin/students/${student.id}`}
                  className="min-w-0 flex-1 truncate font-medium hover:underline"
                >
                  {student.fullName}
                </Link>
                <span className="text-muted-foreground">
                  {student.className ?? t('common.notSet')}
                </span>
                <MutatingButton
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => confirm.ask(student)}
                >
                  {t('common.remove')}
                </MutatingButton>
              </li>
            ))}
          </ul>
        )}

        {confirm.dialog}
      </CardContent>
    </Card>
  );
}
