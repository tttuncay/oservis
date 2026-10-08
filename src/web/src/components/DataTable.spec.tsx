import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ColumnDef } from '@tanstack/react-table';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/client';
import { DataTable } from './DataTable';
import { t } from '@/i18n';

interface Row {
  id: string;
  name: string;
}

const columns: ColumnDef<Row, unknown>[] = [
  { id: 'name', header: 'Ad', cell: ({ row }) => row.original.name },
  { id: 'id', header: 'Kimlik', cell: ({ row }) => row.original.id },
];

function rows(count: number): Row[] {
  return Array.from({ length: count }, (_unused, index) => ({
    id: String(index),
    name: `Kayıt ${index}`,
  }));
}

/**
 * The table's contract is narrow and load-bearing: it renders what it is given, reports
 * a sort click, and never reorders or filters anything itself (SDD §15.2).
 *
 * These tests are written against that contract rather than against the markup, because
 * the failure that matters is "the browser quietly sorted fifty rows out of nine
 * hundred", and that failure looks perfectly fine on screen.
 */
describe('DataTable', () => {
  it('renders the rows it is given', () => {
    render(
      <DataTable columns={columns} rows={rows(3)} emptyTitle="Boş" emptyBody="Hiç kayıt yok" />,
    );

    expect(screen.getByText('Kayıt 0')).toBeInTheDocument();
    expect(screen.getByText('Kayıt 2')).toBeInTheDocument();
  });

  describe('sorting is the server’s', () => {
    it('reports the click instead of reordering the rows', async () => {
      const onSortChange = vi.fn();
      const user = userEvent.setup();

      // Deliberately out of order. A component that sorted locally would fix this.
      const unordered: Row[] = [
        { id: '2', name: 'Çilek' },
        { id: '1', name: 'Armut' },
      ];

      render(
        <DataTable
          columns={columns}
          rows={unordered}
          sortableColumns={['name']}
          sort={{ column: 'name', direction: 'asc' }}
          onSortChange={onSortChange}
          emptyTitle="Boş"
          emptyBody="Hiç kayıt yok"
        />,
      );

      const cells = screen.getAllByRole('cell').map((cell) => cell.textContent);
      expect(cells.slice(0, 2)).toEqual(['Çilek', '2']);

      await user.click(screen.getByRole('button', { name: t('table.sortDescending') }));
      expect(onSortChange).toHaveBeenCalledWith({ column: 'name', direction: 'desc' });
    });

    it('flips the direction on the active column and starts ascending on a new one', async () => {
      const onSortChange = vi.fn();
      const user = userEvent.setup();

      render(
        <DataTable
          columns={columns}
          rows={rows(2)}
          sortableColumns={['name', 'id']}
          sort={{ column: 'name', direction: 'desc' }}
          onSortChange={onSortChange}
          emptyTitle="Boş"
          emptyBody="Hiç kayıt yok"
        />,
      );

      const headers = screen.getAllByRole('columnheader');
      await user.click(within(headers[0] as HTMLElement).getByRole('button'));
      expect(onSortChange).toHaveBeenLastCalledWith({ column: 'name', direction: 'asc' });

      await user.click(within(headers[1] as HTMLElement).getByRole('button'));
      expect(onSortChange).toHaveBeenLastCalledWith({ column: 'id', direction: 'asc' });
    });

    it('makes no header clickable that the server will not sort on', () => {
      render(
        <DataTable
          columns={columns}
          rows={rows(2)}
          sortableColumns={['name']}
          sort={{ column: 'name', direction: 'asc' }}
          onSortChange={vi.fn()}
          emptyTitle="Boş"
          emptyBody="Hiç kayıt yok"
        />,
      );

      const headers = screen.getAllByRole('columnheader');
      expect(within(headers[0] as HTMLElement).queryByRole('button')).not.toBeNull();
      // `id` is not on the allow-list, so offering the control would produce a 422.
      expect(within(headers[1] as HTMLElement).queryByRole('button')).toBeNull();
    });
  });

  describe('pagination is cursor-based', () => {
    it('offers the next page only when the cursor says one exists', async () => {
      const onNextPage = vi.fn();
      const user = userEvent.setup();

      const { rerender } = render(
        <DataTable
          columns={columns}
          rows={rows(2)}
          hasNextPage={false}
          onNextPage={onNextPage}
          emptyTitle="Boş"
          emptyBody="Hiç kayıt yok"
        />,
      );

      expect(screen.getByRole('button', { name: t('table.nextPage') })).toBeDisabled();

      rerender(
        <DataTable
          columns={columns}
          rows={rows(2)}
          hasNextPage
          onNextPage={onNextPage}
          emptyTitle="Boş"
          emptyBody="Hiç kayıt yok"
        />,
      );

      await user.click(screen.getByRole('button', { name: t('table.nextPage') }));
      expect(onNextPage).toHaveBeenCalledOnce();
    });
  });

  describe('empty and error states', () => {
    it('says "nothing yet" when nothing exists', () => {
      render(
        <DataTable
          columns={columns}
          rows={[]}
          emptyTitle="Henüz araç yok"
          emptyBody="İlk aracı ekleyin"
        />,
      );

      expect(screen.getByText('Henüz araç yok')).toBeInTheDocument();
    });

    /**
     * The two are different situations and telling them apart is the point: showing
     * "nothing exists" to somebody who has typed a filter reads as data loss.
     */
    it('says "nothing matches" when a filter is set', () => {
      render(
        <DataTable
          columns={columns}
          rows={[]}
          filtered
          emptyTitle="Henüz araç yok"
          emptyBody="İlk aracı ekleyin"
        />,
      );

      expect(screen.getByText(t('empty.filteredTitle'))).toBeInTheDocument();
      expect(screen.queryByText('Henüz araç yok')).toBeNull();
    });

    /** NFR-USA-060 — the server's Turkish sentence, never the machine code. */
    it('renders the API message and not the error code', () => {
      const error = new ApiError(
        'RECORD_IN_USE',
        'Bu kayıt başka kayıtlarda kullanıldığı için silinemiyor.',
        409,
        '01JABCDEF',
      );

      render(
        <DataTable
          columns={columns}
          rows={[]}
          error={error}
          emptyTitle="Boş"
          emptyBody="Hiç kayıt yok"
        />,
      );

      expect(screen.getByRole('alert')).toHaveTextContent(
        'Bu kayıt başka kayıtlarda kullanıldığı için silinemiyor.',
      );
      expect(screen.queryByText(/RECORD_IN_USE/)).toBeNull();
    });
  });

  describe('virtualisation above 200 rows (SDD §15.2)', () => {
    it('renders every row below the threshold', () => {
      render(
        <DataTable columns={columns} rows={rows(150)} emptyTitle="Boş" emptyBody="Hiç kayıt yok" />,
      );

      expect(screen.getAllByRole('row')).toHaveLength(151); // 150 rows plus the header
    });

    it('renders a window rather than every row above it', () => {
      render(
        <DataTable columns={columns} rows={rows(500)} emptyTitle="Boş" emptyBody="Hiç kayıt yok" />,
      );

      // jsdom reports a zero-height scroll element, so the virtualiser renders only its
      // overscan. The assertion is therefore "far fewer than 500", which is the property
      // that matters: the DOM does not grow with the data.
      expect(screen.getAllByRole('row').length).toBeLessThan(200);
    });
  });
});
