import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  LEAD_SORT_COLUMNS,
  LEAD_SOURCES,
  LEAD_STATUSES,
  createLeadSchema,
  type CreateLeadDto,
  type Lead,
  type LeadSource,
  type LeadStatus,
} from '@servisapp/shared';
import { api } from '@/api/client';
import { CRM_KEYS, useLeads, useResourceMutation, useSchools } from '@/api/hooks';
import { useListState } from '@/api/use-list-state';
import { DataTable } from '@/components/DataTable';
import { FieldRow, Form, SelectField, TextAreaField, TextField } from '@/components/FormKit';
import { SearchInput } from '@/components/ListFilters';
import { MutatingButton } from '@/components/MutatingButton';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { t } from '@/i18n';

/**
 * FR-MKT-030 and FR-MKT-040 — the pipeline, as a list.
 *
 * ## Newest first, unlike every other list in the console
 *
 * `leadQuerySchema` defaults to `createdAt desc` and that is the opposite of the approval
 * queue, which is oldest-first so nobody waits for ever. The two are worked differently: a
 * queue is a backlog to clear, and a sales pipeline cools in days — the enquiry that
 * arrived this morning is the one worth ringing.
 *
 * ## `PUBLIC_FORM` is not offered as a source on the create form
 *
 * `manualLeadSourceSchema` omits it, because the server assigns it and nobody else does.
 * A source an Admin could type would make FR-MKT-060's *"by source"* a field rather than a
 * fact.
 */
export function LeadsPage() {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);

  const list = useListState({
    initialFilters: {
      search: undefined as string | undefined,
      status: undefined as LeadStatus | undefined,
      source: undefined as LeadSource | undefined,
      followUpBy: undefined as string | undefined,
    },
    sortableColumns: LEAD_SORT_COLUMNS,
    defaultSort: { column: 'createdAt', direction: 'desc' },
  });

  const query = useLeads(list.query);

  const columns: ColumnDef<Lead, unknown>[] = [
    { id: 'contactName', accessorKey: 'contactName', header: t('crm.contactName') },
    { id: 'phone', accessorKey: 'phone', header: t('crm.phone') },
    { id: 'schoolName', accessorKey: 'schoolName', header: t('crm.school') },
    { id: 'district', accessorKey: 'district', header: t('crm.district') },
    { id: 'childCount', accessorKey: 'childCount', header: t('crm.childCount') },
    {
      id: 'source',
      header: t('crm.source'),
      cell: ({ row }) => (
        <Badge variant="secondary">{t(`leadSource.${row.original.source}`)}</Badge>
      ),
    },
    {
      id: 'status',
      header: t('crm.status'),
      cell: ({ row }) => (
        <Badge variant={badgeFor(row.original.status)}>
          {t(`leadStatus.${row.original.status}`)}
        </Badge>
      ),
    },
    {
      id: 'followUpOn',
      accessorKey: 'followUpOn',
      header: t('crm.followUpOn'),
      cell: ({ row }) => row.original.followUpOn ?? '—',
    },
  ];

  return (
    <>
      <PageHeader
        title={t('crm.title')}
        actions={
          <MutatingButton onClick={() => setCreating(true)} className="gap-1.5">
            <Plus aria-hidden className="h-4 w-4" />
            {t('crm.newLead')}
          </MutatingButton>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <SearchInput
          value={list.filters.search}
          onChange={(search) => list.setFilters({ search })}
        />

        <EnumFilter
          label={t('crm.status')}
          values={LEAD_STATUSES}
          value={list.filters.status}
          prefix="leadStatus"
          onChange={(status) => list.setFilters({ status: status as LeadStatus | undefined })}
        />

        <EnumFilter
          label={t('crm.source')}
          values={LEAD_SOURCES}
          value={list.filters.source}
          prefix="leadSource"
          onChange={(source) => list.setFilters({ source: source as LeadSource | undefined })}
        />

        {/*
          FR-MKT-030's *"follow-up dates"* as a working list rather than a column to sort:
          what an Admin actually asks in the morning is *"who am I calling today"*, and
          that is a filter with today's date in it.
        */}
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{t('crm.followUpDue')}</span>
          <input
            type="date"
            aria-label={t('crm.followUpDue')}
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={list.filters.followUpBy ?? ''}
            onChange={(event) =>
              list.setFilters({ followUpBy: event.target.value || undefined })
            }
          />
        </label>
      </div>

      <DataTable
        columns={columns}
        rows={query.data?.data ?? []}
        sort={list.sort}
        onSortChange={list.setSort}
        sortableColumns={list.sortableColumns}
        loading={query.isPending}
        error={query.error}
        onRetry={() => void query.refetch()}
        emptyTitle={t('crm.title')}
        emptyBody={t('crm.empty')}
        filtered={list.filtered}
        onRowClick={(lead) => navigate(`/admin/crm/leads/${lead.id}`)}
        hasNextPage={Boolean(query.data?.nextCursor)}
        onNextPage={() => list.nextPage(query.data?.nextCursor ?? null)}
        onFirstPage={list.firstPage}
        canGoBack={list.canGoBack}
      />

      {creating ? <CreateLeadDialog onClose={() => setCreating(false)} /> : null}
    </>
  );
}

/** FR-MKT-040 — *"for enquiries received by telephone or in person"*. */
function CreateLeadDialog({ onClose }: { onClose: () => void }) {
  const schools = useSchools({ limit: 100, sort: 'name', dir: 'asc', status: 'ACTIVE' });

  const create = useResourceMutation(
    (dto: CreateLeadDto) => api.crm.create(dto),
    CRM_KEYS,
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl" closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{t('crm.newLead')}</DialogTitle>
        </DialogHeader>

        <Form
          schema={createLeadSchema}
          defaultValues={{
            contactName: '',
            phone: '',
            email: undefined,
            schoolId: undefined,
            schoolName: '',
            district: '',
            childCount: 1,
            source: 'PHONE',
            note: undefined,
          }}
          onSubmit={async (values) => {
            await create.mutateAsync(values);
            onClose();
          }}
          submitError={create.error}
          onCancel={onClose}
        >
          <FieldRow>
            <TextField name="contactName" label={t('crm.contactName')} />
            <TextField name="phone" label={t('crm.phone')} type="tel" placeholder="+905321234567" />
          </FieldRow>

          <TextField name="email" label={t('crm.email')} type="email" optional />

          <FieldRow>
            <SelectField
              name="schoolId"
              label={t('crm.school')}
              optional
              options={(schools.data?.data ?? []).map((school) => ({
                value: school.id,
                label: school.name,
              }))}
            />
            <TextField name="schoolName" label={t('quote.schoolName')} />
          </FieldRow>

          <FieldRow>
            <TextField name="district" label={t('crm.district')} />
            <TextField name="childCount" label={t('crm.childCount')} type="number" />
          </FieldRow>

          {/* `PUBLIC_FORM` is absent by construction — see the page note. */}
          <SelectField
            name="source"
            label={t('crm.source')}
            options={['PHONE', 'IN_PERSON', 'REFERRAL', 'OTHER'].map((source) => ({
              value: source,
              label: t(`leadSource.${source as LeadSource}`),
            }))}
          />

          <TextAreaField name="note" label={t('crm.note')} optional rows={3} />
        </Form>
      </DialogContent>
    </Dialog>
  );
}

/** A filter over a fixed enumeration, labelled from the catalogue. */
function EnumFilter({
  label,
  values,
  value,
  prefix,
  onChange,
}: {
  label: string;
  values: readonly string[];
  value: string | undefined;
  prefix: 'leadStatus' | 'leadSource';
  onChange: (next: string | undefined) => void;
}) {
  const ALL = '__all__';

  return (
    <Select value={value ?? ALL} onValueChange={(next) => onChange(next === ALL ? undefined : next)}>
      <SelectTrigger className="w-44" aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{t('common.all')}</SelectItem>
        {values.map((candidate) => (
          <SelectItem key={candidate} value={candidate}>
            {t(`${prefix}.${candidate}` as `leadStatus.NEW`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Won is a success, lost is spent, everything between is in progress. */
function badgeFor(status: LeadStatus): 'default' | 'secondary' | 'outline' {
  if (status === 'WON') return 'default';
  if (status === 'LOST') return 'secondary';
  return 'outline';
}
