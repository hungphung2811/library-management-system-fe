import type { ReactNode } from "react";
import { PERMISSIONS, apiFetch, can, hasModule, useSession } from "@/api";
import { Alert, Form, FormModal, Input, PackageCheck, Select, useFormModal, type RowAction } from "@/ui";
import type { CopyView } from "./types";

type Values = { restoreStatus: "AVAILABLE" | "DAMAGED"; refundMethod: "CASH" | "BANK_TRANSFER"; referenceCode?: string; checkNote?: string };

/**
 * Thao tác "Ghi nhận tìm lại" cho bản sao đang LOST (POST /api/borrowings/found): tạo đề nghị hoàn khoản chờ người khác duyệt,
 * chưa đổi trạng thái bản sao. `modal` phải được render ngoài bảng. `available` false khi thiếu quyền, thiếu module hoặc bản sao không mất.
 */
export function useFoundAction(copy: CopyView): { available: boolean; action: RowAction; modal: ReactNode } {
  const s = useSession();
  const available = copy.status === "LOST" && hasModule(s, "LENDING") && can(s, PERMISSIONS.BORROWING_REPORT_FOUND);
  const form = useFormModal<Values>({
    title: `Ghi nhận tìm lại «${copy.barcode}»`,
    okText: "Gửi đề nghị",
    successMessage: "Đã gửi đề nghị hoàn khoản chờ duyệt.",
    invalidate: ["/api/book-copies", "/api/fines"],
    initialValues: { restoreStatus: "AVAILABLE", refundMethod: "CASH" },
    request: (v) =>
      apiFetch("/api/borrowings/found", {
        method: "POST",
        json: {
          bookCopyId: copy.id,
          restoreStatus: v.restoreStatus,
          refundMethod: v.refundMethod,
          referenceCode: v.referenceCode?.trim() || null,
          checkNote: v.checkNote?.trim() || null,
        },
      }),
  });
  const action: RowAction = {
    key: "found",
    label: `Ghi nhận tìm lại ${copy.barcode}`,
    icon: <PackageCheck size={16} />,
    hidden: !available,
    onClick: () => form.openModal(),
  };
  const modal = available ? (
    <FormModal<Values> {...form.modalProps}>
      <Alert
        type="info"
        showIcon
        className="mb-4"
        title="Đề nghị cần người khác duyệt (không phải người lập). Khi duyệt, bản sao mới được đưa về kho theo tình trạng chọn dưới đây."
      />
      <Form.Item name="restoreStatus" label="Tình trạng khi tìm lại" rules={[{ required: true }]}>
        <Select
          options={[
            { value: "AVAILABLE", label: "Nguyên vẹn, cho mượn lại" },
            { value: "DAMAGED", label: "Hư hỏng" },
          ]}
        />
      </Form.Item>
      <Form.Item name="refundMethod" label="Hình thức hoàn khoản" extra="Chỉ áp dụng khi khoản phạt mất sách đã thu tiền." rules={[{ required: true }]}>
        <Select
          options={[
            { value: "CASH", label: "Tiền mặt" },
            { value: "BANK_TRANSFER", label: "Chuyển khoản" },
          ]}
        />
      </Form.Item>
      <Form.Item name="referenceCode" label="Mã tham chiếu" rules={[{ max: 100, message: "Tối đa 100 ký tự" }]}>
        <Input autoComplete="off" maxLength={100} />
      </Form.Item>
      <Form.Item name="checkNote" label="Ghi chú kiểm tra" rules={[{ max: 500, message: "Tối đa 500 ký tự" }]}>
        <Input.TextArea rows={3} maxLength={500} />
      </Form.Item>
    </FormModal>
  ) : null;
  return { available, action, modal };
}
