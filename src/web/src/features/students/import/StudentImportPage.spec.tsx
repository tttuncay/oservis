import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { StudentImportReport } from '@servisapp/shared';
import { ReportCard } from './StudentImportPage';

/**
 * **FR-CMP-110** — *"a validation report identifying rejected rows and reasons"*.
 *
 * The server's half of this is verified by `student-import.integration.spec.ts`, which
 * asserts what the report *contains*. Phase 3 recorded the other half under *Not
 * closed*: the table that renders it had no test.
 *
 * ## What a rejected row has to say to be worth rendering
 *
 * Three things, and each is a case below:
 *
 *   the **row number as it appears in the spreadsheet**, header included, so an Admin
 *   can open the file and go straight to it rather than counting;
 *
 *   the server's **Turkish sentence**, never its machine code (NFR-USA-060) — a table
 *   reading `VALIDATION_FAILED` is a table that has to be translated by the person
 *   reading it;
 *
 *   **which field** failed, where the failure was a validation one, because *"row 43 is
 *   invalid"* is not actionable and *"row 43: telefon"* is.
 */

function report(overrides: Partial<StudentImportReport> = {}): StudentImportReport {
  return {
    importId: '01a00000-0000-7000-8000-000000000001',
    totalRows: 5,
    imported: 2,
    skipped: 1,
    geocodingQueued: 2,
    rejected: [],
    ...overrides,
  };
}

/** The rejected-row table, or `null` when the report has nothing to reject. */
function rejectionTable(): HTMLElement | null {
  const heading = screen.queryByText('Aktarılamayan satırlar');
  return heading ? (heading.parentElement as HTMLElement) : null;
}

describe('FR-CMP-110 — the rejected-row report', () => {
  it('renders no rejection table when every row went in', () => {
    render(<ReportCard report={report({ totalRows: 3, imported: 3, skipped: 0 })} />);

    // An empty "rejected rows" table with a reassuring zero is worse than no table: it
    // is the shape an Admin scans for a problem, and it should not be there when there
    // is none.
    expect(rejectionTable()).toBeNull();
    expect(screen.getByText('Aktarım sonucu')).toBeInTheDocument();
  });

  it('shows the counts an Admin reconciles the file against', () => {
    render(<ReportCard report={report({ rejected: [rejection(4)] })} />);

    const figures = screen.getByText('Toplam satır').parentElement?.parentElement as HTMLElement;

    expect(within(figures).getByText('Toplam satır')).toBeInTheDocument();
    expect(within(figures).getByText('Aktarılan')).toBeInTheDocument();
    // `skipped` is the idempotency outcome — a student who already exists under the same
    // dedupe key. Re-running an identical file reports every row skipped and creates
    // nothing, and an Admin who cannot see that would think the import failed.
    expect(within(figures).getByText('Atlanan')).toBeInTheDocument();
    expect(within(figures).getByText('Reddedilen')).toBeInTheDocument();
  });

  it('names the spreadsheet row number, header included', () => {
    render(<ReportCard report={report({ rejected: [rejection(43)] })} />);

    // 43, not 42 and not 41. The server counts from the file as the Admin sees it in
    // Excel, and an off-by-one here sends somebody to the wrong child's row.
    expect(screen.getByText('43')).toBeInTheDocument();
  });

  it('renders the server’s Turkish message, not its code (NFR-USA-060)', () => {
    render(
      <ReportCard
        report={report({
          rejected: [
            {
              row: 12,
              code: 'SCHOOL_NOT_FOUND',
              message: 'Belirtilen okul bu şirkette tanımlı değil.',
            },
          ],
        })}
      />,
    );

    expect(screen.getByText('Belirtilen okul bu şirkette tanımlı değil.')).toBeInTheDocument();
    // The badge is the category, translated from `packages/i18n`. The raw code appears
    // nowhere on screen.
    expect(screen.getByText('Okul bulunamadı')).toBeInTheDocument();
    expect(screen.queryByText(/SCHOOL_NOT_FOUND/)).toBeNull();
  });

  it('names the failing fields where the failure was a validation one', () => {
    render(
      <ReportCard
        report={report({
          rejected: [
            {
              row: 7,
              code: 'VALIDATION_FAILED',
              message: 'Satır doğrulanamadı.',
              fields: [
                { field: 'telefon', message: 'Geçerli bir telefon numarası değil' },
                { field: 'sinif', message: 'Zorunlu alan' },
              ],
            },
          ],
        })}
      />,
    );

    expect(screen.getByText(/telefon: Geçerli bir telefon numarası değil/)).toBeInTheDocument();
    expect(screen.getByText(/sinif: Zorunlu alan/)).toBeInTheDocument();
  });

  it('lists every rejected row rather than a summary of them', () => {
    const rejected = Array.from({ length: 25 }, (_, index) => rejection(index + 2));

    render(<ReportCard report={report({ totalRows: 30, imported: 5, rejected })} />);

    // Twenty-five rows and twenty-five row numbers. A report that truncated would leave
    // an Admin to guess which of five hundred children never arrived; the table scrolls
    // inside a fixed height instead.
    for (const number of [2, 13, 26]) {
      expect(screen.getByText(String(number))).toBeInTheDocument();
    }
  });

  it('says how many addresses are still being looked up (SDD §21 TI-08)', () => {
    render(<ReportCard report={report({ geocodingQueued: 42 })} />);

    // Geocoding is a background job, so the import "finishing" does not mean the
    // addresses are placed. Saying nothing here is how an Admin concludes the map is
    // broken.
    expect(screen.getByText(/42/)).toBeInTheDocument();
  });

  it('says nothing about geocoding when nothing was queued', () => {
    render(<ReportCard report={report({ geocodingQueued: 0 })} />);

    expect(screen.queryByText(/adres/i)).toBeNull();
  });
});

function rejection(row: number): StudentImportReport['rejected'][number] {
  return { row, code: 'VALIDATION_FAILED', message: 'Satır doğrulanamadı.' };
}
