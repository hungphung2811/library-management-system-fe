import { useRef, useState, type DragEvent } from "react";
import { Alert, App, Button, Modal, Progress, Segmented, Statistic, Table, Tabs, Tag, Text } from "../antd";
import { Download } from "../icons";
import type { DescribedError } from "../error-messages";
import { useExcelImport } from "./useExcelImport";
import type { ExcelImportConfig, ImportColumn, ImportRowView, RowIssue, RowStatus } from "./types";

const SHEET_LABELS: Record<string, string> = { DauSach: "Đầu sách", BanSao: "Bản sao" };
const sheetLabel = (s: string) => SHEET_LABELS[s] ?? s;

const STATUS_TAG: Record<RowStatus, { color: string; text: string }> = {
  VALID: { color: "success", text: "Hợp lệ" },
  INVALID: { color: "error", text: "Lỗi" },
  DUPLICATE: { color: "warning", text: "Trùng" },
};

function ErrorAlert({ error }: { error: DescribedError }) {
  return (
    <Alert
      type="error"
      showIcon
      role="alert"
      title={error.text}
      description={
        error.details?.length || error.detail ? (
          <div className="flex flex-col gap-1">
            {error.details && error.details.length > 0 && (
              <ul className="m-0 list-disc pl-5">
                {error.details.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            )}
            {error.detail && <span className="text-xs">{error.detail}</span>}
          </div>
        ) : undefined
      }
    />
  );
}

/** Vùng chọn/kéo thả tệp .xlsx. */
function DropZone({ disabled, loading, onFile }: { disabled?: boolean; loading?: boolean; onFile: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f && !disabled) onFile(f);
  };
  return (
    <div
      data-testid="excel-import-drop"
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={`flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center ${over ? "border-primary bg-primary-soft" : "border-line bg-subtle"}`}
    >
      <input
        ref={ref}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        hidden
        data-testid="excel-import-file"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = ""; // cho phép chọn lại cùng tên tệp sau khi sửa
          if (f) onFile(f);
        }}
      />
      <Text strong>Kéo thả tệp .xlsx vào đây</Text>
      <Text type="secondary">hoặc</Text>
      <Button type="primary" loading={loading} disabled={disabled} onClick={() => ref.current?.click()}>
        Chọn tệp Excel
      </Button>
      <Text type="secondary" className="text-xs">
        Tệp .xlsx, tối đa 5 MB và 5.000 dòng dữ liệu.
      </Text>
    </div>
  );
}

function cellIssue(issues: RowIssue[], col: string) {
  return issues.find((i) => i.column === col);
}

function PreviewTable({ imp, columns }: { imp: ReturnType<typeof useExcelImport>; columns: ImportColumn[] }) {
  const q = imp.rows;
  const data = q.data;
  const cols = [
    { title: "Dòng", dataIndex: "rowNumber", width: 64, fixed: "left" as const },
    {
      title: "Trạng thái",
      dataIndex: "status",
      width: 96,
      render: (v: RowStatus) => <Tag color={STATUS_TAG[v]?.color}>{STATUS_TAG[v]?.text ?? v}</Tag>,
    },
    ...columns.map((c) => ({
      title: c.required ? `${c.label} *` : c.label,
      key: c.key,
      render: (_: unknown, r: ImportRowView) => {
        const v = r.values?.[c.key];
        const issue = cellIssue(r.issues ?? [], c.key);
        const text = v == null || v === "" ? "—" : String(v);
        if (!issue) return text;
        return (
          <span className={issue.severity === "WARNING" ? "text-warning" : "text-error"} title={issue.message}>
            {text}
          </span>
        );
      },
    })),
    {
      title: "Vấn đề",
      key: "issues",
      width: 280,
      fixed: "right" as const,
      render: (_: unknown, r: ImportRowView) =>
        r.issues?.length ? (
          <ul className="m-0 list-none p-0">
            {r.issues.map((i, n) => {
              const label = columns.find((c) => c.key === i.column)?.label;
              return (
                <li key={`${i.code}-${n}`} className={i.severity === "WARNING" ? "text-warning" : "text-error"}>
                  {label ? `${label}: ` : ""}
                  {i.message}
                </li>
              );
            })}
          </ul>
        ) : (
          ""
        ),
    },
  ];
  return (
    <Table<ImportRowView>
      size="small"
      rowKey={(r) => `${r.sheet}-${r.rowNumber}`}
      aria-label="Xem trước các dòng"
      dataSource={data?.items ?? []}
      columns={cols}
      loading={q.isFetching}
      scroll={{ x: "max-content" }}
      locale={{ emptyText: q.isError ? "Không tải được các dòng. Thử lại sau." : "Không có dòng nào khớp bộ lọc." }}
      pagination={{
        current: imp.page + 1,
        pageSize: imp.rowsPerPage,
        total: data?.totalItems ?? 0,
        showSizeChanger: false,
        hideOnSinglePage: true,
        onChange: (p) => imp.setPage(p - 1),
      }}
    />
  );
}

/**
 * Hộp thoại nhập hàng loạt từ Excel (ADR-0024): chọn tệp -> xem trước từng dòng -> xác nhận -> tiến độ/kết quả.
 * Chỉ dùng qua `ExcelImportButton`; `onClosed` gọi sau khi hộp thoại đóng hẳn để cha gỡ nó.
 */
export function ExcelImportModal({ cfg, onClosed }: { cfg: ExcelImportConfig; onClosed: () => void }) {
  const { modal } = App.useApp();
  const imp = useExcelImport(cfg);
  const [visible, setVisible] = useState(true);
  const { session, phase } = imp;
  const busy = imp.uploading || imp.confirming;

  const close = () => {
    void imp.cancel();
    setVisible(false);
  };
  const requestClose = () => {
    if (phase === "committing" || busy) return;
    if (imp.credentialsPending) {
      modal.confirm({
        title: "Chưa tải file mật khẩu tạm",
        content:
          "File mật khẩu tạm chỉ tải được MỘT lần và hệ thống không lưu mật khẩu. Nếu đóng bây giờ, bạn sẽ không còn cách lấy mật khẩu của các tài khoản vừa tạo.",
        okText: "Đóng và bỏ file",
        cancelText: "Quay lại tải file",
        okButtonProps: { danger: true },
        onOk: close,
      });
      return;
    }
    close();
  };

  const totals = session?.totals;
  const result = session?.result;
  const sheet = session?.sheets.find((s) => s.sheet === imp.sheet) ?? session?.sheets[0];
  const hasProblems = (totals?.invalid ?? 0) + (totals?.duplicate ?? 0) > 0;

  const footer = (() => {
    if (phase === "pick") return [<Button key="x" onClick={requestClose}>Đóng</Button>];
    if (phase === "preview") {
      return [
        <Button key="x" onClick={requestClose} disabled={busy}>
          Hủy
        </Button>,
        hasProblems && (
          <Button key="err" icon={<Download size={16} />} loading={imp.busyDownload === "errors"} onClick={() => void imp.downloadErrors()}>
            Tải file lỗi
          </Button>
        ),
        <Button key="re" onClick={() => void imp.reset()} disabled={busy}>
          Tải lên lại
        </Button>,
        <Button
          key="ok"
          type="primary"
          loading={imp.confirming}
          disabled={(totals?.valid ?? 0) === 0}
          onClick={() => void imp.confirm()}
        >
          Xác nhận nhập {totals?.valid ?? 0} dòng
        </Button>,
      ];
    }
    if (phase === "committing") return [<Button key="x" disabled>Đang ghi dữ liệu...</Button>];
    return [
      session?.status === "INTERRUPTED" && (
        <Button key="resume" type="primary" loading={imp.confirming} onClick={() => void imp.confirm()}>
          Tiếp tục nhập
        </Button>
      ),
      session?.status === "COMMITTED" && !imp.credentialsPending && (
        <Button key="again" onClick={() => void imp.reset()}>
          Nhập tệp khác
        </Button>
      ),
      <Button key="x" type={session?.status === "INTERRUPTED" ? "default" : "primary"} onClick={requestClose}>
        Đóng
      </Button>,
    ];
  })();

  return (
    <Modal
      open={visible}
      title={cfg.title}
      width={960}
      mask={{ closable: false }}
      keyboard={phase !== "committing"}
      closable={phase !== "committing"}
      onCancel={requestClose}
      afterClose={onClosed}
      footer={<div className="flex flex-wrap justify-end gap-2">{footer}</div>}
    >
      <div className="flex flex-col gap-3">
        {imp.error && <ErrorAlert error={imp.error} />}

        {phase === "pick" && (
          <>
            {cfg.description && <Text type="secondary">{cfg.description}</Text>}
            <div className="flex flex-wrap items-center gap-2">
              <Button icon={<Download size={16} />} loading={imp.busyDownload === "template"} onClick={() => void imp.downloadTemplate()}>
                Tải file mẫu (.xlsx)
              </Button>
              <Text type="secondary">Điền vào sheet dữ liệu, giữ nguyên dòng tiêu đề; cột có dấu * là bắt buộc.</Text>
            </div>
            <DropZone loading={imp.uploading} disabled={imp.uploading} onFile={(f) => void imp.upload(f)} />
          </>
        )}

        {phase === "preview" && session && totals && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Text type="secondary">
                Tệp: <Text strong>{session.fileName ?? "(không tên)"}</Text> · {totals.total} dòng. Dữ liệu chưa được ghi, chỉ ghi khi bạn xác nhận.
              </Text>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="excel-import-totals">
              <Statistic title="Hợp lệ" value={totals.valid} styles={{ content: { color: "var(--color-success, #16a34a)" } }} />
              <Statistic title="Lỗi" value={totals.invalid} styles={{ content: totals.invalid ? { color: "var(--color-error, #dc2626)" } : undefined }} />
              <Statistic title="Trùng" value={totals.duplicate} />
              <Statistic title="Cảnh báo" value={totals.warning} />
            </div>
            <Alert
              type={totals.invalid > 0 ? "warning" : "info"}
              showIcon
              title={`Chỉ ${totals.valid} dòng hợp lệ được ghi.${totals.duplicate > 0 ? ` ${totals.duplicate} dòng trùng với dữ liệu đã có sẽ bị bỏ qua.` : ""}${totals.invalid > 0 ? ` ${totals.invalid} dòng lỗi không được ghi: tải file lỗi, sửa rồi tải lên lại.` : ""}`}
            />
            {session.sheets.length > 1 && (
              <Tabs
                activeKey={imp.sheet ?? session.sheets[0].sheet}
                onChange={imp.setSheet}
                items={session.sheets.map((s) => ({
                  key: s.sheet,
                  label: `${sheetLabel(s.sheet)} (${s.total})`,
                }))}
              />
            )}
            <Segmented<RowStatus | "">
              aria-label="Lọc theo trạng thái dòng"
              value={imp.rowStatus}
              onChange={imp.setRowStatus}
              options={[
                { value: "", label: "Tất cả" },
                { value: "VALID", label: `Hợp lệ (${sheet?.valid ?? totals.valid})` },
                { value: "INVALID", label: `Lỗi (${sheet?.invalid ?? totals.invalid})` },
                { value: "DUPLICATE", label: `Trùng (${sheet?.duplicate ?? totals.duplicate})` },
              ]}
            />
            <PreviewTable imp={imp} columns={sheet?.columns ?? []} />
          </>
        )}

        {phase === "committing" && session && (
          <div className="flex flex-col gap-2 py-4" data-testid="excel-import-progress">
            <Text strong>Đang ghi dữ liệu...</Text>
            <Progress
              percent={session.progress && session.progress.total > 0 ? Math.floor((session.progress.processed / session.progress.total) * 100) : 0}
              status="active"
            />
            <Text type="secondary">
              Đã xử lý {session.progress?.processed ?? 0}/{session.progress?.total ?? totals?.valid ?? 0} dòng. Vui lòng không đóng hộp thoại cho tới khi xong.
            </Text>
          </div>
        )}

        {phase === "done" && session && (
          <>
            {session.status === "COMMITTED" && (
              <Alert
                type={(result?.failed ?? 0) > 0 ? "warning" : "success"}
                showIcon
                title={`Đã nhập xong: tạo ${result?.created ?? 0} ${cfg.noun}.`}
              />
            )}
            {session.status === "COMMIT_FAILED" && (
              <Alert
                type="error"
                showIcon
                role="alert"
                title="Việc ghi dữ liệu bị lỗi giữa chừng."
                description={`Phần đã ghi được giữ lại (${result?.created ?? 0} dòng). Mã lỗi: ${session.errorCode ?? "không rõ"}. Kiểm tra danh sách rồi tải tệp lên lại nếu cần.`}
              />
            )}
            {session.status === "INTERRUPTED" && (
              <Alert
                type="warning"
                showIcon
                title="Việc ghi dữ liệu bị gián đoạn."
                description="Bấm Tiếp tục nhập để ghi nốt các dòng còn lại (dòng đã ghi không bị ghi lại)."
              />
            )}
            <div className="grid grid-cols-3 gap-3" data-testid="excel-import-result">
              <Statistic title="Đã tạo" value={result?.created ?? 0} />
              <Statistic title="Bỏ qua (trùng)" value={result?.skippedDuplicate ?? 0} />
              <Statistic title="Lỗi khi ghi" value={result?.failed ?? 0} />
            </div>
            {hasProblems && session.status !== "INTERRUPTED" && (
              <div>
                <Button icon={<Download size={16} />} loading={imp.busyDownload === "errors"} onClick={() => void imp.downloadErrors()}>
                  Tải file lỗi
                </Button>
              </div>
            )}
            {cfg.credentialsKey && session.status === "COMMITTED" && (result?.created ?? 0) > 0 && (
              <Alert
                type={imp.credentials === "gone" ? "info" : imp.credentials === "downloaded" ? "success" : "warning"}
                showIcon
                data-testid="excel-import-credentials"
                title={
                  imp.credentials === "downloaded"
                    ? "Đã tải file mật khẩu tạm. Hãy gửi cho từng người một cách an toàn."
                    : imp.credentials === "gone"
                      ? "File mật khẩu tạm đã được tải hoặc đã hết hạn, không tải lại được."
                      : "Tải ngay file mật khẩu tạm: chỉ tải được MỘT lần."
                }
                description={
                  <div className="flex flex-col gap-2">
                    {imp.credentials !== "gone" && imp.credentials !== "downloaded" && (
                      <span>
                        Hệ thống không lưu mật khẩu. Nếu đóng hộp thoại khi chưa tải, bạn sẽ không còn cách lấy mật khẩu của các tài khoản vừa tạo
                        (mỗi người phải đổi mật khẩu ở lần đăng nhập đầu).
                      </span>
                    )}
                    {imp.credentialsMessage && <span className="text-error">{imp.credentialsMessage}</span>}
                    {imp.credentials !== "gone" && (
                      <span>
                        <Button
                          type={imp.credentials === "downloaded" ? "default" : "primary"}
                          size="small"
                          icon={<Download size={16} />}
                          loading={imp.credentials === "loading"}
                          onClick={() => void imp.downloadCredentials()}
                        >
                          {imp.credentials === "downloaded" ? "Tải lại (thường đã hết hạn)" : "Tải file mật khẩu tạm"}
                        </Button>
                      </span>
                    )}
                  </div>
                }
              />
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
