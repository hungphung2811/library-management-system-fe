import { apiFetch } from "@/api";
import { Checkbox, DatePicker, Form, FormModal, Input, InputNumber, Select, dayjs } from "@/ui";
import type { Dayjs } from "dayjs";
import { BILLING_UNIT_OPTIONS } from "../_lib/contract-format";
import type { Contract } from "../_lib/contract-types";
import { MODULE_OPTIONS } from "../_lib/tenant-format";

export type ContractFormMode =
  | { kind: "create"; tenantId: string }
  | { kind: "edit"; contract: Contract }
  | { kind: "renew"; contract: Contract };

type Values = {
  name: string;
  modules?: string[];
  startDate?: Dayjs | null;
  endDate: Dayjs;
  totalAmount: number;
  cycleValue?: number | null;
  cycleUnit?: string | null;
  internalNote?: string | null;
};

const iso = (d: Dayjs | null | undefined) => (d ? d.format("YYYY-MM-DD") : undefined);
const parse = (s: string | null | undefined) => (s ? dayjs(s) : undefined);

/**
 * Tạo/sửa nháp/gia hạn hợp đồng. Giá là TỔNG theo hợp đồng (VND, số nguyên), không có giá riêng từng module (BE không hỗ trợ).
 * Hợp đồng ACTIVE chỉ sửa được ghi chú nội bộ: các ô khác khóa. Lỗi của BE do FormModal hiện (mã lỗi trong ui/error-messages.ts).
 */
export function ContractFormModal({ mode, open, onClose, onSaved }: { mode: ContractFormMode; open: boolean; onClose: () => void; onSaved: (c: Contract) => void | Promise<void> }) {
  const c = mode.kind === "create" ? null : mode.contract;
  const activeEdit = mode.kind === "edit" && mode.contract.status === "ACTIVE";
  const renew = mode.kind === "renew";
  const title = mode.kind === "create" ? "Tạo hợp đồng nháp" : mode.kind === "edit" ? "Sửa hợp đồng" : "Gia hạn hợp đồng (tạo hợp đồng nối tiếp)";

  const initial: Partial<Values> = c
    ? {
        name: c.name,
        modules: c.modules,
        startDate: renew ? undefined : parse(c.startDate),
        endDate: renew ? undefined : parse(c.endDate),
        totalAmount: renew ? undefined : c.totalAmount,
        cycleValue: c.billingCycle?.value,
        cycleUnit: c.billingCycle?.unit,
        internalNote: renew ? undefined : c.internalNote,
      }
    : { modules: ["LENDING"], cycleUnit: "MONTH" };

  return (
    <FormModal<Values>
      open={open}
      title={title}
      okText={mode.kind === "create" ? "Tạo nháp" : renew ? "Tạo hợp đồng nối tiếp" : "Lưu"}
      onCancel={onClose}
      successMessage={mode.kind === "create" ? "Đã tạo hợp đồng nháp" : renew ? "Đã tạo hợp đồng nối tiếp (nháp)" : "Đã lưu hợp đồng"}
      initialValues={initial}
      onSubmit={async (v) => {
        const billingCycle = v.cycleValue && v.cycleUnit ? { unit: v.cycleUnit, value: v.cycleValue } : null;
        const base = {
          name: v.name.trim(),
          startDate: iso(v.startDate),
          endDate: iso(v.endDate),
          totalAmount: v.totalAmount,
          billingCycle,
          internalNote: v.internalNote?.trim() || null,
        };
        let saved: Contract;
        if (mode.kind === "create") {
          saved = await apiFetch<Contract>(`/api/platform/tenants/${encodeURIComponent(mode.tenantId)}/contracts`, {
            method: "POST",
            json: { ...base, modules: v.modules ?? [] },
          });
        } else if (mode.kind === "edit") {
          saved = await apiFetch<Contract>(`/api/platform/contracts/${encodeURIComponent(mode.contract.id)}`, {
            method: "PUT",
            json: activeEdit
              ? {
                  // ACTIVE: chỉ ghi chú đổi, các trường khác giữ nguyên giá trị hiện có.
                  name: mode.contract.name,
                  modules: mode.contract.modules,
                  startDate: mode.contract.startDate,
                  endDate: mode.contract.endDate,
                  totalAmount: mode.contract.totalAmount,
                  billingCycle: mode.contract.billingCycle,
                  internalNote: base.internalNote,
                  version: mode.contract.version,
                }
              : { ...base, modules: v.modules ?? [], version: mode.contract.version },
          });
        } else {
          saved = await apiFetch<Contract>(`/api/platform/contracts/${encodeURIComponent(mode.contract.id)}/renew`, {
            method: "POST",
            json: base,
          });
        }
        await onSaved(saved);
      }}
    >
      <Form.Item name="name" label="Tên hợp đồng" rules={[{ required: true, whitespace: true, message: "Nhập tên hợp đồng" }, { max: 255, message: "Tối đa 255 ký tự" }]}>
        <Input autoComplete="off" disabled={activeEdit} />
      </Form.Item>
      {!renew && (
        <Form.Item name="modules" label="Module" rules={[{ required: true, type: "array", min: 1, message: "Chọn ít nhất một module" }]}>
          <Checkbox.Group options={MODULE_OPTIONS} disabled={activeEdit} />
        </Form.Item>
      )}
      <Form.Item
        name="startDate"
        label="Ngày bắt đầu"
        extra={renew ? "Bỏ trống: lấy ngày kết thúc của hợp đồng nguồn cộng 1 (hợp đồng chuyển tiếp thì bắt buộc nhập)." : "Ngày bắt đầu đã tới hoặc ở quá khứ thì kích hoạt sẽ áp dụng module ngay."}
        rules={renew ? [] : [{ required: true, message: "Chọn ngày bắt đầu" }]}
      >
        <DatePicker format="DD/MM/YYYY" className="w-full" disabled={activeEdit} />
      </Form.Item>
      <Form.Item
        name="endDate"
        label="Ngày kết thúc"
        extra="Bắt buộc. Hợp đồng còn hiệu lực hết ngày này (giờ Việt Nam), sau đó là ân hạn."
        dependencies={["startDate"]}
        rules={[
          { required: true, message: "Chọn ngày kết thúc" },
          ({ getFieldValue }) => ({
            validator: (_, v: Dayjs | undefined) => {
              const s = getFieldValue("startDate") as Dayjs | undefined;
              return v && s && v.isBefore(s, "day") ? Promise.reject(new Error("Ngày kết thúc không được trước ngày bắt đầu")) : Promise.resolve();
            },
          }),
        ]}
      >
        <DatePicker format="DD/MM/YYYY" className="w-full" disabled={activeEdit} />
      </Form.Item>
      <Form.Item
        name="totalAmount"
        label="Tổng tiền (VND)"
        extra="Tổng theo cả hợp đồng, số nguyên đồng. Không có giá riêng từng module."
        rules={[{ required: true, type: "number", min: 0, message: "Nhập tổng tiền từ 0 trở lên" }]}
      >
        <InputNumber<number>
          className="w-full"
          min={0}
          step={1000}
          precision={0}
          disabled={activeEdit}
          formatter={(v) => (v == null ? "" : String(v).replace(/\B(?=(\d{3})+(?!\d))/g, "."))}
          parser={(v) => Number(String(v ?? "").replace(/\./g, "")) || 0}
        />
      </Form.Item>
      <Form.Item label="Chu kỳ thanh toán (tham khảo)">
        <div className="flex gap-2">
          <Form.Item name="cycleValue" noStyle>
            <InputNumber min={1} precision={0} placeholder="Số" aria-label="Chu kỳ thanh toán: số" disabled={activeEdit} />
          </Form.Item>
          <Form.Item name="cycleUnit" noStyle>
            <Select aria-label="Chu kỳ thanh toán: đơn vị" options={BILLING_UNIT_OPTIONS} className="min-w-28" disabled={activeEdit} />
          </Form.Item>
        </div>
      </Form.Item>
      <Form.Item name="internalNote" label="Ghi chú nội bộ" extra="Chỉ platform admin thấy; tenant không thấy ghi chú này.">
        <Input.TextArea rows={3} maxLength={2000} />
      </Form.Item>
    </FormModal>
  );
}
