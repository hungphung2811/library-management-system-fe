import type { Dayjs } from "dayjs";
import { CommonPersonalFields, Form, FormSection, Input, KEEP_NOTE, blankToUndefined, dateToIso, isoToDate } from "@/ui";
import type { Gender, UserView } from "../_lib/types";

export type UserPersonalValues = {
  phone?: string;
  dateOfBirth?: Dayjs;
  gender?: Gender;
  address?: string;
  avatarUrl?: string;
  jobTitle?: string;
  employeeCode?: string;
};

/** Giá trị ban đầu cho form sửa. */
export const personalInitial = (u: UserView): UserPersonalValues => ({
  phone: u.phone ?? undefined,
  dateOfBirth: isoToDate(u.dateOfBirth),
  gender: u.gender ?? undefined,
  address: u.address ?? undefined,
  avatarUrl: u.avatarUrl ?? undefined,
  jobTitle: u.jobTitle ?? undefined,
  employeeCode: u.employeeCode ?? undefined,
});

/** Trường cá nhân gửi BE: rỗng thì bỏ (BE giữ nguyên/để trống). */
export const personalPayload = (v: UserPersonalValues) => ({
  phone: blankToUndefined(v.phone),
  dateOfBirth: dateToIso(v.dateOfBirth),
  gender: v.gender || undefined,
  address: blankToUndefined(v.address),
  avatarUrl: blankToUndefined(v.avatarUrl),
  jobTitle: blankToUndefined(v.jobTitle),
  employeeCode: blankToUndefined(v.employeeCode),
});

/** Nhóm "Thông tin cá nhân" của form tạo/sửa người dùng. */
export function UserPersonalFields({ editing }: { editing?: boolean }) {
  return (
    <>
      <FormSection title="Thông tin cá nhân" note={editing ? KEEP_NOTE : "Tất cả đều tùy chọn."} />
      <CommonPersonalFields />
      <Form.Item
        name="avatarUrl"
        label="Ảnh đại diện (URL)"
        rules={[
          { max: 500, message: "Tối đa 500 ký tự" },
          { pattern: /^(https?:\/\/\S+)?$/i, message: "Phải bắt đầu bằng http:// hoặc https://" },
        ]}
      >
        <Input autoComplete="off" placeholder="https://..." />
      </Form.Item>
      <Form.Item name="jobTitle" label="Chức danh" rules={[{ max: 100, message: "Tối đa 100 ký tự" }]}>
        <Input autoComplete="off" />
      </Form.Item>
      <Form.Item name="employeeCode" label="Mã cán bộ" rules={[{ max: 32, message: "Tối đa 32 ký tự" }]}>
        <Input autoComplete="off" />
      </Form.Item>
    </>
  );
}
