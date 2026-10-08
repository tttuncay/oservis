import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus, Upload } from 'lucide-react';
import { STUDENT_SORT_COLUMNS, type Student } from '@servisapp/shared';
import { api } from '@/api/client';
import { keys, useResourceMutation, useSchools, useStudents } from '@/api/hooks';
import { useListState } from '@/api/use-list-state';
import { DataTable } from '@/components/DataTable';
import { ChoiceFilter, SearchInput, StatusFilter } from '@/components/ListFilters';
import { MutatingButton } from '@/components/MutatingButton';
import { PageHeader } from '@/components/PageHeader';
import { useConfirm } from '@/components/ConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StudentDialog } from './StudentDialog';
import { t } from '@/i18n';

/** FR-CMP-050 — the student list, filtered by school, class and status. */
export function StudentsPage() {
  const navigate = useNavigate();

  const list = useListState({
    initialFilters: {
      search: undefined as string | undefined,
      status: undefined as 'ACTIVE' | 'INACTIVE' | undefined,
      schoolId: undefined as string | undefined,
    },
    sortableColumns: STUDENT_SORT_COLUMNS,
    defaultSort: { column: 'fullName', direction: 'asc' },
  });

  const query = useStudents(list.query);
  const schools = useSchools({ limit: 100, sort: 'name', dir: 'asc' });
  const [creating, setCreating] = useState(false);

  const remove = useResourceMutation(
    (id: string) => api.students.remove(id),
    [keys.students, keys.routeTemplates],
  );

  const confirm = useConfirm<Student>({
    title: (student) => t('confirm.deleteTitle', { name: student.fullName }),
    body: () => t('confirm.deleteBody'),
    onConfirm: (student) => remove.mutateAsync(student.id),
    pending: remove.isPending,
  });

  const columns: ColumnDef<Student, unknown>[] = [
    {
      id: 'fullName',
      header: t('student.fullName'),
      cell: ({ row }) => <span className="font-medium">{row.original.fullName}</span>,
    },
    { id: 'schoolName', header: t('student.school'), cell: ({ row }) => row.original.schoolName },
    {
      id: 'className',
      header: t('student.className'),
      cell: ({ row }) => row.original.className ?? t('common.notSet'),
    },
    {
      id: 'externalRef',
      header: t('student.externalRef'),
      cell: ({ row }) => row.original.externalRef ?? t('common.notSet'),
    },
    {
      id: 'status',
      header: t('common.status'),
      cell: ({ row }) => (
        <Badge variant={row.original.status === 'ACTIVE' ? 'default' : 'secondary'}>
          {t(`status.${row.original.status}`)}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: t('common.actions'),
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              navigate(`/admin/students/${row.original.id}`);
            }}
          >
            {t('common.details')}
          </Button>
          <MutatingButton
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={(event) => {
              event.stopPropagation();
              confirm.ask(row.original);
            }}
          >
            {t('common.delete')}
          </MutatingButton>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t('student.title')}
        actions={
          <>
            <Button variant="outline" className="gap-1.5" onClick={() => navigate('import')}>
              <Upload aria-hidden className="h-4 w-4" />
              {t('import.title')}
            </Button>
            <MutatingButton onClick={() => setCreating(true)} className="gap-1.5">
              <Plus aria-hidden className="h-4 w-4" />
              {t('student.create')}
            </MutatingButton>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <SearchInput value={list.filters.search} onChange={(search) => list.setFilters({ search })} />
        <ChoiceFilter
          label={t('student.school')}
          width="w-64"
          value={list.filters.schoolId}
          onChange={(schoolId) => list.setFilters({ schoolId })}
          options={(schools.data?.data ?? []).map((school) => ({
            value: school.id,
            label: school.name,
          }))}
        />
        <StatusFilter
          value={list.filters.status}
          onChange={(status) => list.setFilters({ status })}
        />
      </div>

      <DataTable
        columns={columns}
        rows={query.data?.data ?? []}
        sort={list.sort}
        onSortChange={list.setSort}
        sortableColumns={list.sortableColumns}
        loading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        emptyTitle={t('student.emptyTitle')}
        emptyBody={t('student.emptyBody')}
        filtered={list.filtered}
        hasNextPage={query.data?.nextCursor !== null}
        onNextPage={() => list.nextPage(query.data?.nextCursor ?? null)}
        onFirstPage={list.firstPage}
        canGoBack={list.canGoBack}
        onRowClick={(student) => navigate(`/admin/students/${student.id}`)}
      />

      {confirm.dialog}
      {creating ? <StudentDialog student={null} onClose={() => setCreating(false)} /> : null}
    </>
  );
}
