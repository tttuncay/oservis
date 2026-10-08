import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { Edit2, Plus, Power, Trash2 } from 'lucide-react';
import {
  DIRECTIONS,
  ROUTE_TEMPLATE_SORT_COLUMNS,
  type Direction,
  type RouteTemplate,
} from '@servisapp/shared';
import { api } from '@/api/client';
import {
  keys,
  useResourceMutation,
  useRouteTemplates,
  useSchools,
} from '@/api/hooks';
import { routingKeys } from '@/api/routing-hooks';
import { useListState } from '@/api/use-list-state';
import { DataTable } from '@/components/DataTable';
import { ChoiceFilter, SearchInput } from '@/components/ListFilters';
import { MutatingButton } from '@/components/MutatingButton';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ConfirmDialog';
import { CapacityBadge } from './CapacityBadge';
import { RouteTemplateDialog, formatDays } from './RouteTemplateDialog';
import { t } from '@/i18n';

/** FR-CMP-080 — route templates, with FR-CMP-090's capacity status on every row. */
export function RouteTemplatesPage() {
  const navigate = useNavigate();

  const list = useListState({
    initialFilters: {
      search: undefined as string | undefined,
      direction: undefined as Direction | undefined,
      schoolId: undefined as string | undefined,
    },
    sortableColumns: ROUTE_TEMPLATE_SORT_COLUMNS,
    defaultSort: { column: 'direction', direction: 'asc' },
  });

  const query = useRouteTemplates(list.query);
  const schools = useSchools({ limit: 100, sort: 'name', dir: 'asc' });
  const [creating, setCreating] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<RouteTemplate | null>(null);

  const toggleActive = useResourceMutation(
    (template: RouteTemplate) =>
      api.routeTemplates.update(template.id, { active: !template.active }),
    [keys.routeTemplates, routingKeys.trips],
  );

  const deleteTemplate = useResourceMutation(
    (template: RouteTemplate) => api.routeTemplates.remove(template.id),
    [keys.routeTemplates, routingKeys.trips],
  );

  const confirmDeactivate = useConfirm<RouteTemplate>({
    title: () => t('routeTemplate.deactivateTitle'),
    body: () => t('routeTemplate.deactivateConfirm'),
    onConfirm: (template) => toggleActive.mutateAsync(template),
    pending: toggleActive.isPending,
  });

  const confirmDelete = useConfirm<RouteTemplate>({
    title: () => 'Güzergahı Sil',
    body: (template) =>
      `"${template.name ?? template.vehiclePlate}" güzergahını ve planını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
    onConfirm: (template) => deleteTemplate.mutateAsync(template),
    pending: deleteTemplate.isPending,
  });

  const handleToggleActive = (template: RouteTemplate) => {
    if (template.active) {
      confirmDeactivate.ask(template);
    } else {
      void toggleActive.mutateAsync(template);
    }
  };

  const columns: ColumnDef<RouteTemplate, unknown>[] = [
    {
      id: 'name',
      header: t('routeTemplate.name'),
      cell: ({ row }) => (
        <span className="font-medium">{row.original.name ?? row.original.vehiclePlate}</span>
      ),
    },
    { id: 'vehiclePlate', header: t('routeTemplate.vehicle'), cell: ({ row }) => row.original.vehiclePlate },
    { id: 'schoolName', header: t('routeTemplate.school'), cell: ({ row }) => row.original.schoolName },
    {
      id: 'driverName',
      header: t('routeTemplate.driver'),
      cell: ({ row }) => row.original.driverName ?? <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'hostName',
      header: t('routeTemplate.host'),
      cell: ({ row }) => row.original.hostName ?? <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'departureTime',
      header: t('routeTemplate.departureTime'),
      cell: ({ row }) => row.original.departureTime ?? <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'daysOfWeek',
      header: t('routeTemplate.daysOfWeek'),
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">{formatDays(row.original.daysOfWeek)}</span>
      ),
    },
    {
      id: 'direction',
      header: t('routeTemplate.direction'),
      cell: ({ row }) => t(`direction.${row.original.direction}`),
    },
    {
      id: 'capacity',
      header: t('capacity.label'),
      cell: ({ row }) => <CapacityBadge capacity={row.original.capacity} />,
    },
    {
      id: 'active',
      header: t('common.status'),
      cell: ({ row }) => {
        const template = row.original;
        return (
          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => handleToggleActive(template)}
              className="group flex items-center gap-1.5 focus:outline-none"
              title={template.active ? t('status.INACTIVE') : t('status.ACTIVE')}
            >
              <Badge
                variant={template.active ? 'default' : 'secondary'}
                className="cursor-pointer transition-colors group-hover:opacity-80"
              >
                <Power className="mr-1 h-3 w-3" />
                {template.active ? t('status.ACTIVE') : t('status.INACTIVE')}
              </Badge>
            </button>

            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              title="Güzergahı Sil"
              onClick={() => confirmDelete.ask(template)}
            >
              <Trash2 aria-hidden className="h-3.5 w-3.5" />
            </Button>
          </div>
        );
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const template = row.original;
        return (
          <div
            className="flex items-center justify-end gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title={t('routeTemplate.edit')}
              onClick={() => setEditingTemplate(template)}
            >
              <Edit2 aria-hidden className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title={t('routeTemplate.title')}
        actions={
          <MutatingButton onClick={() => setCreating(true)} className="gap-1.5">
            <Plus aria-hidden className="h-4 w-4" />
            {t('routeTemplate.create')}
          </MutatingButton>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <SearchInput value={list.filters.search} onChange={(search) => list.setFilters({ search })} />
        <ChoiceFilter
          label={t('routeTemplate.direction')}
          value={list.filters.direction}
          onChange={(direction) => list.setFilters({ direction: direction as Direction | undefined })}
          options={DIRECTIONS.map((direction) => ({
            value: direction,
            label: t(`direction.${direction}`),
          }))}
        />
        <ChoiceFilter
          label={t('routeTemplate.school')}
          width="w-64"
          value={list.filters.schoolId}
          onChange={(schoolId) => list.setFilters({ schoolId })}
          options={(schools.data?.data ?? []).map((school) => ({
            value: school.id,
            label: school.name,
          }))}
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
        emptyTitle={t('routeTemplate.emptyTitle')}
        emptyBody={t('routeTemplate.emptyBody')}
        filtered={list.filtered}
        hasNextPage={query.data?.nextCursor !== null}
        onNextPage={() => list.nextPage(query.data?.nextCursor ?? null)}
        onFirstPage={list.firstPage}
        canGoBack={list.canGoBack}
        onRowClick={(template) => navigate(`/admin/route-templates/${template.id}`)}
      />

      {creating ? <RouteTemplateDialog onClose={() => setCreating(false)} /> : null}
      {editingTemplate ? (
        <RouteTemplateDialog
          template={editingTemplate}
          onClose={() => setEditingTemplate(null)}
        />
      ) : null}
      {confirmDeactivate.dialog}
      {confirmDelete.dialog}
    </>
  );
}


