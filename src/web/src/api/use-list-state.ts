import { useCallback, useMemo, useState } from 'react';
import type { SortDirection } from '@servisapp/shared';
import type { SortState } from '@/components/DataTable';

/**
 * The list state every table screen holds: search, filters, sort and the cursor stack.
 *
 * ## Why a stack of cursors
 *
 * Keyset pagination knows how to go forward. "Back" is not `cursor - 1` — there is no
 * arithmetic on an opaque row identifier — so the only way back is to remember the
 * cursors already used. The stack is that memory: pushing on next, popping on back.
 *
 * It is also why there is no page 7 to jump to. That is a property of keyset paging, not
 * a gap: numbered pages need `OFFSET`, which costs more the deeper a reader goes and
 * shifts every page when a row is inserted (see `common/pagination.ts` on the API side).
 *
 * ## Every filter change resets to the first page
 *
 * A cursor is a position in one particular ordering of one particular filtered set.
 * Carrying it across a filter change would ask the server to continue a list that no
 * longer exists, and the answer would look arbitrary rather than wrong.
 */
export interface ListState<F extends object, S extends string> {
  /**
   * The full query object to hand to the resource hook.
   *
   * `sort` is narrowed to the resource's allow-list, so a screen that asks for a column
   * the server does not offer is a compile error rather than a 422 the tester finds.
   */
  query: { cursor: string | undefined; limit: number; sort: S; dir: SortDirection } & F;
  filters: F;
  sort: SortState;
  /** The allow-list, to hand straight to `DataTable`. Declared once, in one place. */
  sortableColumns: readonly S[];
  setFilters: (next: Partial<F>) => void;
  setSort: (next: SortState) => void;
  nextPage: (nextCursor: string | null) => void;
  firstPage: () => void;
  canGoBack: boolean;
  /** True when any filter is set, which changes what an empty table should say. */
  filtered: boolean;
}

export function useListState<F extends object, S extends string>(options: {
  initialFilters: F;
  /** The resource's sort allow-list from `@servisapp/shared`, which narrows `S`. */
  sortableColumns: readonly S[];
  defaultSort: { column: S; direction: SortDirection };
  limit?: number;
}): ListState<F, S> {
  const { initialFilters, defaultSort, sortableColumns } = options;
  const limit = options.limit ?? 50;

  const [filters, setFiltersState] = useState<F>(initialFilters);
  const [sort, setSortState] = useState<{ column: S; direction: SortDirection }>(defaultSort);
  const [cursors, setCursors] = useState<string[]>([]);

  const setFilters = useCallback((next: Partial<F>) => {
    setFiltersState((current) => ({ ...current, ...next }));
    setCursors([]);
  }, []);

  const setSort = useCallback((next: SortState) => {
    // `DataTable` reports a column identifier as a plain string, because it does not
    // know one resource's allow-list from another's. The narrowing is safe because the
    // only columns it makes clickable are the ones handed to it as `sortableColumns` —
    // the same list that produced `S`.
    setSortState({ column: next.column as S, direction: next.direction });
    setCursors([]);
  }, []);

  const nextPage = useCallback((nextCursor: string | null) => {
    if (nextCursor === null) return;
    setCursors((current) => [...current, nextCursor]);
  }, []);

  const firstPage = useCallback(() => setCursors([]), []);

  const query = useMemo(
    () => ({
      ...filters,
      cursor: cursors[cursors.length - 1],
      limit,
      sort: sort.column,
      dir: sort.direction,
    }),
    [cursors, filters, limit, sort.column, sort.direction],
  );

  const filtered = useMemo(
    () =>
      Object.values(filters as Record<string, unknown>).some(
        (value) => value !== undefined && value !== '' && value !== null,
      ),
    [filters],
  );

  return {
    query,
    filters,
    sort,
    sortableColumns,
    setFilters,
    setSort,
    nextPage,
    firstPage,
    canGoBack: cursors.length > 0,
    filtered,
  };
}
