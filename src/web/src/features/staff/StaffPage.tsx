import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import {
  STAFF_KINDS,
  STAFF_SORT_COLUMNS,
  createStaffSchema,
  type CreateStaffDto,
  type Staff,
  type StaffKind,
} from '@servisapp/shared';
import { api } from '@/api/client';
import { keys, useResourceMutation, useStaff } from '@/api/hooks';
import { useListState } from '@/api/use-list-state';
import { DataTable } from '@/components/DataTable';
import { ChoiceFilter, SearchInput, StatusFilter } from '@/components/ListFilters';
import { MutatingButton } from '@/components/MutatingButton';
import { PageHeader } from '@/components/PageHeader';
import { useConfirm } from '@/components/ConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FieldRow, Form, SelectField, TextField } from '@/components/FormKit';
import { t } from '@/i18n';

/**
 * FR-CMP-040 — drivers and hosts.
 *
 * A staff record exists independently of a user account: an Admin enters their drivers
 * long before those drivers install anything, and `userId` is filled in later when the
 * person registers and is approved (FR-AUTH-040). The "not registered" state is the
 * ordinary one, so it is labelled rather than shown as a gap.
 */
export function StaffPage() {
  const list = useListState({
    initialFilters: {
      search: undefined as string | undefined,
      status: undefined as 'ACTIVE' | 'INACTIVE' | undefined,
      kind: undefined as StaffKind | undefined,
    },
    sortableColumns: STAFF_SORT_COLUMNS,
    defaultSort: { column: 'fullName', direction: 'asc' },
  });

  const query = useStaff(list.query);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [creating, setCreating] = useState(false);

  const remove = useResourceMutation((id: string) => api.staff.remove(id), [keys.staff]);

  const confirm = useConfirm<Staff>({
    title: (member) => t('confirm.deleteTitle', { name: member.fullName }),
    body: () => t('confirm.deleteBody'),
    onConfirm: (member) => remove.mutateAsync(member.id),
    pending: remove.isPending,
  });

  const columns: ColumnDef<Staff, unknown>[] = [
    {
      id: 'fullName',
      header: t('staff.fullName'),
      cell: ({ row }) => <span className="font-medium">{row.original.fullName}</span>,
    },
    { id: 'kind', header: t('staff.kind'), cell: ({ row }) => t(`role.${row.original.kind}`) },
    {
      id: 'phoneE164',
      header: t('staff.phone'),
      cell: ({ row }) => row.original.phoneE164 ?? t('common.notSet'),
    },
    {
      id: 'licenceExpiry',
      header: t('staff.licenceExpiry'),
      cell: ({ row }) => row.original.licenceExpiry ?? t('common.notSet'),
    },
    {
      id: 'userId',
      header: t('staff.linkedAccount'),
      cell: ({ row }) =>
        row.original.userId ? (
          <Badge variant="secondary">{t('common.yes')}</Badge>
        ) : (
          <span className="text-muted-foreground">{t('staff.notRegistered')}</span>
        ),
    },
    {
      id: 'actions',
      header: t('common.actions'),
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => setEditing(row.original)}>
            {t('common.edit')}
          </Button>
          <MutatingButton
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={() => confirm.ask(row.original)}
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
        title={t('staff.title')}
        actions={
          <MutatingButton onClick={() => setCreating(true)} className="gap-1.5">
            <Plus aria-hidden className="h-4 w-4" />
            {t('staff.create')}
          </MutatingButton>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <SearchInput value={list.filters.search} onChange={(search) => list.setFilters({ search })} />
        <ChoiceFilter
          label={t('staff.kind')}
          value={list.filters.kind}
          onChange={(kind) => list.setFilters({ kind: kind as StaffKind | undefined })}
          options={STAFF_KINDS.map((kind) => ({ value: kind, label: t(`role.${kind}`) }))}
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
        emptyTitle={t('staff.emptyTitle')}
        emptyBody={t('staff.emptyBody')}
        filtered={list.filtered}
        hasNextPage={query.data?.nextCursor !== null}
        onNextPage={() => list.nextPage(query.data?.nextCursor ?? null)}
        onFirstPage={list.firstPage}
        canGoBack={list.canGoBack}
        onRowClick={setEditing}
      />

      {confirm.dialog}
      {creating ? <StaffDialog member={null} onClose={() => setCreating(false)} /> : null}
      {editing ? <StaffDialog member={editing} onClose={() => setEditing(null)} /> : null}
    </>
  );
}

function StaffDialog({ member, onClose }: { member: Staff | null; onClose: () => void }) {
  const editing = member !== null;

  const save = useResourceMutation(
    (values: CreateStaffDto) =>
      editing ? api.staff.update(member.id, values) : api.staff.create(values),
    [keys.staff],
  );

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{editing ? t('staff.edit') : t('staff.create')}</DialogTitle>
        </DialogHeader>

        <Form
          schema={createStaffSchema}
          defaultValues={
            {
              kind: member?.kind ?? 'DRIVER',
              fullName: member?.fullName ?? '',
              phoneE164: member?.phoneE164 ?? undefined,
              licenceNo: member?.licenceNo ?? undefined,
              licenceExpiry: member?.licenceExpiry ?? undefined,
              recordCertDate: member?.recordCertDate ?? undefined,
            } as CreateStaffDto
          }
          submitError={save.error}
          onCancel={onClose}
          onSubmit={async (values) => {
            await save.mutateAsync(values as CreateStaffDto);
            onClose();
          }}
        >
          <FieldRow>
            <SelectField<CreateStaffDto>
              name="kind"
              label={t('staff.kind')}
              options={STAFF_KINDS.map((kind) => ({ value: kind, label: t(`role.${kind}`) }))}
            />
            <TextField<CreateStaffDto> name="fullName" label={t('staff.fullName')} />
          </FieldRow>

          <TextField<CreateStaffDto> name="phoneE164" label={t('staff.phone')} optional />

          <FieldRow>
            <TextField<CreateStaffDto> name="licenceNo" label={t('staff.licenceNo')} optional />
            <TextField<CreateStaffDto>
              name="licenceExpiry"
              label={t('staff.licenceExpiry')}
              type="date"
              optional
            />
          </FieldRow>

          {/* FR-CMP-040 — "where applicable". Required for a driver by regulation, but
              the requirement does not make it a database constraint, so neither does
              this form. */}
          <TextField<CreateStaffDto>
            name="recordCertDate"
            label={t('staff.recordCertDate')}
            type="date"
            optional
          />
        </Form>
      </DialogContent>
    </Dialog>
  );
}
