import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { PencilLine, Send, UserPlus } from 'lucide-react';
import {
  MOBILE_ROLES,
  REGISTRATION_SORT_COLUMNS,
  USER_STATUSES,
  correctInvitePhoneSchema,
  inviteUserSchema,
  type CorrectInvitePhoneDto,
  type InviteUserDto,
  type PendingRegistration,
  type UserStatus,
} from '@servisapp/shared';
import { api } from '@/api/client';
import { keys, useRegistrations, useResourceMutation } from '@/api/hooks';
import { useListState } from '@/api/use-list-state';
import { DataTable } from '@/components/DataTable';
import { ChoiceFilter, SearchInput } from '@/components/ListFilters';
import { MutatingButton } from '@/components/MutatingButton';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, SelectField, TextField } from '@/components/FormKit';
import { t } from '@/i18n';

export function InvitationsPage() {
  const list = useListState({
    initialFilters: {
      status: 'PENDING_APPROVAL' as UserStatus,
      search: undefined as string | undefined,
    },
    sortableColumns: REGISTRATION_SORT_COLUMNS,
    defaultSort: { column: 'createdAt', direction: 'asc' },
  });

  const query = useRegistrations(list.query);
  const [inviting, setInviting] = useState(false);
  const [correcting, setCorrecting] = useState<PendingRegistration | null>(null);

  const resend = useResourceMutation(
    (membershipId: string) => api.registrations.resendInvite(membershipId),
    [keys.registrations],
  );

  const columns: ColumnDef<PendingRegistration, unknown>[] = [
    {
      id: 'fullName',
      header: t('approval.applicant'),
      cell: ({ row }) => (
        <div>
          <p className="font-medium">
            {row.original.fullName.trim() !== ''
              ? row.original.fullName
              : (row.original.phone ?? t('invite.shadowBadge'))}
          </p>
          {row.original.fullName.trim() !== '' ? (
            <p className="text-xs text-muted-foreground">
              {row.original.phone ?? row.original.email ?? t('common.notSet')}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      id: 'role',
      header: t('approval.requestedRole'),
      cell: ({ row }) => t(`role.${row.original.role}`),
    },
    {
      id: 'phoneVerified',
      header: t('approval.phoneVerified'),
      cell: ({ row }) =>
        row.original.phoneVerified ? (
          <Badge variant="secondary">{t('common.yes')}</Badge>
        ) : (
          <Badge variant="destructive">{t('approval.phoneNotVerified')}</Badge>
        ),
    },
    {
      id: 'inviteCount',
      header: t('invitations.sentAt'),
      cell: ({ row }) => (
        <div>
          <p className="text-sm">
            {new Date(row.original.invitedAt ?? row.original.createdAt).toLocaleDateString('tr-TR')}
          </p>
          {row.original.inviteCount > 1 ? (
            <p className="text-xs text-muted-foreground">
              {t('invitations.inviteCount', { count: row.original.inviteCount })}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      id: 'status',
      header: t('common.status'),
      cell: ({ row }) =>
        row.original.status === 'REJECTED' && row.original.rejectedAt ? (
          <div>
            <Badge variant="destructive">{t('approval.rejectedByUser')}</Badge>
            <p className="mt-1 text-xs text-muted-foreground">
              {new Date(row.original.rejectedAt).toLocaleDateString('tr-TR')}
            </p>
          </div>
        ) : (
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
          {!row.original.phoneVerified && row.original.status !== 'ACTIVE' ? (
            <>
              <MutatingButton
                size="sm"
                variant="outline"
                className="gap-1.5"
                disabled={resend.isPending && resend.variables === row.original.membershipId}
                onClick={() => resend.mutate(row.original.membershipId)}
              >
                <Send aria-hidden className="h-3.5 w-3.5" />
                {t('invitations.resend')}
              </MutatingButton>
              <MutatingButton
                size="sm"
                variant="ghost"
                className="gap-1.5"
                onClick={() => setCorrecting(row.original)}
              >
                <PencilLine aria-hidden className="h-3.5 w-3.5" />
                {t('invitations.editPhone')}
              </MutatingButton>
            </>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t('invitations.title')}
        description={t('invitations.description')}
        actions={
          <MutatingButton className="gap-1.5" onClick={() => setInviting(true)}>
            <UserPlus aria-hidden className="h-4 w-4" />
            {t('invitations.send')}
          </MutatingButton>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <SearchInput
          value={list.filters.search}
          onChange={(search) => list.setFilters({ search })}
        />
        <ChoiceFilter
          label={t('approval.filterStatus')}
          value={list.filters.status}
          onChange={(status) =>
            list.setFilters({ status: (status ?? 'PENDING_APPROVAL') as UserStatus })
          }
          options={USER_STATUSES.map((status) => ({ value: status, label: t(`status.${status}`) }))}
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
        emptyTitle={t('invitations.emptyTitle')}
        emptyBody={t('invitations.emptyBody')}
        hasNextPage={query.data?.nextCursor !== null}
        onNextPage={() => list.nextPage(query.data?.nextCursor ?? null)}
        onFirstPage={list.firstPage}
        canGoBack={list.canGoBack}
      />

      {inviting ? <InviteDialog onClose={() => setInviting(false)} /> : null}
      {correcting ? (
        <CorrectPhoneDialog registration={correcting} onClose={() => setCorrecting(null)} />
      ) : null}
    </>
  );
}

function InviteDialog({ onClose }: { onClose: () => void }) {
  const invite = useResourceMutation(
    (values: InviteUserDto) => api.registrations.invite(values),
    [keys.registrations, keys.guardians, keys.staff],
  );

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{t('invitations.sendTitle')}</DialogTitle>
        </DialogHeader>

        <Form
          schema={inviteUserSchema}
          defaultValues={{ phone: '', role: 'PARENT' } as InviteUserDto}
          submitError={invite.error}
          submitLabel={t('invitations.send')}
          onCancel={onClose}
          onSubmit={async (values) => {
            await invite.mutateAsync(values as InviteUserDto);
            onClose();
          }}
        >
          <p className="text-xs text-muted-foreground">{t('invitations.sendDescription')}</p>

          <TextField<InviteUserDto>
            name="phone"
            label={t('invitations.phone')}
            placeholder="+905321234567"
          />
          <SelectField<InviteUserDto>
            name="role"
            label={t('invitations.role')}
            options={MOBILE_ROLES.map((role) => ({ value: role, label: t(`role.${role}`) }))}
          />
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function CorrectPhoneDialog({
  registration,
  onClose,
}: {
  registration: PendingRegistration;
  onClose: () => void;
}) {
  const correct = useResourceMutation(
    (values: CorrectInvitePhoneDto) =>
      api.registrations.correctPhone(registration.membershipId, values),
    [keys.registrations, keys.guardians, keys.staff],
  );

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{t('invitations.editPhoneTitle')}</DialogTitle>
        </DialogHeader>

        <Form
          schema={correctInvitePhoneSchema}
          defaultValues={{ phone: registration.phone ?? '' } as CorrectInvitePhoneDto}
          submitError={correct.error}
          submitLabel={t('common.save')}
          onCancel={onClose}
          onSubmit={async (values) => {
            await correct.mutateAsync(values as CorrectInvitePhoneDto);
            onClose();
          }}
        >
          <TextField<CorrectInvitePhoneDto> name="phone" label={t('invitations.phone')} />
          <p className="text-xs text-muted-foreground">{t('invite.editPhoneHint')}</p>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
