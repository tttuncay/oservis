import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { PencilLine, Send, UserPlus } from 'lucide-react';
import {
  MOBILE_ROLES,
  REGISTRATION_SORT_COLUMNS,
  USER_STATUSES,
  approveRegistrationSchema,
  correctInvitePhoneSchema,
  inviteUserSchema,
  rejectRegistrationSchema,
  type ApproveRegistrationDto,
  type CorrectInvitePhoneDto,
  type InviteUserDto,
  type PendingRegistration,
  type RejectRegistrationDto,
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
import { Form, SelectField, TextAreaField, TextField } from '@/components/FormKit';
import { t } from '@/i18n';

/**
 * FR-AUTH-040, FR-AUTH-060 and — from V2 Phase 11 — FR-AUTH-180 to FR-AUTH-200.
 *
 * An applicant reaches nothing until approved: their token carries no tenant, so RLS
 * returns nothing for every operational query (SDD §7.1). This screen is therefore the
 * gate, not a formality, and it opens on the oldest application rather than the newest.
 *
 * ## Two kinds of row, in one list
 *
 * Phase 11 puts the Admin's own outbox in what was their inbox. A row with `invitedAt`
 * set is somebody *they* invited and are waiting on; a row without it is somebody who
 * applied and is waiting on *them*. They are different jobs, so the *Kaynak* column says
 * which — rendering them identically would have the Admin approving invitations they
 * themselves issued.
 *
 * A REJECTED row is likewise not a dead end (SDD §7.6): it carries *Tekrar Davet Gönder*,
 * because the commonest reason an invitation is declined is that it reached the wrong
 * person, and a mistyped digit should cost one click rather than a support call.
 */
export function ApprovalsPage() {
  const list = useListState({
    initialFilters: {
      status: 'PENDING_APPROVAL' as UserStatus,
      search: undefined as string | undefined,
    },
    sortableColumns: REGISTRATION_SORT_COLUMNS,
    defaultSort: { column: 'createdAt', direction: 'asc' },
  });

  const query = useRegistrations(list.query);
  const [approving, setApproving] = useState<PendingRegistration | null>(null);
  const [rejecting, setRejecting] = useState<PendingRegistration | null>(null);
  const [inviting, setInviting] = useState(false);
  const [correcting, setCorrecting] = useState<PendingRegistration | null>(null);

  // FR-AUTH-200. Keyed to the row rather than held as a boolean, so two rows cannot both
  // appear to be sending.
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
          // FR-AUTH-020 — an unverified number is a reason to look twice before
          // approving, so it is called out rather than left blank.
          <Badge variant="destructive">{t('approval.phoneNotVerified')}</Badge>
        ),
    },
    {
      id: 'source',
      header: t('approval.source'),
      // Which job this row is. An invitation the Admin sent is not an application they
      // must decide about, and the count is here because "sent three times, still
      // nothing" is the fact that decides whether to telephone instead.
      cell: ({ row }) =>
        row.original.invitedAt ? (
          <div>
            <Badge variant="outline">{t('approval.sourceInvited')}</Badge>
            {row.original.inviteCount > 1 ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {t('approval.inviteCount', { count: row.original.inviteCount })}
              </p>
            ) : null}
          </div>
        ) : (
          <Badge variant="secondary">{t('approval.sourceApplied')}</Badge>
        ),
    },
    {
      id: 'createdAt',
      header: t('approval.appliedAt'),
      cell: ({ row }) =>
        new Date(row.original.invitedAt ?? row.original.createdAt).toLocaleDateString('tr-TR'),
    },
    {
      id: 'status',
      header: t('common.status'),
      cell: ({ row }) =>
        row.original.status === 'REJECTED' && row.original.rejectedAt ? (
          // SDD §7.6 — "the Admin's pending list shows it as Reddedildi, with the
          // timestamp". Without the date the Admin cannot tell a refusal from this
          // morning from one from last term, which is what decides whether to resend.
          <div>
            <Badge variant="destructive">{t('approval.rejectedByUser')}</Badge>
            <p className="mt-1 text-xs text-muted-foreground">
              {new Date(row.original.rejectedAt).toLocaleDateString('tr-TR')}
            </p>
          </div>
        ) : (
          <Badge variant="secondary">{t(`status.${row.original.status}`)}</Badge>
        ),
    },
    {
      id: 'actions',
      header: t('common.actions'),
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          {/*
            Approve and reject belong to an *application* (FR-AUTH-040). An invitation is
            already the Admin's decision — what it awaits is the invitee's — so those two
            buttons would be the Admin approving themselves.
          */}
          {row.original.status === 'PENDING_APPROVAL' && !row.original.invitedAt ? (
            <>
              <MutatingButton size="sm" onClick={() => setApproving(row.original)}>
                {t('approval.approve')}
              </MutatingButton>
              <MutatingButton
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => setRejecting(row.original)}
              >
                {t('approval.reject')}
              </MutatingButton>
            </>
          ) : null}

          {/*
            FR-AUTH-200 and SDD §7.6. Offered while the number is unverified, which is
            exactly the window in which the server permits both — once a real person has
            proved control of it, resending is pointless and correcting it is refused
            (`PHONE_ALREADY_VERIFIED`).
          */}
          {!row.original.phoneVerified && row.original.status !== 'ACTIVE' ? (
            <>
              <MutatingButton
                size="sm"
                variant="outline"
                className="gap-1.5"
                // Disabled while this row's own resend is in flight. Keyed on
                // `variables` rather than on a boolean, so pressing one row's button
                // does not grey out every other row's.
                disabled={resend.isPending && resend.variables === row.original.membershipId}
                onClick={() => resend.mutate(row.original.membershipId)}
              >
                <Send aria-hidden className="h-3.5 w-3.5" />
                {t('invite.resend')}
              </MutatingButton>
              <MutatingButton
                size="sm"
                variant="ghost"
                className="gap-1.5"
                onClick={() => setCorrecting(row.original)}
              >
                <PencilLine aria-hidden className="h-3.5 w-3.5" />
                {t('invite.editPhone')}
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
        title={t('approval.title')}
        description={t('approval.description')}
        actions={
          <MutatingButton variant="outline" className="gap-1.5" onClick={() => setInviting(true)}>
            <UserPlus aria-hidden className="h-4 w-4" />
            {t('invite.button')}
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
        emptyTitle={t('approval.emptyTitle')}
        emptyBody={t('approval.emptyBody')}
        hasNextPage={query.data?.nextCursor !== null}
        onNextPage={() => list.nextPage(query.data?.nextCursor ?? null)}
        onFirstPage={list.firstPage}
        canGoBack={list.canGoBack}
      />

      {approving ? (
        <ApproveDialog registration={approving} onClose={() => setApproving(null)} />
      ) : null}
      {rejecting ? (
        <RejectDialog registration={rejecting} onClose={() => setRejecting(null)} />
      ) : null}
      {inviting ? <InviteDialog onClose={() => setInviting(false)} /> : null}
      {correcting ? (
        <CorrectPhoneDialog registration={correcting} onClose={() => setCorrecting(null)} />
      ) : null}
    </>
  );
}

function ApproveDialog({
  registration,
  onClose,
}: {
  registration: PendingRegistration;
  onClose: () => void;
}) {
  const approve = useResourceMutation(
    (values: ApproveRegistrationDto) =>
      api.registrations.approve(registration.membershipId, values),
    [keys.registrations, keys.guardians, keys.students],
  );

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{t('approval.approveTitle')}</DialogTitle>
        </DialogHeader>

        <Form
          schema={approveRegistrationSchema}
          defaultValues={{ role: registration.role, studentIds: [] } as ApproveRegistrationDto}
          submitError={approve.error}
          submitLabel={t('approval.approve')}
          onCancel={onClose}
          onSubmit={async (values) => {
            await approve.mutateAsync(values as ApproveRegistrationDto);
            onClose();
          }}
        >
          {/*
            The role is confirmed rather than assumed. An applicant asks to be a Guardian;
            the Admin decides what they become, and the two are not always the same — a
            driver who applied from the wrong screen is the common case.

            Linking children on approval (FR-AUTH-040) is done from the student's own
            Guardians tab instead: choosing among a company's children needs a searchable
            picker, and a multi-select inside a confirmation dialog is where a wrong
            child gets attached to the wrong parent.
          */}
          <SelectField<ApproveRegistrationDto>
            name="role"
            label={t('approval.approveRole')}
            options={MOBILE_ROLES.map((role) => ({ value: role, label: t(`role.${role}`) }))}
          />
          <p className="text-xs text-muted-foreground">{t('approval.approveStudentsHint')}</p>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function RejectDialog({
  registration,
  onClose,
}: {
  registration: PendingRegistration;
  onClose: () => void;
}) {
  const reject = useResourceMutation(
    (values: RejectRegistrationDto) => api.registrations.reject(registration.membershipId, values),
    [keys.registrations],
  );

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{t('approval.rejectTitle')}</DialogTitle>
        </DialogHeader>

        <Form
          schema={rejectRegistrationSchema}
          defaultValues={{ reason: '' } as RejectRegistrationDto}
          submitError={reject.error}
          submitLabel={t('approval.reject')}
          onCancel={onClose}
          onSubmit={async (values) => {
            await reject.mutateAsync(values as RejectRegistrationDto);
            onClose();
          }}
        >
          {/* FR-AUTH-040/050 — the reason reaches the applicant, so it is written for
              them rather than for the Admin's own notes. */}
          <TextAreaField<RejectRegistrationDto>
            name="reason"
            label={t('approval.rejectReason')}
            hint={t('approval.rejectReasonHint')}
          />
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function InviteDialog({ onClose }: { onClose: () => void }) {
  const invite = useResourceMutation(
    (values: InviteUserDto) => api.registrations.invite(values),
    [keys.registrations, keys.guardians],
  );

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{t('invite.titleV2')}</DialogTitle>
        </DialogHeader>

        <Form
          schema={inviteUserSchema}
          defaultValues={{ phone: '', role: 'PARENT' } as InviteUserDto}
          submitError={invite.error}
          submitLabel={t('invite.button')}
          onCancel={onClose}
          onSubmit={async (values) => {
            await invite.mutateAsync(values as InviteUserDto);
            onClose();
          }}
        >
          <p className="text-xs text-muted-foreground">{t('invite.descriptionV2')}</p>

          <TextField<InviteUserDto>
            name="phone"
            label={t('invite.phone')}
            placeholder="+905321234567"
          />
          <SelectField<InviteUserDto>
            name="role"
            label={t('invite.role')}
            options={MOBILE_ROLES.map((role) => ({ value: role, label: t(`role.${role}`) }))}
          />
        </Form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * **SDD §7.6 — correcting a mistyped digit.**
 *
 * *"Where the Admin mistyped, they edit the phone number on the shadow account and then
 * resend."*
 *
 * The server permits this only while `phone_verified` is false, and the row's action cell
 * offers it on the same condition — so the button and the rule agree. After that the
 * Admin can no longer redirect the account, which would otherwise be a way to hand one
 * person's linked children to another, and a way that looks like a typo correction in
 * the audit trail.
 */
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
    [keys.registrations, keys.guardians],
  );

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{t('invite.editPhoneTitle')}</DialogTitle>
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
          <TextField<CorrectInvitePhoneDto> name="phone" label={t('invite.phone')} />
          <p className="text-xs text-muted-foreground">{t('invite.editPhoneHint')}</p>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
