import { useState } from "react";
import { apiFetch, toErrorInfo, useApiMutation } from "@/api";
import { Alert, App, Button, Card, Form, InputNumber, Select, describeError, formatDateTime } from "@/ui";
import { COMPENSATION_ERRORS, PRICE_SOURCES, type CompensationPolicy } from "../_lib/compensation";

type Values = {
  lostPercent: number;
  priceSource: string;
  minAmount: number | null;
  maxAmount: number | null;
  foundWindowDays: number;
  refundProcessingFee: number;
};

const money = {
  formatter: (v: number | string | undefined) => (v == null ? "" : String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ".")),
  parser: (v: string | undefined) => Number(String(v ?? "").replace(/\./g, "")) || 0,
};

/** Chính sách đền bù: tỷ lệ mất, nguồn giá, sàn/trần, hạn tìm lại, phí xử lý hoàn. Tỷ lệ nhập theo phần trăm, gửi đi dạng hệ số (150% = 1.5). */
export function CompensationPolicyForm({ data, canUpdate, onReload }: { data: CompensationPolicy; canUpdate: boolean; onReload: () => void }) {
  const [error, setError] = useState<ReturnType<typeof toErrorInfo> | null>(null);
  const { message } = App.useApp();
  const save = useApiMutation(
    (v: Values) =>
      apiFetch<CompensationPolicy>("/api/circulation/compensation-policy", {
        method: "PUT",
        json: {
          lostRate: Math.round(v.lostPercent * 100) / 10000,
          priceSource: v.priceSource,
          minAmount: v.minAmount ?? 0,
          maxAmount: v.maxAmount ?? null,
          foundWindowDays: v.foundWindowDays,
          refundProcessingFee: v.refundProcessingFee ?? 0,
          version: data.version,
        },
      }),
    { invalidate: ["/api/circulation/compensation-policy"] },
  );
  const d = error ? describeError(error, COMPENSATION_ERRORS) : null;

  return (
    <Card title="Chính sách đền bù" className="max-w-[720px]">
      <Alert
        className="mb-4"
        type="info"
        showIcon
        title="Chỉ áp dụng cho khoản hỏng/mất lập sau khi lưu, không tính lại khoản cũ."
        description={data.custom ? undefined : "Đơn vị chưa lưu chính sách riêng nên đang dùng mặc định: mất 150% giá bìa, không sàn/trần, hạn tìm lại 30 ngày."}
      />
      <Form<Values>
        layout="vertical"
        disabled={!canUpdate}
        initialValues={{
          lostPercent: Math.round(Number(data.lostRate) * 10000) / 100,
          priceSource: data.priceSource,
          minAmount: data.minAmount ?? 0,
          maxAmount: data.maxAmount,
          foundWindowDays: data.foundWindowDays,
          refundProcessingFee: data.refundProcessingFee,
        }}
        onFinish={(v) => {
          setError(null);
          save.mutate(v, { onSuccess: () => message.success("Đã lưu chính sách đền bù."), onError: (e) => setError(toErrorInfo(e)) });
        }}
      >
        {d && (
          <Alert
            className="mb-4"
            type="error"
            showIcon
            title={d.text}
            description={d.details?.length ? d.details.join("; ") : undefined}
            action={error?.code === "POLICY_VERSION_CONFLICT" ? <Button size="small" onClick={onReload}>Tải lại chính sách</Button> : undefined}
          />
        )}
        <div className="grid gap-x-4 sm:grid-cols-2">
          <Form.Item name="lostPercent" label="Tỷ lệ đền khi mất sách (%)" rules={[{ required: true, message: "Nhập tỷ lệ" }]} extra="0 đến 500%, tính trên giá gốc.">
            <InputNumber className="w-full" min={0} max={500} precision={2} />
          </Form.Item>
          <Form.Item name="priceSource" label="Giá gốc lấy từ" rules={[{ required: true, message: "Chọn nguồn giá" }]} extra="Bản sao không có giá mua thì dùng giá bìa.">
            <Select options={Object.entries(PRICE_SOURCES).map(([value, label]) => ({ value, label }))} />
          </Form.Item>
          <Form.Item name="minAmount" label="Mức đền tối thiểu (VND)" extra="0 là không có sàn.">
            <InputNumber<number> className="w-full" min={0} max={1000000000} step={1000} precision={0} formatter={money.formatter} parser={money.parser} />
          </Form.Item>
          <Form.Item name="maxAmount" label="Mức đền tối đa (VND)" extra="Để trống là không giới hạn. Sàn/trần không áp cho phí trả trễ.">
            <InputNumber<number> className="w-full" min={0} max={1000000000} step={1000} precision={0} formatter={money.formatter} parser={money.parser} />
          </Form.Item>
          <Form.Item name="foundWindowDays" label="Hạn ghi nhận tìm lại sách (ngày)" rules={[{ required: true, message: "Nhập số ngày" }]} extra="1 đến 365 ngày kể từ ngày báo mất.">
            <InputNumber className="w-full" min={1} max={365} precision={0} />
          </Form.Item>
          <Form.Item name="refundProcessingFee" label="Phí xử lý khi hoàn tiền (VND)" extra="Trừ vào số tiền hoàn.">
            <InputNumber<number> className="w-full" min={0} max={1000000000} step={1000} precision={0} formatter={money.formatter} parser={money.parser} />
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
