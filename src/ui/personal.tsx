import type { ReactNode } from "react";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import { Avatar, DatePicker, Form, Input, Select } from "./antd";
import type { KeyValueItem } from "./KeyValueList";
import { formatDate } from "./format";

export const GENDERS = [
  { value: "MALE", label: "Nam" },
  { value: "FEMALE", label: "Nữ" },
  { value: "OTHER", label: "Khác" },
];
export const genderLabel = (v?: string | null) => (v ? (GENDERS.find((g) => g.value === v)?.label ?? v) : null);

const DATE_FORMAT = "DD/MM/YYYY";
const MIN_DOB = dayjs("1900-01-01");
const disableDob = (d: Dayjs) => d.isAfter(dayjs(), "day") || d.isBefore(MIN_DOB, "day");

/** Gửi lên BE: chuỗi rỗng/khoảng trắng -> undefined (BE giữ giá trị cũ khi trường vắng). */
export const blankToUndefined = (v?: string | null) => (v && v.trim() ? v.trim() : undefined);
export const dateToIso = (d?: Dayjs | null) => (d ? d.format("YYYY-MM-DD") : undefined);
export const isoToDate = (s?: string | null) => (s ? dayjs(s) : undefined);

/** Avatar ảnh (http/https) hoặc chữ cái đầu của tên. */
export function UserAvatar({ name, src, size = 40 }: { name?: string | null; src?: string | null; size?: number }) {
  const letter = (name ?? "").trim().charAt(0).toUpperCase() || "?";
  return (
    <Avatar size={size} src={src || undefined} alt={name ?? undefined} className="shrink-0 bg-primary-soft font-semibold text-primary">
      {letter}
    </Avatar>
  );
}

/** Ghi chú chung cho form sửa: BE chưa cho xóa trường đã có. */
export const KEEP_NOTE = "Để trống thì giữ nguyên giá trị hiện có (chưa hỗ trợ xóa trường đã nhập).";

/** Các field chung của người dùng và độc giả: SĐT, ngày sinh, giới tính, địa chỉ. Đặt trong Form của FormModal. */
export function CommonPersonalFields() {
  return (
    <>
      <Form.Item
        name="phone"
        label="Số điện thoại"
        rules={[
          { max: 20, message: "Tối đa 20 ký tự" },
          { pattern: /^[0-9+\-\s]*$/, message: "Chỉ gồm số, +, - và khoảng trắng" },
        ]}
      >
        <Input autoComplete="off" inputMode="tel" />
      </Form.Item>
      <Form.Item name="dateOfBirth" label="Ngày sinh">
        <DatePicker className="w-full" format={DATE_FORMAT} disabledDate={disableDob} />
      </Form.Item>
      <Form.Item name="gender" label="Giới tính">
        <Select allowClear options={GENDERS} placeholder="Không chọn" />
      </Form.Item>
      <Form.Item name="address" label="Địa chỉ" rules={[{ max: 500, message: "Tối đa 500 ký tự" }]}>
        <Input.TextArea autoComplete="off" rows={2} />
      </Form.Item>
    </>
  );
}

/** Tiêu đề nhóm trong form. */
export function FormSection({ title, note }: { title: ReactNode; note?: ReactNode }) {
  return (
    <div className="mb-3 mt-1 border-b border-line pb-1">
      <div className="font-semibold">{title}</div>
      {note && <div className="text-xs text-muted">{note}</div>}
    </div>
  );
}

/** Lọc mục chỉ còn field có giá trị (danh sách/chi tiết chỉ hiện field có dữ liệu). */
export const presentItems = (items: KeyValueItem[]) =>
  items.filter((i) => !(i.value === null || i.value === undefined || i.value === "" || i.value === false));

export const dobText = (s?: string | null) => (s ? formatDate(s) : null);
