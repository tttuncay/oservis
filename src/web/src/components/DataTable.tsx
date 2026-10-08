import { useRef } from 'react';
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import type { SortDirection } from '@servisapp/shared';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { cn } from '@/lib/utils';
import { t } from '@/i18n';

/**
 * The threshold above which rows are virtualised (SDD §15.2).
 *
 * A page is capped at 100 rows by SDD §6.1, so a single page never reaches this. It is
 * reached by the screens that accumulate pages — the route-template student picker, the
 * import preview — and it is set at 200 rather than lower because virtualisation costs a
 * fixed row height, and a table that measures its own rows reads better below that.
 */
const VIRTUALISE_ABOVE = 200;

/** Fixed row height in pixels, required once virtualised. */
const ROW_HEIGHT = 44;

export interface SortState {
  column: string;
  direction: SortDirection;
}

export interface DataTableProps<T> {
  columns: ColumnDef<T, unknown>[];
  rows: T[];
  /**
   * Sorting is the **server's** (SDD §15.2). This component reports the click and
   * renders the arrow; it never reorders `rows`. Sorting a page in the browser would
   * sort fifty rows out of nine hundred and look like it worked.
   */
  sort?: SortState;
  onSortChange?: (sort: SortState) => void;
  /** Columns the server will accept a sort on. Anything else renders unsortable. */
  sortableColumns?: readonly string[];
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  /** Shown when there are no rows and no filters are applied. */
  emptyTitle: string;
  emptyBody: string;
  emptyAction?: React.ReactNode;
  /** True when the caller has a search or filter set, which changes the empty message. */
  filtered?: boolean;
  onRowClick?: (row: T) => void;
  /** Pagination is cursor-based, so there is a next page and a first page — no numbers. */
  hasNextPage?: boolean;
  onNextPage?: () => void;
  onFirstPage?: () => void;
  canGoBack?: boolean;
}

/**
 * The one table in the console (SDD §15.2 — TanStack Table, server-side pagination,
 * sorting and filtering, virtualised above 200 rows).
 *
 * Everything about *which* rows arrive is the caller's and ultimately the server's. This
 * renders them, reports a sort click, and offers a next page when the cursor says one
 * exists.
 */
export function DataTable<T>({
  columns,
  rows,
  sort,
  onSortChange,
  sortableColumns = [],
  loading,
  error,
  onRetry,
  emptyTitle,
  emptyBody,
  emptyAction,
  filtered,
  onRowClick,
  hasNextPage,
  onNextPage,
  onFirstPage,
  canGoBack,
}: DataTableProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    // Every model that would reorder or filter locally is deliberately absent.
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
  });

  const modelRows = table.getRowModel().rows;
  const virtualise = modelRows.length > VIRTUALISE_ABOVE;

  const virtualiser = useVirtualizer({
    count: modelRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
    // Disabled below the threshold by measuring every row into the viewport, which is
    // what the branch below relies on.
    enabled: virtualise,
  });

  if (error) return <ErrorState error={error} {...(onRetry ? { onRetry } : {})} />;

  if (!loading && rows.length === 0) {
    return filtered ? (
      <EmptyState title={t('empty.filteredTitle')} body={t('empty.filteredBody')} />
    ) : (
      <EmptyState title={emptyTitle} body={emptyBody} {...(emptyAction ? { action: emptyAction } : {})} />
    );
  }

  const virtualItems = virtualiser.getVirtualItems();
  const paddingTop = virtualise && virtualItems.length > 0 ? (virtualItems[0]?.start ?? 0) : 0;
  const paddingBottom =
    virtualise && virtualItems.length > 0
      ? virtualiser.getTotalSize() - (virtualItems[virtualItems.length - 1]?.end ?? 0)
      : 0;

  const bodyRows = virtualise ? virtualItems.map((item) => modelRows[item.index]!) : modelRows;

  return (
    <div className="space-y-3">
      <div
        ref={scrollRef}
        className={cn('rounded-lg border', virtualise && 'max-h-[70vh] overflow-auto')}
      >
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => {
                  const columnId = header.column.id;
                  const sortable = sortableColumns.includes(columnId) && onSortChange;

                  return (
                    <TableHead key={header.id} className={sortable ? 'p-0' : undefined}>
                      {header.isPlaceholder ? null : sortable ? (
                        <SortButton
                          label={flexRender(header.column.columnDef.header, header.getContext())}
                          active={sort?.column === columnId}
                          direction={sort?.column === columnId ? sort.direction : undefined}
                          onClick={() =>
                            onSortChange({
                              column: columnId,
                              // Clicking the active column flips it; clicking a new one
                              // starts ascending, which is what a reader expects of a
                              // name or a plate.
                              direction:
                                sort?.column === columnId && sort.direction === 'asc'
                                  ? 'desc'
                                  : 'asc',
                            })
                          }
                        />
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {loading && rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-10 text-center text-muted-foreground">
                  {t('table.loading')}
                </TableCell>
              </TableRow>
            ) : null}

            {paddingTop > 0 ? (
              <tr aria-hidden style={{ height: paddingTop }}>
                <td colSpan={columns.length} />
              </tr>
            ) : null}

            {bodyRows.map((row) => (
              <TableRow
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                className={cn(onRowClick && 'cursor-pointer')}
                style={virtualise ? { height: ROW_HEIGHT } : undefined}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}

            {paddingBottom > 0 ? (
              <tr aria-hidden style={{ height: paddingBottom }}>
                <td colSpan={columns.length} />
              </tr>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{t('table.rowCount', { count: rows.length })}</span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onFirstPage}
            disabled={!canGoBack || loading}
          >
            {t('table.firstPage')}
          </Button>
          {/*
            Cursor pagination goes forward, or back to the start. There is no page 7 to
            jump to — that is a property of keyset paging, not a missing feature, and
            offering numbered pages would mean an OFFSET query that gets slower the
            further a reader goes (see `common/pagination.ts` on the API side).
          */}
          <Button
            variant="outline"
            size="sm"
            onClick={onNextPage}
            disabled={hasNextPage !== true || loading}
          >
            {t('table.nextPage')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SortButton({
  label,
  active,
  direction,
  onClick,
}: {
  label: React.ReactNode;
  active: boolean;
  direction?: SortDirection;
  onClick: () => void;
}) {
  const Icon = !active ? ChevronsUpDown : direction === 'asc' ? ArrowUp : ArrowDown;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === 'asc' ? t('table.sortDescending') : t('table.sortAscending')}
      className="flex h-11 w-full items-center gap-1.5 px-3 text-left font-medium hover:text-foreground"
    >
      {label}
      <Icon aria-hidden className={cn('h-3.5 w-3.5', active ? 'opacity-100' : 'opacity-40')} />
    </button>
  );
}
