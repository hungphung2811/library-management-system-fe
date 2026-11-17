import { ApiCallError } from "@/api";

/** Một origin website của tenant (platform admin): GET /api/platform/tenants/{id}/storefront-origins. */
export type StorefrontOrigin = {
  id: string;
  origin: string;
  enabled: boolean;
  createdAt: string;
  createdBy?: string | null;
  updatedAt: string;
  updatedBy?: string | null;
};
export type StorefrontOriginList = { maxOrigins: number; origins: StorefrontOrigin[] };
/** Tenant admin (chỉ đọc): GET /api/storefront-origins, không có id hay thời gian. */
export type TenantStorefrontOriginList = { origins: { origin: string; enabled: boolean }[] };

export const ORIGIN_NOTE =
  "Danh sách origin chỉ kiểm soát CORS của trình duyệt, không phải xác thực và không chống bot hay curl. Thay đổi có hiệu lực trong khoảng 60 giây.";

/** Lý do 400 ORIGIN_INVALID theo `details` (mã đầu tiên). */
export const ORIGIN_INVALID_REASONS: Record<string, string> = {
  SYNTAX: "Origin sai cú pháp (rỗng, quá 300 ký tự hoặc có khoảng trắng).",
  SCHEME: "Origin phải bắt đầu bằng https:// (hoặc http:// cho localhost).",
  PATH: "Origin không được có đường dẫn, query, fragment hay tên người dùng. Chỉ nhập dạng https://tenant.example.com.",
  WILDCARD: "Origin không được chứa ký tự * (không hỗ trợ wildcard).",
  NULL: 'Giá trị "null" không hợp lệ.',
  HOST: "Tên miền không hợp lệ (thiếu host, IPv6, dấu chấm cuối hoặc ký tự cấm).",
  PORT: "Cổng không hợp lệ (phải là số từ 1 đến 65535).",
  HTTP_NOT_ALLOWED: "Chỉ nhận https. http chỉ dùng được cho localhost hoặc 127.0.0.1 (hoặc môi trường staging bật cờ cho phép).",
};

/** Mã lỗi của API origin, truyền vào ErrorPanel/describeError qua `extra`. */
export const ORIGIN_ERRORS: Record<string, string> = {
  ORIGIN_INVALID: "Origin chưa hợp lệ. Nhập dạng https://tenant.example.com, không có đường dẫn, không wildcard.",
  ORIGIN_DUPLICATED: "Origin này đã được khai báo. Mỗi origin chỉ thuộc một đơn vị trên toàn hệ thống.",
  ORIGIN_LIMIT_EXCEEDED: "Đơn vị đã đạt số origin tối đa (kể cả origin đang tắt). Hãy xóa bớt một origin trước khi thêm.",
  STOREFRONT_ORIGIN_NOT_FOUND: "Không tìm thấy origin này (có thể đã bị xóa). Hãy tải lại danh sách.",
  TENANT_NOT_FOUND: "Không tìm thấy đơn vị này.",
};

/** Nhận xét nhẹ phía FE (BE mới là nơi quyết định): trả câu lỗi hoặc null. */
export function checkOriginInput(raw: string): string | null {
  const v = raw.trim();
  if (!v) return "Nhập origin của website.";
  if (!/^https?:\/\//i.test(v)) return "Origin phải bắt đầu bằng https:// (http:// chỉ cho localhost).";
  return null;
}

/** Chủ sở hữu (tenantId) trong details của ORIGIN_DUPLICATED, dạng "tenantId=<uuid>". */
export function ownerTenantId(details?: string[]): string | null {
  for (const d of details ?? []) {
    const m = /^tenantId=(.+)$/.exec(d.trim());
    if (m) return m[1];
  }
  return null;
}

/** Câu tiếng Việt chi tiết cho lỗi origin; null nếu không phải lỗi origin. */
export function describeOriginError(e: unknown): { text: string; ownerTenantId?: string } | null {
  if (!(e instanceof ApiCallError) || !e.code) return null;
  if (e.code === "ORIGIN_INVALID") {
    const reason = (e.details ?? []).map((d) => ORIGIN_INVALID_REASONS[d.trim().toUpperCase()]).find(Boolean);
    return { text: reason ?? ORIGIN_ERRORS.ORIGIN_INVALID };
  }
  if (e.code === "ORIGIN_DUPLICATED") {
    const owner = ownerTenantId(e.details);
    return owner
      ? { text: "Origin này đã được đơn vị khác dùng. Muốn chuyển domain, hãy xóa ở đơn vị đó rồi thêm lại ở đây.", ownerTenantId: owner }
      : { text: ORIGIN_ERRORS.ORIGIN_DUPLICATED };
  }
  const t = ORIGIN_ERRORS[e.code];
  return t ? { text: t } : null;
}
