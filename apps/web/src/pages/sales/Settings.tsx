import { useState } from "react";
import { PERMISSIONS, apiFetch, can, toErrorInfo, useApi, useApiMutation, useSession } from "@/api";
import { Alert, App, Button, Card, Form, InputNumber, QueryBoundary, Switch, describeError, formatDateTime } from "@/ui";
import { MoneyInput } from "./_components/MoneyInput";
import { SalesGate } from "./_components/SalesGate";
import type { SalesSettings } from "./_lib/sales";

type FormValues = {
  vatPercent: number;
  pricesIncludeVat: boolean;
  returnWindowDays: number;
  fixedShippingFee: number;
  lowStockThreshold: number;
  walkInPiiRetentionMonths: number;
};

function SettingsForm({ data, canUpdate, onReload }: { data: SalesSettings; canUpdate: boolean; onReload: () => void }) {
  const [error, setError] = useState<ReturnType<typeof toErrorInfo> | null>(null);
  const { message } = App.useApp();
  const save = useApiMutation(
    (v: FormValues) =>
      apiFetch<SalesSettings>("/api/sales/settings", {
        method: "PUT",
        json: {
          vatRateBps: Math.round(v.vatPercent * 100),
          pricesIncludeVat: v.pricesIncludeVat,
          returnWindowDays: v.returnWindowDays,
          fixedShippingFee: v.fixedShippingFee,
          lowStockThreshold: v.lowStockThreshold,
          walkInPiiRetentionMonths: v.walkInPiiRetentionMonths,
          version: data.version,
        },
      }),
    { invalidate: ["/api/sales/settings"] },
  );
  const conflict = error?.code === "SETTINGS_VERSION_CONFLICT";
  const d = error ? describeError(error) : null;

  return (
    <Card className="max-w-[720px]">
      <Form<FormValues>
        layout="vertical"
        disabled={!canUpdate}
        initialValues={{
          vatPercent: data.vatRateBps / 100,
          pricesIncludeVat: data.pricesIncludeVat,
          returnWindowDays: data.returnWindowDays,
          fixedShippingFee: data.fixedShippingFee,
          lowStockThreshold: data.lowStockThreshold,
          walkInPiiRetentionMonths: data.walkInPiiRetentionMonths,
        }}
        onFinish={(v) => {
          setError(null);
          save.mutate(v, { onSuccess: () => message.success("Đã lưu cấu hình bán hàng."), onError: (e) => setError(toErrorInfo(e)) });
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
                  Tải lại cấu hình
                </Button>
              ) : undefined
            }
          />
        )}
        <div className="grid gap-x-4 sm:grid-cols-2">
          <Form.Item name="vatPercent" label="Thuế VAT (%)" rules={[{ required: true, message: "Nhập thuế VAT" }]} extra="Từ 0 đến 100, tối đa 2 chữ số thập phân.">
            <InputNumber className="w-full" min={0} max={100} step={0.5} precision={2} decimalSeparator="," />
          </Form.Item>
          <Form.Item name="pricesIncludeVat" label="Giá bán đã gồm VAT" valuePropName="checked">
            <Switch checkedChildren="Có" unCheckedChildren="Không" />
          </Form.Item>
          <Form.Item name="returnWindowDays" label="Số ngày cho phép trả hàng" rules={[{ required: true, message: "Nhập số ngày" }]} extra="0 đến 365.">
            <InputNumber className="w-full" min={0} max={365} precision={0} />
          </Form.Item>
          <Form.Item name="lowStockThreshold" label="Ngưỡng cảnh báo sắp hết hàng" rules={[{ required: true, message: "Nhập ngưỡng tồn" }]}>
            <InputNumber className="w-full" min={0} max={100000} precision={0} />
          </Form.Item>
          <Form.Item name="fixedShippingFee" label="Phí vận chuyển cố định" rules={[{ required: true, message: "Nhập phí" }]}>
            <MoneyInput max={100000000} />
          </Form.Item>
          <Form.Item
            name="walkInPiiRetentionMonths"
            label="Lưu giữ dữ liệu khách vãng lai (tháng)"
            rules={[{ required: true, message: "Nhập số tháng" }]}
            extra="1 đến 120 tháng; quá hạn thì tên và điện thoại được ẩn danh."
          >
            <InputNumber className="w-full" min={1} max={120} precision={0} />
          </Form.Item>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {canUpdate && (
            <Button type="primary" htmlType="submit" loading={save.isPending}>
              Lưu cấu hình
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

export default function SalesSettingsPage() {
  const s = useSession();
  const allowed = can(s, PERMISSIONS.SALES_SETTINGS_VIEW);
  const q = useApi<SalesSettings>(allowed ? "/api/sales/settings" : null);
  return (
    <SalesGate title="Cấu hình bán hàng" description="Thuế, trả hàng, ngưỡng tồn, phí vận chuyển và lưu giữ dữ liệu khách." permission={PERMISSIONS.SALES_SETTINGS_VIEW}>
      <QueryBoundary query={q}>
        {(data) => <SettingsForm key={data.version} data={data} canUpdate={can(s, PERMISSIONS.SALES_SETTINGS_UPDATE)} onReload={() => void q.refetch()} />}
      </QueryBoundary>
    </SalesGate>
  );
}
