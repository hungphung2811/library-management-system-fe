import { useState } from "react";
import { PERMISSIONS, apiFetch, can, toErrorInfo, useApi, useApiMutation, useSession } from "@/api";
import { Alert, App, Button, Card, Form, InputNumber, NoPermission, PageHeader, QueryBoundary, describeError, formatDateTime } from "@/ui";

type Policy = {
  loanDays: number;
  maxRenewals: number;
  renewalDays: number;
  maxActiveLoansPerReader: number;
  finePerDay: number;
  graceDays: number;
  reservationHoldDays: number;
  custom: boolean;
  version: number;
  updatedAt: string | null;
};

type Values = Omit<Policy, "custom" | "version" | "updatedAt">;

const money = {
  formatter: (v: number | string | undefined) => (v == null ? "" : String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ".")),
  parser: (v: string | undefined) => Number(String(v ?? "").replace(/\./g, "")) || 0,
};

function PolicyForm({ data, canUpdate, onReload }: { data: Policy; canUpdate: boolean; onReload: () => void }) {
  const [error, setError] = useState<ReturnType<typeof toErrorInfo> | null>(null);
  const { message } = App.useApp();
  const save = useApiMutation(
    (v: Values) => apiFetch<Policy>("/api/circulation/policy", { method: "PUT", json: { ...v, version: data.version } }),
    { invalidate: ["/api/circulation/policy"] },
  );
  const conflict = error?.code === "POLICY_VERSION_CONFLICT";
  const d = error ? describeError(error) : null;

  return (
    <Card className="max-w-[720px]">
      <Alert
        className="mb-4"
        type="info"
        showIcon
        title="Chính sách chỉ áp dụng cho phiếu và thao tác mới, không tính lại phiếu cũ."
        description={
          data.custom
            ? "Khi đã lưu, số ngày mượn và hạn mức số sách ở đây thay cho quy định theo loại độc giả."
            : "Đơn vị chưa lưu chính sách riêng nên đang dùng quy định mặc định của hệ thống."
        }
      />
      <Form<Values>
        layout="vertical"
        disabled={!canUpdate}
        initialValues={{
          loanDays: data.loanDays,
          maxRenewals: data.maxRenewals,
          renewalDays: data.renewalDays,
          maxActiveLoansPerReader: data.maxActiveLoansPerReader,
          finePerDay: data.finePerDay,
          graceDays: data.graceDays,
          reservationHoldDays: data.reservationHoldDays,
        }}
        onFinish={(v) => {
          setError(null);
          save.mutate(v, { onSuccess: () => message.success("Đã lưu chính sách mượn trả."), onError: (e) => setError(toErrorInfo(e)) });
        }}
      >
        {d && (
          <Alert
            className="mb-4"
            type="error"
            showIcon
            title={d.text}
            description={d.details?.length ? d.details.join("; ") : undefined}
            action={
              conflict ? (
                <Button size="small" onClick={onReload}>
                  Tải lại chính sách
                </Button>
              ) : undefined
            }
          />
        )}
        <div className="grid gap-x-4 sm:grid-cols-2">
          <Form.Item name="loanDays" label="Số ngày mượn" rules={[{ required: true, message: "Nhập số ngày mượn" }]} extra="1 đến 365 ngày.">
            <InputNumber className="w-full" min={1} max={365} precision={0} />
          </Form.Item>
          <Form.Item name="maxActiveLoansPerReader" label="Số sách tối đa mỗi độc giả đang mượn" rules={[{ required: true, message: "Nhập số sách" }]} extra="1 đến 100.">
            <InputNumber className="w-full" min={1} max={100} precision={0} />
          </Form.Item>
          <Form.Item name="maxRenewals" label="Số lần gia hạn tối đa" rules={[{ required: true, message: "Nhập số lần" }]} extra="0 đến 20 (0 là không cho gia hạn).">
            <InputNumber className="w-full" min={0} max={20} precision={0} />
          </Form.Item>
          <Form.Item name="renewalDays" label="Số ngày mỗi lần gia hạn" rules={[{ required: true, message: "Nhập số ngày" }]} extra="1 đến 365 ngày.">
            <InputNumber className="w-full" min={1} max={365} precision={0} />
          </Form.Item>
          <Form.Item name="finePerDay" label="Phạt trả trễ mỗi ngày (VND)" rules={[{ required: true, message: "Nhập mức phạt" }]} extra="0 đến 10.000.000, số nguyên đồng.">
            <InputNumber<number> className="w-full" min={0} max={10000000} step={1000} precision={0} formatter={money.formatter} parser={money.parser} />
          </Form.Item>
          <Form.Item name="graceDays" label="Số ngày ân hạn trước khi phạt" rules={[{ required: true, message: "Nhập số ngày" }]} extra="0 đến 90 ngày.">
            <InputNumber className="w-full" min={0} max={90} precision={0} />
          </Form.Item>
          <Form.Item name="reservationHoldDays" label="Số ngày giữ sách đặt trước" rules={[{ required: true, message: "Nhập số ngày" }]} extra="1 đến 30 ngày kể từ khi sách sẵn sàng.">
            <InputNumber className="w-full" min={1} max={30} precision={0} />
          </Form.Item>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {canUpdate && (
            <Button type="primary" htmlType="submit" loading={save.isPending}>
              Lưu chính sách
            </Button>
          )}
          <span className="text-sm text-muted">
            Phiên bản {data.version}
            {data.updatedAt ? ` · cập nhật ${formatDateTime(data.updatedAt)}` : " · đang dùng giá trị mặc định, chưa từng lưu"}
          </span>
        </div>
      </Form>
    </Card>
  );
}

export default function CirculationPolicyPage() {
  const s = useSession();
  const allowed = can(s, PERMISSIONS.CIRCULATION_POLICY_GET);
  const q = useApi<Policy>(allowed ? "/api/circulation/policy" : null);
  return (
    <>
      <PageHeader title="Chính sách mượn trả" description="Số ngày mượn, gia hạn, mức phạt, giữ chỗ đặt trước và hạn mức số sách của đơn vị." />
      {!allowed ? (
        <NoPermission feature="Chính sách mượn trả" />
      ) : (
        <QueryBoundary query={q}>
          {(data) => <PolicyForm key={data.version} data={data} canUpdate={can(s, PERMISSIONS.CIRCULATION_POLICY_UPDATE)} onReload={() => void q.refetch()} />}
        </QueryBoundary>
      )}
    </>
  );
}
