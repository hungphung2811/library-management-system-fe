import { Form, Input, InputNumber } from "@/ui";
import { MoneyInput } from "./MoneyInput";

/** Giá trị form của 7 field thông tin mặt hàng (ngày nhập nhập dạng yyyy-MM-dd). */
export type StockDetailValues = {
  sku?: string;
  supplier?: string;
  costPrice?: number | null;
  binLocation?: string;
  reorderQuantity?: number | null;
  lastRestockedDate?: string;
  note?: string;
};

/** ISO instant -> yyyy-MM-dd theo giờ Việt Nam (cho ô type="date"). */
export function toDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** yyyy-MM-dd -> ISO instant (0h giờ Việt Nam). Rỗng -> undefined (vắng thì BE giữ giá trị cũ). */
export function fromDateInput(v: string | undefined): string | undefined {
  return v ? new Date(`${v}T00:00:00+07:00`).toISOString() : undefined;
}

const blank = (v: string | undefined) => (v?.trim() ? v.trim() : undefined);

/** Thân request cho register/PUT details: chuỗi rỗng và số null được bỏ (BE hiểu vắng là xóa). `withSensitive`=false thì không gửi giá nhập/ghi chú. */
export function detailsBody(v: StockDetailValues, withSensitive: boolean, keepDate?: { initial: string; iso: string | null | undefined }) {
  const date = keepDate && v.lastRestockedDate === keepDate.initial ? undefined : fromDateInput(v.lastRestockedDate);
  return {
    sku: blank(v.sku),
    supplier: blank(v.supplier),
    binLocation: blank(v.binLocation),
    reorderQuantity: v.reorderQuantity ?? undefined,
    lastRestockedAt: date,
    ...(withSensitive ? { costPrice: v.costPrice ?? undefined, note: blank(v.note) } : {}),
  };
}

/** Các ô nhập 7 field. `showSensitive` ẩn giá nhập và ghi chú khi người dùng không có quyền xem. */
export function StockDetailFields({ showSensitive, disabled }: { showSensitive: boolean; disabled?: boolean }) {
  return (
    <>
      <Form.Item name="sku" label="Mã SKU" extra="Tự viết hoa, không trùng trong đơn vị." rules={[{ max: 40, message: "Tối đa 40 ký tự" }]}>
        <Input autoComplete="off" maxLength={40} disabled={disabled} />
      </Form.Item>
      <Form.Item name="supplier" label="Nhà cung cấp" rules={[{ max: 255, message: "Tối đa 255 ký tự" }]}>
        <Input autoComplete="off" maxLength={255} disabled={disabled} />
      </Form.Item>
      {showSensitive && (
        <Form.Item name="costPrice" label="Giá nhập">
          <MoneyInput disabled={disabled} />
        </Form.Item>
      )}
      <Form.Item name="binLocation" label="Vị trí kho" rules={[{ max: 64, message: "Tối đa 64 ký tự" }]}>
        <Input autoComplete="off" maxLength={64} disabled={disabled} />
      </Form.Item>
      <Form.Item name="reorderQuantity" label="Số lượng cần đặt lại" extra="Tồn nhỏ hơn hoặc bằng số này thì hiện cảnh báo cần đặt lại.">
        <InputNumber className="w-full" min={0} max={1000000} precision={0} disabled={disabled} />
      </Form.Item>
      <Form.Item name="lastRestockedDate" label="Ngày nhập gần nhất">
        <Input type="date" disabled={disabled} aria-label="Ngày nhập gần nhất" />
      </Form.Item>
      {showSensitive && (
        <Form.Item name="note" label="Ghi chú nội bộ" rules={[{ max: 500, message: "Tối đa 500 ký tự" }]}>
          <Input.TextArea rows={3} maxLength={500} showCount disabled={disabled} />
        </Form.Item>
      )}
    </>
  );
}
