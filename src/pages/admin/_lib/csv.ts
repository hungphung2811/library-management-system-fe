// Đọc/ghi CSV nhỏ gọn (không thêm phụ thuộc): hỗ trợ BOM, ô trong nháy kép, dấu phẩy và xuống dòng trong ô, "" là nháy kép.

/** Tách văn bản CSV thành mảng dòng (mảng ô). Bỏ dòng trống hoàn toàn. */
export function parseCsv(text: string): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let i = 0;
  const endRow = () => {
    row.push(cell);
    cell = "";
    if (row.some((c) => c.trim() !== "")) rows.push(row);
    row = [];
  };
  while (i < src.length) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\r") {
      if (src[i + 1] === "\n") i++;
      endRow();
    } else if (ch === "\n") endRow();
    else cell += ch;
    i++;
  }
  if (cell !== "" || row.length > 0) endRow();
  return rows;
}

/** Quote ô khi có dấu phẩy, nháy kép hoặc xuống dòng. */
export function csvCell(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** Dựng văn bản CSV có BOM (Excel đọc đúng tiếng Việt). */
export function toCsv(rows: string[][]): string {
  return "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export type ImportRow = {
  username: string;
  fullName: string;
  email: string;
  departmentCode?: string;
  temporaryPassword?: string;
  reader?: boolean;
};

export const IMPORT_MAX_ROWS = 500;
export const IMPORT_HEADERS = ["username", "fullName", "email", "departmentCode", "temporaryPassword", "reader"] as const;

const TRUE_VALUES = new Set(["true", "1", "yes", "y", "x", "co", "có"]);

/** Đọc CSV nhập người dùng theo tiêu đề (không phân biệt hoa thường, thứ tự cột tùy ý). Trả dòng hoặc lỗi. */
export function parseImportCsv(text: string): { rows: ImportRow[] } | { error: string } {
  const all = parseCsv(text);
  if (all.length === 0) return { error: "Tệp trống." };
  const header = all[0].map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name.toLowerCase());
  const missing = ["username", "fullName", "email"].filter((n) => idx(n) < 0);
  if (missing.length) return { error: `Thiếu cột bắt buộc: ${missing.join(", ")}. Dòng đầu tiên phải là dòng tiêu đề.` };
  const body = all.slice(1);
  if (body.length === 0) return { error: "Tệp chỉ có dòng tiêu đề, chưa có dữ liệu." };
  if (body.length > IMPORT_MAX_ROWS) return { error: `Tệp có ${body.length} dòng, tối đa ${IMPORT_MAX_ROWS} dòng mỗi lần nhập. Hãy tách tệp.` };
  const get = (r: string[], name: string) => (r[idx(name)] ?? "").trim();
  const rows = body.map<ImportRow>((r) => {
    const dep = get(r, "departmentCode");
    const pwRaw = idx("temporaryPassword") >= 0 ? (r[idx("temporaryPassword")] ?? "") : "";
    return {
      username: get(r, "username"),
      fullName: get(r, "fullName"),
      email: get(r, "email"),
      departmentCode: dep || undefined,
      temporaryPassword: pwRaw.trim() ? pwRaw : undefined,
      reader: TRUE_VALUES.has(get(r, "reader").toLowerCase()),
    };
  });
  return { rows };
}
