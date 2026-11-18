import { useState } from "react";
import { PERMISSIONS, apiFetch, can, toErrorInfo, useApi, useApiMutation, useSession } from "@/api";
import { Alert, App, Button, Card, Form, Input, QueryBoundary, Switch, describeError, formatDateTime } from "@/ui";
import { SalesGate } from "./_components/SalesGate";
import { EMAIL, SELLER_TAX_CODE, type InvoiceSettings } from "./_lib/invoices";

type FormValues = {
  sellerLegalName: string;
  sellerTaxCode: string;
  sellerAddress: string;
  sellerPhone?: string;
  sellerEmail?: string;
  templateCode: string;
  series: string;
  autoIssueOnCompletion: boolean;
};

const req = (message: string) => ({ required: true, whitespace: true, message });

function InvoiceSettingsForm({ data, canUpdate, onReload }: { data: InvoiceSettings; canUpdate: boolean; onReload: () => void }) {
  const [error, setError] = useState<ReturnType<typeof toErrorInfo> | null>(null);
  const { message } = App.useApp();
  const save = useApiMutation(
    (v: FormValues) =>
      apiFetch<InvoiceSettings>("/api/sales/invoice-settings", {
        method: "PUT",
        json: {
          sellerLegalName: v.sellerLegalName.trim(),
          sellerTaxCode: v.sellerTaxCode.trim(),
          sellerAddress: v.sellerAddress.trim(),
          sellerPhone: v.sellerPhone?.trim() || null,
          sellerEmail: v.sellerEmail?.trim() || null,
          templateCode: v.templateCode.trim(),
          series: v.series.trim(),
          autoIssueOnCompletion: !!v.autoIssueOnCompletion,
          version: data.version,
        },
      }),
    { invalidate: ["/api/sales/invoice-settings"] },
  );
  const conflict = error?.code === "SETTINGS_VERSION_CONFLICT";
  const d = error ? describeError(error) : null;

  return (
    <Card className="max-w-[720px]">
      {!data.complete && (
        <Alert
          className="mb-4"
          type="warning"
          showIcon
          data-testid="invoice-settings-incomplete"
          title="Chưa cấu hình đủ để xuất hóa đơn"
          description="Cần tên pháp lý, mã số thuế, địa chỉ, mẫu số và ký hiệu của người bán."
        />
      )}
      <Form<FormValues>
        layout="vertical"
        disabled={!canUpdate}
        initialValues={{
          sellerLegalName: data.sellerLegalName ?? "",
          sellerTaxCode: data.sellerTaxCode ?? "",
          sellerAddress: data.sellerAddress ?? "",
          sellerPhone: data.sellerPhone ?? "",
          sellerEmail: data.sellerEmail ?? "",
          templateCode: data.templateCode ?? "",
          series: data.series ?? "",
          autoIssueOnCompletion: data.autoIssueOnCompletion,
        }}
        onFinish={(v) => {
          setError(null);
          save.mutate(v, { onSuccess: () => message.success("Đã lưu cấu hình hóa đơn."), onError: (e) => setError(toErrorInfo(e)) });
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
          <Form.Item name="sellerLegalName" label="Tên pháp lý người bán" rules={[req("Nhập tên pháp lý"), { max: 255, message: "Tối đa 255 ký tự" }]} className="sm:col-span-2">
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item
            name="sellerTaxCode"
            label="Mã số thuế người bán"
            extra="10 chữ số hoặc 10 chữ số-3 chữ số (ví dụ 0123456789-001). Chỉ kiểm định dạng."
            rules={[
              req("Nhập mã số thuế"),
              { validator: (_, v: string | undefined) => (!v?.trim() || SELLER_TAX_CODE.test(v.trim()) ? Promise.resolve() : Promise.reject(new Error("Mã số thuế chưa đúng định dạng"))) },
            ]}
          >
            <Input autoComplete="off" inputMode="numeric" />
          </Form.Item>
          <Form.Item name="sellerPhone" label="Điện thoại (tùy chọn)" rules={[{ max: 30, message: "Tối đa 30 ký tự" }]}>
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item name="sellerAddress" label="Địa chỉ người bán" rules={[req("Nhập địa chỉ"), { max: 500, message: "Tối đa 500 ký tự" }]} className="sm:col-span-2">
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item
            name="sellerEmail"
            label="Email (tùy chọn)"
            className="sm:col-span-2"
            rules={[{ validator: (_, v: string | undefined) => (!v?.trim() || EMAIL.test(v.trim()) ? Promise.resolve() : Promise.reject(new Error("Email chưa đúng định dạng"))) }]}
          >
            <Input autoComplete="off" type="email" />
          </Form.Item>
          <Form.Item
            name="templateCode"
            label="Mẫu số"
            extra="Tối đa 6 ký tự chữ và số, ví dụ 1."
            rules={[req("Nhập mẫu số"), { pattern: /^[0-9A-Za-z/]{1,6}$/, message: "Tối đa 6 ký tự chữ, số hoặc dấu /" }]}
          >
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item
            name="series"
            label="Ký hiệu hóa đơn"
            extra="Tối đa 8 ký tự chữ và số, ví dụ C26TAA. Số hóa đơn đánh lại từ 1 mỗi năm theo mẫu số và ký hiệu."
            rules={[req("Nhập ký hiệu"), { pattern: /^[0-9A-Za-z/]{1,8}$/, message: "Tối đa 8 ký tự chữ, số hoặc dấu /" }]}
          >
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item
            name="autoIssueOnCompletion"
            label="Tự xuất hóa đơn khi đơn hoàn tất và đã thu tiền"
            valuePropName="checked"
            extra="Chỉ áp dụng cho đơn có yêu cầu xuất hóa đơn của khách. Thiếu cấu hình người bán thì bỏ qua, nhân viên xuất tay."
          >
            <Switch checkedChildren="Bật" unCheckedChildren="Tắt" />
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
            {data.updatedAt ? ` · cập nhật ${formatDateTime(data.updatedAt)}` : " · chưa từng lưu"}
          </span>
        </div>
      </Form>
    </Card>
  );
}

export default function InvoiceSettingsPage() {
  const s = useSession();
  const allowed = can(s, PERMISSIONS.INVOICE_SETTINGS_GET);
  const q = useApi<InvoiceSettings>(allowed ? "/api/sales/invoice-settings" : null);
  return (
    <SalesGate title="Cấu hình hóa đơn" description="Thông tin người bán, mẫu số và ký hiệu in trên hóa đơn VAT nội bộ." permission={PERMISSIONS.INVOICE_SETTINGS_GET}>
      <Alert className="mb-4 max-w-[720px]" type="warning" showIcon title="Hóa đơn nội bộ, không thay thế hóa đơn điện tử." description="Cần tư vấn kế toán trước khi dùng cho mục đích thuế." />
      <QueryBoundary query={q}>
        {(data) => <InvoiceSettingsForm key={data.version} data={data} canUpdate={can(s, PERMISSIONS.INVOICE_SETTINGS_UPDATE)} onReload={() => void q.refetch()} />}
      </QueryBoundary>
    </SalesGate>
  );
}
