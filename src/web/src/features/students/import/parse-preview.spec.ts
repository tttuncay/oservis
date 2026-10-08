import { describe, expect, it } from 'vitest';
import { parsePreview } from './parse-preview';

/**
 * **FR-CMP-110's client-side preview.**
 *
 * Phase 3 recorded this under *Not closed*: *"The client's CSV preview — including the
 * semicolon delimiter Turkish Excel writes — is untested."*
 *
 * ## What is under test, and what deliberately is not
 *
 * This parser decides **nothing**. Validation is the server's, row by row, against
 * `studentImportRowSchema`; nothing here is consulted before the upload and a file that
 * previews badly still imports correctly. What it answers is the one question an Admin
 * has before committing five hundred children: *did my columns line up?*
 *
 * So every case below is about **column alignment**, and the delimiter is the reason the
 * feature has a bug surface at all. Turkish Excel writes `;` by default, because the
 * comma is the decimal separator in `tr-TR` — a reader that assumed `,` would show every
 * row of most real files as a single cell, and an Admin would conclude their file was
 * broken and go and "fix" a file that was already right.
 */

/**
 * A `File` over a string.
 *
 * jsdom implements `File` but **not** `Blob.prototype.text()`, which is what the parser
 * reads with. Rather than change the parser to a `FileReader` dance that no browser has
 * needed since 2019, the helper supplies the one method jsdom is missing. The shim is
 * here and not in `src/test/setup.ts` deliberately: a global patch would make every other
 * suite's `File` quietly non-standard too.
 */
function file(content: string, name: string, type: string): File {
  const handle = new File([content], name, ...(type ? [{ type }] : []));
  Object.defineProperty(handle, 'text', { value: () => Promise.resolve(content) });
  return handle;
}

function csv(content: string, name = 'ogrenciler.csv'): File {
  return file(content, name, 'text/csv');
}

describe('FR-CMP-110 — the import preview parser', () => {
  it('reads a comma-separated file', async () => {
    const preview = await parsePreview(
      csv('Ad Soyad,Sınıf,Okul\nElif Demir,3-A,Atatürk İlkokulu\n'),
    );

    expect(preview.unreadable).toBe(false);
    expect(preview.headers).toEqual(['Ad Soyad', 'Sınıf', 'Okul']);
    expect(preview.rows).toEqual([['Elif Demir', '3-A', 'Atatürk İlkokulu']]);
  });

  it('reads the semicolons Turkish Excel writes', async () => {
    // The case the whole file exists for. `tr-TR` uses the comma as a decimal separator,
    // so Excel's "CSV" is semicolon-delimited on every Turkish machine this will meet.
    const preview = await parsePreview(
      csv('Ad Soyad;Sınıf;Okul\nElif Demir;3-A;Atatürk İlkokulu\n'),
    );

    expect(preview.headers).toEqual(['Ad Soyad', 'Sınıf', 'Okul']);
    expect(preview.rows[0]).toEqual(['Elif Demir', '3-A', 'Atatürk İlkokulu']);
  });

  it('picks the delimiter that actually separates, not the one that appears', async () => {
    // A semicolon file whose *cells* contain commas — an address, most obviously. Choosing
    // by raw count would pick the comma and produce nine columns from three.
    const preview = await parsePreview(
      csv('Ad;Adres;Sınıf\nElif;"Bağdat Cad. No 12, Kadıköy, İstanbul";3-A\n'),
    );

    expect(preview.headers).toHaveLength(3);
    expect(preview.rows[0]).toEqual(['Elif', 'Bağdat Cad. No 12, Kadıköy, İstanbul', '3-A']);
  });

  it('honours quoted cells containing the delimiter', async () => {
    const preview = await parsePreview(csv('Ad,Adres\nElif,"Bağdat Cad. 12, Kadıköy"\n'));

    expect(preview.rows[0]).toEqual(['Elif', 'Bağdat Cad. 12, Kadıköy']);
  });

  it('treats a doubled quote inside a quoted cell as one quote', async () => {
    const preview = await parsePreview(csv('Ad,Not\nElif,"Okul ""A"" blok"\n'));

    expect(preview.rows[0]).toEqual(['Elif', 'Okul "A" blok']);
  });

  it('handles Windows line endings, which is what Excel writes', async () => {
    const preview = await parsePreview(csv('Ad,Sınıf\r\nElif,3-A\r\nEmir,4-B\r\n'));

    expect(preview.rows).toHaveLength(2);
    // A trailing `\r` on the last cell of every row is the classic symptom, and it would
    // make every value in the last column look subtly wrong rather than obviously so.
    expect(preview.rows[0]).toEqual(['Elif', '3-A']);
  });

  it('pads nothing and drops nothing when a row is short', async () => {
    // The misalignment the preview exists to reveal. The parser reports what is there;
    // the table renders one cell per *header*, so a short row shows visibly empty cells.
    const preview = await parsePreview(csv('Ad,Sınıf,Okul\nElif,3-A\n'));

    expect(preview.headers).toHaveLength(3);
    expect(preview.rows[0]).toHaveLength(2);
  });

  it('stops at ten rows — enough to see the shape, not enough to scroll for ever', async () => {
    const rows = Array.from({ length: 40 }, (_, index) => `Öğrenci ${index},${index}-A`);
    const preview = await parsePreview(csv(`Ad,Sınıf\n${rows.join('\n')}\n`));

    expect(preview.rows).toHaveLength(10);
    expect(preview.rows[0]?.[0]).toBe('Öğrenci 0');
  });

  it('ignores blank lines rather than previewing them as empty rows', async () => {
    const preview = await parsePreview(csv('Ad,Sınıf\n\nElif,3-A\n\n\nEmir,4-B\n'));

    expect(preview.rows).toEqual([
      ['Elif', '3-A'],
      ['Emir', '4-B'],
    ]);
  });

  it('answers "unreadable" for a spreadsheet rather than guessing', async () => {
    // The server's parser handles `.xlsx` perfectly well, so the preview says it cannot
    // show one instead of refusing the upload. Rendering the binary as text would be the
    // worst of the three options: it looks like a broken file.
    const workbook = new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04])], 'ogrenciler.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const preview = await parsePreview(workbook);

    expect(preview.unreadable).toBe(true);
    expect(preview.headers).toEqual([]);
  });

  it('reads a .csv the browser gave no content type for', async () => {
    // A file dragged from a network share arrives with `type: ''` on some platforms.
    // Deciding on the extension as well as on the type is what stops that previewing as
    // unreadable.
    const preview = await parsePreview(file('Ad,Sınıf\nElif,3-A\n', 'liste.CSV', ''));

    expect(preview.unreadable).toBe(false);
    expect(preview.headers).toEqual(['Ad', 'Sınıf']);
  });

  it('reports an empty file as readable and empty, not as unreadable', async () => {
    const preview = await parsePreview(csv(''));

    // Two different problems with two different fixes: *"we cannot read this format"* and
    // *"there is nothing in this file"*.
    expect(preview.unreadable).toBe(false);
    expect(preview.headers).toEqual([]);
    expect(preview.rows).toEqual([]);
  });
});
