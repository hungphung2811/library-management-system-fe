import { useRef, useState } from "react";
import { apiFetch, saveBlob, toErrorInfo, useApiMutation } from "@/api";
import { Alert, Button, ERROR_MESSAGES, Modal, Table, Tag, Text, describeError } from "@/ui";
import { IMPORT_HEADERS, IMPORT_MAX_ROWS, parseImportCsv, toCsv, type ImportRow } from "../_lib/csv";

type RowResult = {
  row: number;
  username: string;
  status: "CREATED" | "VALID" | "FAILED";
  errorCode?: string | null;
  message?: string | null;
  temporaryPassword?: string | null;
};
type ImportResponse = { total: number; created: number; failed: number; results: RowResult[] };

/** Nút + hộp thoại nhập người dùng từ CSV: kiểm tra (dryRun) rồi nhập thật. Mật khẩu tạm chỉ giữ trong state, xóa khi đóng. */
export function ImportUsersButton() {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [checked, setChecked] = useState<ImportResponse | null>(null);
  const [done, setDone] = useState<ImportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const run = useApiMutation(
    (dryRun: boolean) => apiFetch<ImportResponse>("/api/users/imports", { method: "POST", json: { dryRun, rows } }),
    { invalidate: ["/api/users"] },
  );

  const reset = () => {
    setFileName(null);
    setRows([]);
    setParseError(null);
    setChecked(null);
    setDone(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const onFile = async (f: File | undefined) => {
    setChecked(null);
    setDone(null);
    setError(null);
    setRows([]);
    setParseError(null);
    setFileName(f?.name ?? null);
    if (!f) return;
    const r = parseImportCsv(await f.text());
    if ("error" in r) setParseError(r.error);
    else setRows(r.rows);
  };

  const exec = async (dryRun: boolean) => {
    setError(null);
    try {
      const r = await run.mutateAsync(dryRun);
      if (dryRun) setChecked(r);
      else setDone(r);
    } catch (e) {
      setError(describeError(toErrorInfo(e)).text);
    }
  };

  const downloadTemplate = () => {
    const csv = toCsv([
      [...IMPORT_HEADERS],
      ["nguyenvana", "Nguyễn Văn A", "nguyenvana@example.com", "KHOA-CNTT", "", "true"],
    ]);
    saveBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), "mau-nhap-nguoi-dung.csv");
  };

  const downloadCreated = () => {
    if (!done) return;
    const created = done.results.filter((r) => r.status === "CREATED");
    const csv = toCsv([["username", "temporaryPassword"], ...created.map((r) => [r.username, r.temporaryPassword ?? ""])]);
    saveBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), "nguoi-dung-da-tao.csv");
  };

  const shown = done ?? checked;
  const validCount = checked ? checked.results.filter((r) => r.status === "VALID").length : 0;
  const canImport = !!checked && validCount > 0 && !done && !run.isPending;

  return (
    <>
      <Button onClick={() => setOpen(true)}>Nhập từ CSV</Button>
      <Modal
        open={open}
        title="Nhập người dùng từ CSV"
        width={820}
        mask={{ closable: false }}
        onCancel={() => setOpen(false)}
        afterClose={reset}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button onClick={() => setOpen(false)}>Đóng</Button>
            {!done && (
              <>
                <Button onClick={() => void exec(true)} disabled={rows.length === 0 || run.isPending} loading={run.isPending && !checked}>
                  Kiểm tra
                </Button>
                <Button type="primary" onClick={() => void exec(false)} disabled={!canImport} loading={run.isPending && !!checked}>
                  Nhập{checked ? ` ${validCount} dòng hợp lệ` : ""}
                </Button>
              </>
            )}
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <Text type="secondary">
            Tệp .csv có dòng tiêu đề: username, fullName, email, departmentCode, temporaryPassword, reader (true để tạo luôn hồ sơ độc giả).
            Tối đa {IMPORT_MAX_ROWS} dòng. Bỏ trống mật khẩu tạm để hệ thống tự sinh; người dùng phải đổi mật khẩu ở lần đăng nhập đầu.
          </Text>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={(e) => void onFile(e.target.files?.[0])}
              data-testid="import-file"
            />
            <Button onClick={() => fileRef.current?.click()} disabled={!!done}>
              Chọn tệp CSV
            </Button>
            <Button type="link" onClick={downloadTemplate}>
              Tải mẫu CSV
            </Button>
            {fileName && (
              <Text type="secondary">
                {fileName}
                {rows.length > 0 ? ` (${rows.length} dòng)` : ""}
              </Text>
            )}
          </div>
          {parseError && <Alert type="error" showIcon title={parseError} />}
          {error && <Alert type="error" showIcon title={error} />}
          {checked && !done && (
            <Alert
              type={checked.failed > 0 ? "warning" : "success"}
              showIcon
              title={`Kiểm tra xong: ${validCount} dòng hợp lệ, ${checked.failed} dòng lỗi.`}
              description={checked.failed > 0 ? "Dòng lỗi sẽ bị bỏ qua khi nhập. Sửa tệp rồi chọn lại nếu muốn nhập cả các dòng này." : undefined}
            />
          )}
          {done && (
            <Alert
              type={done.failed > 0 ? "warning" : "success"}
              showIcon
              title={`Đã tạo ${done.created} người dùng, ${done.failed} dòng lỗi.`}
              description={
                done.created > 0 ? (
                  <div className="flex flex-col gap-2">
                    <span>
                      Mật khẩu tạm chỉ hiển thị MỘT lần và sẽ mất khi đóng hộp thoại này. Hãy tải về và gửi cho từng người một cách an toàn.
                    </span>
                    <span>
                      <Button size="small" type="primary" onClick={downloadCreated}>
                        Tải CSV các dòng đã tạo (kèm mật khẩu tạm)
                      </Button>
                    </span>
                  </div>
                ) : undefined
              }
            />
          )}
          {shown && (
            <Table<RowResult>
              size="small"
              rowKey="row"
              dataSource={shown.results}
              pagination={shown.results.length > 10 ? { pageSize: 10, showSizeChanger: false } : false}
              columns={[
                { title: "Dòng", dataIndex: "row", width: 64 },
                { title: "Tên đăng nhập", dataIndex: "username" },
                {
                  title: "Kết quả",
                  dataIndex: "status",
                  width: 110,
                  render: (v: RowResult["status"]) =>
                    v === "FAILED" ? <Tag color="error">Lỗi</Tag> : <Tag color="success">{v === "CREATED" ? "Đã tạo" : "Hợp lệ"}</Tag>,
                },
                {
                  title: "Thông điệp",
                  render: (_: unknown, r: RowResult) =>
                    r.status === "FAILED" ? (r.errorCode && ERROR_MESSAGES[r.errorCode]) || r.message || r.errorCode || "Lỗi" : "",
                },
                ...(done
                  ? [
                      {
                        title: "Mật khẩu tạm",
                        render: (_: unknown, r: RowResult) =>
                          r.temporaryPassword ? <Text code copyable>{r.temporaryPassword}</Text> : "",
                      },
                    ]
                  : []),
              ]}
            />
          )}
        </div>
      </Modal>
    </>
  );
}
