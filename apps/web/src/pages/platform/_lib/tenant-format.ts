import { ApiCallError } from "@/api";
import type { TenantStatus } from "./tenant-types";

export const MODULE_LABELS: Record<string, string> = { LENDING: "Mượn trả", SALES: "Bán hàng" };
export const MODULE_OPTIONS = Object.entries(MODULE_LABELS).map(([value, label]) => ({ value, label }));
export const moduleLabel = (m: string) => MODULE_LABELS[m] ?? m;

export const TENANT_STATUS: Record<TenantStatus, { label: string; color: string }> = {
  ACTIVE: { label: "Đang hoạt động", color: "success" },
  SUSPENDED: { label: "Tạm ngưng", color: "warning" },
};
export const TENANT_STATUS_OPTIONS = (Object.keys(TENANT_STATUS) as TenantStatus[]).map((value) => ({
  value,
  label: TENANT_STATUS[value].label,
}));

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

/** Mã lỗi của /api/platform/** (identity), truyền vào ErrorPanel/describeError qua `extra` hoặc withPlatformErrors. */
export const TENANT_ERRORS: Record<string, string> = {
  TENANT_NOT_FOUND: "Không tìm thấy đơn vị này.",
  ORGANIZATION_NOT_FOUND: "Không tìm thấy tổ chức này.",
  DUPLICATE_TENANT: "Mã đơn vị này đã được dùng. Hãy chọn mã khác.",
  UNKNOWN_MODULE: "Module không hợp lệ.",
  INVALID_MODULES: "Phải chọn ít nhất một module hợp lệ.",
  TENANT_MODULE_REQUIRED: "Không thể tắt module cuối cùng: đơn vị phải còn ít nhất một module. Muốn dừng đơn vị hãy dùng Tạm ngưng.",
  INVALID_TENANT: "Dữ liệu đơn vị chưa hợp lệ: cần đúng một trong quản trị viên mới hoặc tài khoản có sẵn.",
  ACCOUNT_EXISTS: "Tên đăng nhập hoặc email đã tồn tại.",
  ACCOUNT_NOT_FOUND: "Không tìm thấy tài khoản này.",
  INVALID_ACCOUNT: "Thông tin tài khoản chưa hợp lệ.",
  NO_TENANT_ACCESS: "Tài khoản này không thuộc đơn vị.",
  VALIDATION_ERROR: "Dữ liệu chưa hợp lệ.",
  VALIDATION_FAILED: "Dữ liệu chưa hợp lệ.",
  FORBIDDEN: "Chỉ quản trị viên nền tảng (platform admin) mới dùng được chức năng này.",
};

/** Đọc `?size=` trên URL: số hợp lệ trong PAGE_SIZE_OPTIONS, mặc định 20. */
export function sizeParam(raw: string | null): number {
  const n = Number.parseInt(raw ?? "", 10);
  return PAGE_SIZE_OPTIONS.includes(n) ? n : 20;
}

/** Đổi thông điệp lỗi của BE sang tiếng Việt theo TENANT_ERRORS (FormModal/ConfirmAction chỉ nhận ErrorInfo chung). */
export async function withTenantErrors<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    if (e instanceof ApiCallError && e.code && TENANT_ERRORS[e.code]) {
      throw new ApiCallError(e.status, e.code, TENANT_ERRORS[e.code], e.details);
    }
    throw e;
  }
}
