export type ExportCell = string | number | boolean | null | undefined;
export type ExportRow = ExportCell[];

function escapeCsvCell(value: ExportCell): string {
  const stringValue = value == null ? "" : String(value);
  const sanitizedValue = /^[=+\-@\t\r]/.test(stringValue)
    ? `'${stringValue}`
    : stringValue;
  const escaped = sanitizedValue.replace(/"/g, '""');
  return `"${escaped}"`;
}

export function downloadCsv(
  filename: string,
  headers: string[],
  rows: ExportRow[],
) {
  const csvLines = [
    headers.map(escapeCsvCell).join(","),
    ...rows.map((row) => row.map(escapeCsvCell).join(",")),
  ];

  const blob = new Blob([csvLines.join("\r\n")], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

function escapeHtml(value: ExportCell): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function printTableDocument(
  title: string,
  subtitle: string,
  headers: string[],
  rows: ExportRow[],
) {
  const printWindow = window.open("", "_blank", "width=1200,height=900");

  if (!printWindow) {
    alert("Pop-up geblokkeerd. Sta pop-ups toe om af te drukken.");
    return;
  }

  const headerHtml = headers
    .map((header) => `<th>${escapeHtml(header)}</th>`)
    .join("");
  const rowsHtml = rows
    .map(
      (row) =>
        `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`,
    )
    .join("");

  printWindow.document.open();
  printWindow.document.write(`
    <!doctype html>
    <html lang="nl">
      <head>
        <meta charset="UTF-8" />
        <title>${escapeHtml(title)}</title>
        <style>
          :root {
            --red: #ED1C24;
            --white: #F9EED5;
            --primary-gray: #19203B;
            --black: #11110e;
          }

          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            padding: 24px;
            font-family: Arial, sans-serif;
            color: #111;
            background: #fff;
          }

          h1 {
            margin: 0 0 8px 0;
            font-size: 28px;
            color: var(--primary-gray);
          }

          p {
            margin: 0 0 20px 0;
            color: #444;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }

          th,
          td {
            border: 1px solid #222;
            padding: 8px;
            text-align: left;
            vertical-align: top;
            font-size: 12px;
            word-break: break-word;
          }

          th {
            background: #f3f3f3;
          }

          @media print {
            body {
              padding: 10mm;
            }

            h1 {
              font-size: 22px;
            }

            th,
            td {
              font-size: 11px;
            }
          }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(subtitle)}</p>
        <table>
          <thead>
            <tr>${headerHtml}</tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}
