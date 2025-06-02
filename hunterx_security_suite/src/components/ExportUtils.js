//
// Utility helpers for exporting table/graph data as CSV/JSON
//
function toCSV(rows, columns) {
  if (!rows || rows.length === 0) return "";
  const escape = (v) =>
    typeof v === "string"
      ? '"' + v.replace(/"/g, '""') + '"'
      : v == null
      ? ""
      : v;
  const headers = columns.map((c) => escape(c.label));
  const csvRows = rows.map((row) =>
    columns.map((c) => escape(row[c.field] ?? ""))
  );
  return [headers, ...csvRows].map((r) => r.join(",")).join("\r\n");
}

// PUBLIC_INTERFACE
export function exportCSV(rows, columns, filename) {
  const blob = new Blob([toCSV(rows, columns)], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename || "export.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// PUBLIC_INTERFACE
export function exportJSON(rows, filename) {
  const blob = new Blob([JSON.stringify(rows, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename || "export.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
