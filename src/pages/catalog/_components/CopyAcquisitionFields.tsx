import { Form, DatePicker, Input, InputNumber, Select, dayjs, dateToIso, isoToDate } from "@/ui";
import type { Dayjs } from "dayjs";
import type { AcquisitionSource, ConditionGrade, CopyAcquisition } from "./types";

export const SOURCE_LABELS: Record<AcquisitionSource, string> = {
  PURCHASE: "Mua",
  DONATION: "Tặng",
  EXCHANGE: "Trao đổi",
  OTHER: "Khác",
};
export const CONDITION_LABELS: Record<ConditionGrade, string> = {
  NEW: "Mới",
  GOOD: "Tốt",
  FAIR: "Khá",
  WORN: "Cũ nát",
};
const toOptions = (m: Record<string, string>) => Object.entries(m).map(([value, label]) => ({ value, label }));

export const sourceLabel = (v?: string | null) => (v ? (SOURCE_LABELS[v as AcquisitionSource] ?? v) : null);
export const conditionLabel = (v?: string | null) => (v ? (CONDITION_LABELS[v as ConditionGrade] ?? v) : null);

/** Giá trị form (ngày là Dayjs) của 6 field nhập kho. */
export type AcquisitionValues = {
  acquiredDate?: Dayjs;
  acquisitionSource?: AcquisitionSource;
  purchasePrice?: number;
  conditionGrade?: ConditionGrade;
  conditionNote?: string;
  lastInventoryDate?: Dayjs;
};

export const acquisitionInitial = (c: CopyAcquisition): AcquisitionValues => ({
  acquiredDate: isoToDate(c.acquiredDate),
  acquisitionSource: c.acquisitionSource ?? undefined,
  purchasePrice: c.purchasePrice ?? undefined,
  conditionGrade: c.conditionGrade ?? undefined,
  conditionNote: c.conditionNote ?? undefined,
  lastInventoryDate: isoToDate(c.lastInventoryDate),
});

/** Body gửi BE: luôn đủ 6 khóa (null = xóa, vì PUT /acquisition thay toàn bộ). Giá mua chỉ gửi khi nguồn là PURCHASE. */
export function acquisitionPayload(v: AcquisitionValues) {
  const note = v.conditionNote?.trim();
  return {
    acquiredDate: dateToIso(v.acquiredDate) ?? null,
    acquisitionSource: v.acquisitionSource ?? null,
    purchasePrice: v.acquisitionSource === "PURCHASE" ? (v.purchasePrice ?? null) : null,
    conditionGrade: v.conditionGrade ?? null,
    conditionNote: note ? note : null,
    lastInventoryDate: dateToIso(v.lastInventoryDate) ?? null,
  };
}

const money = {
  formatter: (v: number | string | undefined) => (v == null ? "" : String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ".")),
  parser: (v: string | undefined) => Number(String(v ?? "").replace(/\./g, "")) || 0,
};
const FMT = "DD/MM/YYYY";
const notFuture = (d: Dayjs) => d.isAfter(dayjs(), "day");

/** 6 ô nhập kho/tình trạng. Đặt trong Form của FormModal (dùng chung cho form thêm bản sao và "Thông tin nhập kho"). */
export function CopyAcquisitionFields() {
  const source = Form.useWatch("acquisitionSource");
  const isPurchase = source === "PURCHASE";
  return (
    <>
      <Form.Item name="acquiredDate" label="Ngày nhập" extra="Không được ở tương lai.">
        <DatePicker className="w-full" format={FMT} disabledDate={notFuture} />
      </Form.Item>
      <Form.Item name="acquisitionSource" label="Nguồn nhập">
        <Select allowClear options={toOptions(SOURCE_LABELS)} placeholder="Không chọn" />
      </Form.Item>
      <Form.Item
        name="purchasePrice"
        label="Giá mua (₫)"
        extra={isPurchase ? undefined : "Chỉ nhập được khi nguồn nhập là Mua."}
        rules={[{ type: "number", min: 0, message: "Giá mua phải từ 0 trở lên" }]}
      >
        <InputNumber<number> className="w-full" min={0} precision={0} disabled={!isPurchase} formatter={money.formatter} parser={money.parser} />
      </Form.Item>
      <Form.Item name="conditionGrade" label="Tình trạng">
        <Select allowClear options={toOptions(CONDITION_LABELS)} placeholder="Không chọn" />
      </Form.Item>
      <Form.Item name="conditionNote" label="Ghi chú tình trạng" rules={[{ max: 300, message: "Tối đa 300 ký tự" }]}>
        <Input.TextArea rows={2} maxLength={300} showCount />
      </Form.Item>
      <Form.Item
        name="lastInventoryDate"
        label="Ngày kiểm kê gần nhất"
        dependencies={["acquiredDate"]}
        rules={[
          ({ getFieldValue }) => ({
            validator: (_, value: Dayjs | undefined) => {
              const acquired = getFieldValue("acquiredDate") as Dayjs | undefined;
              if (value && acquired && value.isBefore(acquired, "day")) {
                return Promise.reject(new Error("Ngày kiểm kê không được trước ngày nhập"));
              }
              return Promise.resolve();
            },
          }),
        ]}
      >
        <DatePicker className="w-full" format={FMT} disabledDate={notFuture} />
      </Form.Item>
    </>
  );
}
