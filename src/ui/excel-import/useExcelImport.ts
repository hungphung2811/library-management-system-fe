import { keepPreviousData } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiDownload, apiFetch, saveBlob, useApi, useInvalidateApi } from "@/api";
import type { DescribedError } from "../error-messages";
import { describeImportError, IMPORT_ERRORS } from "./messages";
import {
  IMPORT_MAX_BYTES,
  type ExcelImportConfig,
  type ImportRowsPage,
  type ImportSession,
  type RowStatus,
} from "./types";

const POLL_MS = 1500;
const ROWS_PER_PAGE = 20;
const TERMINAL = new Set(["COMMITTED", "COMMIT_FAILED", "INTERRUPTED"]);

export type CredentialsState = "idle" | "loading" | "downloaded" | "gone" | "error";

/** Kiểm tệp phía client (đuôi .xlsx, không rỗng, tối đa 5 MB). Trả thông điệp lỗi hoặc null. */
export function checkImportFile(f: File): string | null {
  if (!/\.xlsx$/i.test(f.name)) return "Chỉ nhận tệp Excel .xlsx. Hãy tải file mẫu, điền rồi lưu đúng định dạng .xlsx.";
  if (f.size === 0) return IMPORT_ERRORS.IMPORT_FILE_REQUIRED;
  if (f.size > IMPORT_MAX_BYTES) return IMPORT_ERRORS.IMPORT_FILE_TOO_LARGE;
  return null;
}

/**
 * Máy trạng thái của một phiên nhập Excel: upload -> preview -> confirm -> thăm dò -> kết quả (+ file mật khẩu tạm với users).
 * Mọi lời gọi đi qua apiFetch/apiDownload. Phiên chưa confirm bị hủy (DELETE) khi `cancel()` hoặc khi tải lên lại.
 */
export function useExcelImport(cfg: ExcelImportConfig) {
  const invalidate = useInvalidateApi();
  const [session, setSession] = useState<ImportSession | null>(null);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<DescribedError | null>(null);
  const [sheet, setSheet] = useState<string | null>(null);
  const [rowStatus, setRowStatus] = useState<RowStatus | "">("");
  const [page, setPage] = useState(0);
  const [credentials, setCredentials] = useState<CredentialsState>("idle");
  const [credentialsMessage, setCredentialsMessage] = useState<string | null>(null);
  const [busyDownload, setBusyDownload] = useState<"template" | "errors" | null>(null);
  const invalidated = useRef<string>("");
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const base = cfg.basePath;
  const id = session?.importId;
  const status = session?.status;

  // Trang dòng preview: phân trang phía server, giữ trang cũ trong lúc tải trang mới.
  const activeSheet = sheet ?? session?.sheets[0]?.sheet ?? null;
  const multiSheet = (session?.sheets.length ?? 0) > 1;
  const qs = new URLSearchParams({ page: String(page), size: String(ROWS_PER_PAGE) });
  if (rowStatus) qs.set("status", rowStatus);
  if (multiSheet && activeSheet) qs.set("sheet", activeSheet);
  const rows = useApi<ImportRowsPage>(
    id && status === "VALIDATED" ? (`${base}/${encodeURIComponent(id)}/rows?${qs}` as `/api/${string}`) : null,
    { placeholderData: keepPreviousData, retry: false },
  );

  const fail = (e: unknown) => {
    if (alive.current) setError(describeImportError(e));
  };

  const discard = useCallback(
    async (s: ImportSession | null) => {
      if (!s || s.status === "COMMITTING" || s.status === "COMMITTED") return;
      try {
        await apiFetch(`${base}/${encodeURIComponent(s.importId)}`, { method: "DELETE" });
      } catch {
        // Hủy chỉ là dọn dẹp: phiên tự hết hạn sau 30 phút.
      }
    },
    [base],
  );

  const upload = async (file: File) => {
    const bad = checkImportFile(file);
    if (bad) {
      setError({ text: bad });
      return;
    }
    setError(null);
    setUploading(true);
    try {
      if (session) await discard(session); // giữ tối đa 3 phiên mở: bỏ phiên cũ trước khi tải lên lại
      const fd = new FormData();
      fd.append("file", file);
      const s = await apiFetch<ImportSession>(base, { method: "POST", body: fd });
      if (!alive.current) return;
      setSession(s);
      setSheet(null);
      setRowStatus("");
      setPage(0);
    } catch (e) {
      setSession(null);
      fail(e);
    } finally {
      if (alive.current) setUploading(false);
    }
  };

  const confirm = async () => {
    if (!id) return;
    setError(null);
    setConfirming(true);
    try {
      const s = await apiFetch<ImportSession>(`${base}/${encodeURIComponent(id)}/confirm`, { method: "POST" });
      if (alive.current) setSession(s);
    } catch (e) {
      fail(e);
    } finally {
      if (alive.current) setConfirming(false);
    }
  };

  // Thăm dò tiến độ khi đang ghi.
  useEffect(() => {
    if (!id || status !== "COMMITTING") return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const s = await apiFetch<ImportSession>(`${base}/${encodeURIComponent(id)}`);
        if (stop) return;
        setSession(s);
        if (s.status === "COMMITTING") timer = setTimeout(() => void tick(), POLL_MS);
      } catch (e) {
        if (stop) return;
        if ((e as { code?: string }).code === "IMPORT_NOT_FOUND") {
          setSession(null);
          fail(e);
        } else timer = setTimeout(() => void tick(), POLL_MS * 2); // lỗi mạng/5xx tạm thời: thử lại
      }
    };
    timer = setTimeout(() => void tick(), POLL_MS);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, status, base]);

  // Ghi xong (kể cả lỗi giữa chừng): làm mới danh sách liên quan một lần cho mỗi lần đổi trạng thái.
  useEffect(() => {
    if (!id || !status || !TERMINAL.has(status)) return;
    const mark = `${id}:${status}`;
    if (invalidated.current === mark) return;
    invalidated.current = mark;
    void invalidate(...cfg.invalidate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, status]);

  const downloadTemplate = async () => {
    setError(null);
    setBusyDownload("template");
    try {
      const d = await apiDownload(`${base}/template`);
      saveBlob(d.blob, d.filename ?? "mau-nhap.xlsx");
    } catch (e) {
      fail(e);
    } finally {
      if (alive.current) setBusyDownload(null);
    }
  };

  const downloadErrors = async () => {
    if (!id) return;
    setError(null);
    setBusyDownload("errors");
    try {
      const d = await apiDownload(`${base}/${encodeURIComponent(id)}/error-file`);
      saveBlob(d.blob, d.filename ?? "dong-loi.xlsx");
    } catch (e) {
      fail(e);
    } finally {
      if (alive.current) setBusyDownload(null);
    }
  };

  /** File mật khẩu tạm (chỉ users): tải được đúng một lần; 410 = đã tải hoặc hết hạn. */
  const downloadCredentials = async () => {
    if (!id) return;
    setCredentials("loading");
    setCredentialsMessage(null);
    try {
      const d = await apiDownload(`${base}/${encodeURIComponent(id)}/credentials`);
      saveBlob(d.blob, d.filename ?? "mat-khau-tam.xlsx");
      if (alive.current) setCredentials("downloaded");
    } catch (e) {
      if (!alive.current) return;
      const code = (e as { code?: string }).code;
      setCredentials(code === "IMPORT_CREDENTIALS_GONE" ? "gone" : "error");
      setCredentialsMessage(describeImportError(e).text);
    }
  };

  /** Quay về bước chọn tệp (hủy phiên chưa ghi). */
  const reset = async () => {
    const s = session;
    setSession(null);
    setError(null);
    setCredentials("idle");
    setCredentialsMessage(null);
    await discard(s);
  };

  /** Hủy phiên chưa confirm khi đóng hộp thoại. */
  const cancel = () => discard(session);

  const phase: "pick" | "preview" | "committing" | "done" = !session
    ? "pick"
    : session.status === "VALIDATED"
      ? "preview"
      : session.status === "COMMITTING"
        ? "committing"
        : "done";

  /** Còn file mật khẩu tạm chưa tải (đóng hộp thoại là mất vĩnh viễn). */
  const credentialsPending =
    !!cfg.credentialsKey &&
    status === "COMMITTED" &&
    (session?.result?.created ?? 0) > 0 &&
    credentials !== "downloaded" &&
    credentials !== "gone";

  return {
    session,
    phase,
    uploading,
    confirming,
    error,
    setError,
    rows,
    rowsPerPage: ROWS_PER_PAGE,
    sheet: activeSheet,
    setSheet: (s: string) => {
      setSheet(s);
      setPage(0);
    },
    rowStatus,
    setRowStatus: (s: RowStatus | "") => {
      setRowStatus(s);
      setPage(0);
    },
    page,
    setPage,
    credentials,
    credentialsMessage,
    credentialsPending,
    busyDownload,
    upload,
    confirm,
    downloadTemplate,
    downloadErrors,
    downloadCredentials,
    reset,
    cancel,
  };
}
