import type { ReactNode } from "react";

/** Cấu hình một loại nhập Excel (xem docs/api/*-import.md của BE). */
export type ExcelImportConfig = {
  /** Gốc đường dẫn của loại, ví dụ `/api/catalog/imports/authors`. Template, rows, confirm... nối thêm vào sau. */
  basePath: `/api/${string}`;
  /** Tiêu đề hộp thoại. */
  title: string;
  /** Mô tả ngắn (thứ tự nhập, lưu ý cột). */
  description?: ReactNode;
  /** Khóa quyền tải lên và xác nhận (`XImportController/upload|confirm`); nút chỉ hiện khi có cả hai. */
  uploadKey: string;
  confirmKey: string;
  /** Có thì loại này phát file mật khẩu tạm sau khi nhập xong (chỉ users). Giá trị là khóa quyền tải file. */
  credentialsKey?: string;
  /** Tiền tố đường dẫn các truy vấn cần tải lại sau khi nhập xong. */
  invalidate: string[];
  /** Danh từ chỉ bản ghi trong câu kết quả ("người dùng", "tác giả"). */
  noun: string;
};

export type ImportStatus = "VALIDATED" | "COMMITTING" | "INTERRUPTED" | "COMMITTED" | "COMMIT_FAILED";
export type RowStatus = "VALID" | "INVALID" | "DUPLICATE";

export type ImportColumn = { key: string; label: string; required: boolean };
export type ImportSheet = {
  sheet: string;
  columns: ImportColumn[];
  total: number;
  valid: number;
  invalid: number;
  duplicate: number;
  warning: number;
};
export type ImportTotals = { total: number; valid: number; invalid: number; duplicate: number; warning: number };

export type ImportSession = {
  importId: string;
  type?: string;
  status: ImportStatus;
  fileName?: string | null;
  createdAt?: string;
  expiresAt?: string;
  sheets: ImportSheet[];
  totals: ImportTotals;
  progress?: { processed: number; total: number } | null;
  result?: { created: number; skippedDuplicate: number; failed: number } | null;
  errorCode?: string | null;
};

export type RowIssue = { column?: string | null; severity?: "ERROR" | "WARNING" | string; code: string; message: string };
export type ImportRowView = {
  sheet: string;
  rowNumber: number;
  status: RowStatus;
  values: Record<string, string | null>;
  issues: RowIssue[];
};
export type ImportRowsPage = { items: ImportRowView[]; page: number; size: number; totalItems: number; totalPages: number };

export const IMPORT_MAX_BYTES = 5 * 1024 * 1024;
export const IMPORT_MAX_ROWS = 5000;
