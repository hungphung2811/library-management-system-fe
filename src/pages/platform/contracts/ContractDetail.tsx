import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { apiFetch, toErrorInfo, useApi, useInvalidateApi } from "@/api";
import {
  Alert,
  App,
  Breadcrumb,
  Button,
  Card,
  ConfirmAction,
  DataTable,
  DatePicker,
  ErrorPanel,
  Form,
  FormModal,
  Input,
  InputNumber,
  KeyValueList,
  PageHeader,
  PageSkeleton,
  Result,
  Statistic,
  Tag,
  dayjs,
  formatDate,
  formatDateTime,
  formatMoney,
} from "@/ui";
import type { Dayjs } from "dayjs";
import { PlatformGate } from "../_components/PlatformGate";
import { billingCycleText, contractStatusLabel, HISTORY_LABEL } from "../_lib/contract-format";
import type { Contract, ContractDetail, ContractHistoryEntry, ContractPayment, TenantContractList } from "../_lib/contract-types";
import { moduleLabel } from "../_lib/tenant-format";
import { ContractFormModal } from "./ContractFormModal";

export default function ContractDetailPage() {
  return (
    <PlatformGate>
      <Detail />
    </PlatformGate>
  );
}

const money = (n: number) => <span className="tabular-nums">{formatMoney(n)}</span>;
const vnd = {
  formatter: (v: number | string | undefined) => (v == null ? "" : String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ".")),
  parser: (v: string | undefined) => Number(String(v ?? "").replace(/\./g, "")) || 0,
};

function Detail() {
  const { id: tenantId = "", contractId = "" } = useParams();
  const tenantEnc = encodeURIComponent(tenantId);
  const cEnc = encodeURIComponent(contractId);
  const { message } = App.useApp();
  const invalidate = useInvalidateApi();
  const nav = useNavigate();
  const [form, setForm] = useState<"edit" | "renew" | null>(null);
  const [dialog, setDialog] = useState<"extend" | "cancel" | "payment" | null>(null);

  const q = useApi<ContractDetail>(`/api/platform/contracts/${cEnc}`);
  const history = useApi<ContractHistoryEntry[]>(`/api/platform/contracts/${cEnc}/history`);
  const list = useApi<TenantContractList>(`/api/platform/tenants/${tenantEnc}/contracts`);

  const reload = () => invalidate("/api/platform/contracts", "/api/platform/tenants");
  /** Gọi BE rồi tải lại; CONTRACT_VERSION_CONFLICT thì tải lại bản mới trước khi báo lỗi. */
  const call = async <T,>(path: `/api/${string}`, json?: unknown): Promise<T> => {
    try {
      const r = await apiFetch<T>(path, json === undefined ? { method: "POST" } : { method: "POST", json });
      await reload();
      return r;
    } catch (e) {
      if (toErrorInfo(e).code === "CONTRACT_VERSION_CONFLICT") await reload();
      throw e;
    }
  };

  if (q.isPending) return <PageSkeleton variant="form" />;
  if (q.isError) {
    const info = toErrorInfo(q.error);
    return info.status === 404 || info.code === "CONTRACT_NOT_FOUND" ? (
      <Result
        status="404"
        title="Không tìm thấy hợp đồng"
        extra={
          <Link to={`/platform/tenants/${tenantEnc}?tab=contracts`}>
            <Button>Về danh sách hợp đồng</Button>
          </Link>
        }
      />
    ) : (
      <ErrorPanel error={info} onRetry={() => void q.refetch()} />
    );
  }

  const c: ContractDetail = q.data;
  const st = contractStatusLabel(c.status, c.phase);
  const draft = c.status === "DRAFT";
  const active = c.status === "ACTIVE";
  const canExtend = active && !c.legacy && !!c.endDate;
  const canRenew = active || c.status === "EXPIRED";
  const canCancel = draft || active;
  const canPay = !draft;
  const enabled = list.data?.enabledModules ?? [];
  const uncovered = draft ? enabled.filter((m) => !c.modules.includes(m)) : [];

  return (
    <div className="flex max-w-[1200px] flex-col gap-4">
      <Breadcrumb
        items={[
          { title: <Link to="/platform/tenants">Đơn vị</Link> },
          { title: <Link to={`/platform/tenants/${tenantEnc}?tab=contracts`}>Hợp đồng</Link> },
          { title: c.name },
        ]}
      />
      <PageHeader
        title={c.name}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <Tag color={st.color}>{st.label}</Tag>
            {c.legacy && <Tag>Hợp đồng chuyển tiếp</Tag>}
            <span className="text-muted">Phiên bản {c.version}</span>
          </span>
        }
        actions={
          <span className="flex flex-wrap gap-2">
            <Button onClick={() => void Promise.all([q.refetch(), history.refetch()])}>Tải lại</Button>
            {(draft || active) && <Button onClick={() => setForm("edit")}>{draft ? "Sửa" : "Sửa ghi chú"}</Button>}
            {draft && (
              <ConfirmAction
                title="Kích hoạt hợp đồng này?"
                description={
                  c.startDate && dayjs(c.startDate).isAfter(dayjs(), "day")
                    ? "Ngày bắt đầu ở tương lai: module được áp dụng khi tới ngày."
                    : "Ngày bắt đầu đã tới: module áp dụng ngay và đơn vị bị tạm ngưng do hết hạn sẽ tự mở lại."
                }
                okText="Kích hoạt"
                onConfirm={async () => {
                  await call(`/api/platform/contracts/${cEnc}/activate`);
                  message.success("Đã kích hoạt hợp đồng");
                }}
              >
                <Button type="primary">Kích hoạt</Button>
              </ConfirmAction>
            )}
            {canExtend && <Button onClick={() => setDialog("extend")}>Kéo dài</Button>}
            {canRenew && <Button onClick={() => setForm("renew")}>Gia hạn</Button>}
            {canPay && <Button onClick={() => setDialog("payment")}>Ghi thanh toán</Button>}
            {canCancel && (
              <Button danger onClick={() => setDialog("cancel")}>
                Hủy hợp đồng
              </Button>
            )}
          </span>
        }
      />

      {uncovered.length > 0 && (
        <Alert
          type="warning"
          showIcon
          title={`Đơn vị đang bật module ngoài hợp đồng này: ${uncovered.map(moduleLabel).join(", ")}`}
          description="Khi kích hoạt, module đang bật mà không thuộc hợp đồng mới (và không được hợp đồng khác bao phủ) sẽ bị tắt sau ân hạn kể từ ngày bắt đầu."
        />
      )}
      {active && c.phase === "IN_GRACE" && (
        <Alert
          type="warning"
          showIcon
          title={`Hợp đồng đã quá ngày kết thúc, đang ân hạn tới ${formatDate(c.graceEndsDate)}`}
          description="Module vẫn bật trong ân hạn. Hãy kéo dài hoặc gia hạn trước hạn chót; sau đó module của hợp đồng bị tắt."
        />
      )}
      {c.status === "CANCELLED" && c.cancelReason && <Alert type="error" showIcon title={`Lý do hủy: ${c.cancelReason}`} />}
      {c.retainedModule && (
        <Alert
          type="info"
          showIcon
          title={`Module giữ lại: ${moduleLabel(c.retainedModule)}`}
          description="Đơn vị phải còn ít nhất một module nên module này được giữ bật và đơn vị bị tạm ngưng."
        />
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card size="small" data-testid="sum-total">
          <Statistic title="Tổng tiền" value={formatMoney(c.totalAmount)} />
        </Card>
        <Card size="small" data-testid="sum-paid">
          <Statistic title="Đã thu" value={formatMoney(c.paidAmount)} />
        </Card>
        <Card size="small" data-testid="sum-outstanding">
          <Statistic title="Còn nợ" value={formatMoney(c.outstandingAmount)} />
        </Card>
      </div>

      <Card>
        <KeyValueList
          columns={2}
          items={[
            {
              label: "Module",
              value: (
                <span className="inline-flex flex-wrap gap-1">
                  {c.modules.map((m) => (
                    <Tag key={m}>{moduleLabel(m)}</Tag>
                  ))}
                </span>
              ),
            },
            { label: "Chu kỳ thanh toán", value: billingCycleText(c.billingCycle) },
            { label: "Ngày bắt đầu", value: formatDate(c.startDate) },
            { label: "Ngày kết thúc", value: c.endDate ? formatDate(c.endDate) : "Không thời hạn" },
            { label: "Hết ân hạn", value: c.graceEndsDate ? formatDate(c.graceEndsDate) : null },
            { label: "Áp dụng module lúc", value: c.modulesAppliedAt ? formatDateTime(c.modulesAppliedAt) : null },
            { label: "Ghi chú nội bộ", value: c.internalNote },
            { label: "Mã hợp đồng", value: c.id, mono: true },
          ]}
        />
      </Card>

      <Card title="Thanh toán" size="small">
        <p className="mt-0 text-sm text-muted">Thanh toán bất biến: không sửa hay xóa. Ghi sai thì đảo toàn phần (một lần) rồi ghi lại khoản đúng.</p>
        <DataTable
          rowKey="id"
          embedded
          mobileTitleKey="paidOn"
          rows={c.payments}
          columns={[
            { key: "paidOn", title: "Ngày", dataIndex: "paidOn", kind: "date" },
            { key: "amount", title: "Số tiền", dataIndex: "amount", align: "right", render: (v) => money(v as number) },
            { key: "reference", title: "Mã tham chiếu", dataIndex: "reference", kind: "mono" },
            { key: "note", title: "Ghi chú", dataIndex: "note" },
            { key: "recordedAt", title: "Ghi lúc", dataIndex: "recordedAt", kind: "datetime" },
            {
              key: "state",
              title: "Trạng thái",
              dataIndex: "id",
              render: (_, row) => {
                const p = row as unknown as ContractPayment;
                if (p.reversesPaymentId) return <Tag>Dòng đảo</Tag>;
                if (p.reversedByPaymentId) return <Tag color="warning">Đã đảo</Tag>;
                return (
                  <ConfirmAction
                    title="Đảo toàn phần khoản thanh toán này?"
                    description="Tạo một dòng đảo số tiền âm; chỉ đảo được một lần và không hoàn tác."
                    okText="Đảo"
                    danger
                    onConfirm={async () => {
                      await call(`/api/platform/contracts/${cEnc}/payments/${encodeURIComponent(p.id)}/reverse`, {});
                      message.success("Đã đảo khoản thanh toán");
                    }}
                  >
                    <Button size="small" danger>
                      Đảo
                    </Button>
                  </ConfirmAction>
                );
              },
            },
          ]}
          empty={{ title: draft ? "Hợp đồng nháp chưa ghi thanh toán được." : "Chưa có khoản thanh toán nào." }}
        />
      </Card>

      <Card title="Lịch sử thay đổi" size="small">
        {history.isPending ? (
          <PageSkeleton />
        ) : history.isError ? (
          <ErrorPanel error={toErrorInfo(history.error)} onRetry={() => void history.refetch()} />
        ) : (
          <DataTable
            rowKey="id"
            embedded
            mobileTitleKey="label"
            rows={history.data.map((h) => ({ ...h, label: HISTORY_LABEL[h.type] ?? h.type, actor: h.actorType === "SYSTEM" ? "Hệ thống" : "Người dùng" }))}
            columns={[
              { key: "occurredAt", title: "Thời điểm", dataIndex: "occurredAt", kind: "datetime" },
              { key: "label", title: "Sự kiện", dataIndex: "label" },
              { key: "actor", title: "Thực hiện", dataIndex: "actor" },
              { key: "data", title: "Chi tiết", dataIndex: "data", render: (v) => (v ? <span className="font-mono text-xs">{JSON.stringify(v)}</span> : "—") },
            ]}
            empty={{ title: "Chưa có lịch sử." }}
          />
        )}
      </Card>

      {form && (
        <ContractFormModal
          mode={{ kind: form, contract: c as Contract }}
          open
          onClose={() => setForm(null)}
          onSaved={async (saved) => {
            await reload();
            // Gia hạn tạo hợp đồng nối tiếp (nháp): mở hợp đồng đó.
            if (form === "renew") nav(`/platform/tenants/${tenantEnc}/contracts/${encodeURIComponent(saved.id)}`);
          }}
        />
      )}

      <FormModal<{ endDate: Dayjs }>
        open={dialog === "extend"}
        title="Kéo dài ngày kết thúc"
        okText="Kéo dài"
        onCancel={() => setDialog(null)}
        successMessage="Đã kéo dài hợp đồng"
        onSubmit={async (v) => {
          await call(`/api/platform/contracts/${cEnc}/extend`, { endDate: v.endDate.format("YYYY-MM-DD"), version: c.version });
        }}
      >
        <Form.Item
          name="endDate"
          label="Ngày kết thúc mới"
          extra={`Chỉ dời ra sau ngày hiện tại (${formatDate(c.endDate)}); muốn rút ngắn hãy hủy.`}
          rules={[{ required: true, message: "Chọn ngày kết thúc mới" }]}
        >
          <DatePicker format="DD/MM/YYYY" className="w-full" disabledDate={(d) => !!c.endDate && !d.isAfter(dayjs(c.endDate), "day")} />
        </Form.Item>
      </FormModal>

      <FormModal<{ reason: string }>
        open={dialog === "cancel"}
        title="Hủy hợp đồng"
        okText="Xác nhận hủy"
        onCancel={() => setDialog(null)}
        successMessage="Đã hủy hợp đồng"
        onSubmit={async (v) => {
          await call(`/api/platform/contracts/${cEnc}/cancel`, { reason: v.reason.trim() });
        }}
      >
        <Alert
          type="warning"
          showIcon
          className="mb-3"
          title={
            draft
              ? "Hợp đồng nháp bị hủy sẽ không dùng được nữa."
              : "Hợp đồng đã áp dụng: module bị thu hồi NGAY, không có ân hạn; nếu đơn vị không còn module nào thì giữ một module và bị tạm ngưng."
          }
        />
        <Form.Item name="reason" label="Lý do hủy" rules={[{ required: true, whitespace: true, message: "Nhập lý do hủy" }]}>
          <Input.TextArea rows={3} maxLength={1000} />
        </Form.Item>
      </FormModal>

      <FormModal<{ paidOn: Dayjs; amount: number; reference?: string; note?: string }>
        open={dialog === "payment"}
        title="Ghi thanh toán"
        okText="Ghi thanh toán"
        onCancel={() => setDialog(null)}
        successMessage="Đã ghi thanh toán"
        initialValues={{ paidOn: dayjs() }}
        onSubmit={async (v) => {
          await call(`/api/platform/contracts/${cEnc}/payments`, {
            paidOn: v.paidOn.format("YYYY-MM-DD"),
            amount: v.amount,
            reference: v.reference?.trim() || null,
            note: v.note?.trim() || null,
          });
        }}
      >
        <Form.Item name="paidOn" label="Ngày thanh toán" rules={[{ required: true, message: "Chọn ngày thanh toán" }]}>
          <DatePicker format="DD/MM/YYYY" className="w-full" />
        </Form.Item>
        <Form.Item name="amount" label="Số tiền (VND)" rules={[{ required: true, type: "number", min: 1, message: "Nhập số tiền lớn hơn 0" }]}>
          <InputNumber<number> className="w-full" min={1} step={1000} precision={0} formatter={vnd.formatter} parser={vnd.parser} />
        </Form.Item>
        <Form.Item name="reference" label="Mã tham chiếu" extra="Ví dụ số chứng từ, mã giao dịch ngân hàng.">
          <Input autoComplete="off" maxLength={255} />
        </Form.Item>
        <Form.Item name="note" label="Ghi chú" extra="Có thể ghi phương thức thanh toán (chuyển khoản, tiền mặt...).">
          <Input.TextArea rows={2} maxLength={1000} />
        </Form.Item>
      </FormModal>
    </div>
  );
}
