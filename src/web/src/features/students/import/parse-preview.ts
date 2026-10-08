/**
 * Client-side parse of the import file, for the **preview only** (SDD §15.2).
 *
 * ## This is not validation
 *
 * FR-CMP-110's validation is the server's, row by row, against
 * `studentImportRowSchema` — the same schema, the same rejection codes, the same Turkish
 * messages. Nothing here decides whether a row is importable, and nothing here is
 * consulted before the upload.
 *
 * What it is for is the question an Admin has before they commit five hundred children:
 * *did my columns line up?* A preview answers that in the browser, in no time, without a
 * round trip — and getting the answer wrong here costs a confusing preview, not a bad
 * import.
 *
 * ## Why a hand-rolled CSV reader
 *
 * The server's template is `.csv` and the parse it needs is: split lines, split cells,
 * honour double quotes. A spreadsheet library would add hundreds of kilobytes to the
 * bundle so that a preview could also read `.xlsx` — which the server's parser handles
 * on upload anyway, so the preview would simply be blank for those files instead of
 * wrong. That is an acceptable trade for the bundle size, and it is stated so nobody
 * "fixes" it by adding the dependency.
 */

export interface PreviewTable {
  headers: string[];
  rows: string[][];
  /** True when the file is not text this reader understands — an `.xlsx`, most likely. */
  unreadable: boolean;
}

/** Rows shown before the upload. Enough to see the shape, not enough to scroll forever. */
const PREVIEW_ROWS = 10;

export async function parsePreview(file: File): Promise<PreviewTable> {
  const isCsv = file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv';
  if (!isCsv) return { headers: [], rows: [], unreadable: true };

  const text = await file.text();
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
  if (lines.length === 0) return { headers: [], rows: [], unreadable: false };

  const delimiter = detectDelimiter(lines[0] as string);
  const headers = splitRow(lines[0] as string, delimiter);
  const rows = lines.slice(1, PREVIEW_ROWS + 1).map((line) => splitRow(line, delimiter));

  return { headers, rows, unreadable: false };
}

/**
 * Comma or semicolon.
 *
 * Turkish Excel writes `;` by default, because the comma is the decimal separator in
 * `tr-TR`. A reader that assumed `,` would show every row as one cell for most of the
 * files this feature will actually receive.
 */
function detectDelimiter(headerLine: string): string {
  const semicolons = (headerLine.match(/;/g) ?? []).length;
  const commas = (headerLine.match(/,/g) ?? []).length;
  return semicolons > commas ? ';' : ',';
}

/** Splits one line, honouring `"quoted, cells"` and `""` as an escaped quote. */
function splitRow(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (quoted) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
}
