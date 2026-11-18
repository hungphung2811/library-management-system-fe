/** Kiểu và hằng của màn Developer Portal (docs/api/applications.md ở repo BE). */

export type ApplicationKind = "PUBLIC_SITE" | "INTEGRATION";
export type ApplicationStatus = "ACTIVE" | "SUSPENDED";

export type ApplicationSummary = {
  id: string;
  name: string;
  kind: ApplicationKind;
  status: ApplicationStatus;
  siteKey?: string | null;
  rateLimitPerMinute?: number | null;
  scopes: string[];
  usableCredentials: number;
  createdAt: string;
  updatedAt: string;
};

export type CredentialView = {
  id: string;
  secretHint: string;
  status: "ACTIVE" | "REVOKED";
  usable: boolean;
  createdAt: string;
  createdBy?: string | null;
  expiresAt?: string | null;
  lastUsedAt?: string | null;
  revokedAt?: string | null;
  revokeReason?: string | null;
};

export type ApplicationDetail = Omit<ApplicationSummary, "usableCredentials"> & {
  clientId: string;
  credentials: CredentialView[];
  createdBy?: string | null;
  updatedBy?: string | null;
};

/** Phản hồi tạo credential: `clientSecret` chỉ có ở đây, một lần duy nhất (không đưa vào cache hay lưu trữ). */
export type CreatedCredential = {
  credentialId: string;
  clientId: string;
  clientSecret: string;
  secretHint: string;
  createdAt: string;
  expiresAt?: string | null;
};

export type ApplicationDomain = {
  id: string;
  origin: string;
  enabled: boolean;
  createdAt: string;
  createdBy?: string | null;
  updatedAt: string;
  updatedBy?: string | null;
};
export type ApplicationDomainList = { maxOriginsPerTenant: number; domains: ApplicationDomain[] };

export type ApplicationHistoryItem = {
  id: string;
  credentialId?: string | null;
  action: string;
  detail?: string | null;
  actorId?: string | null;
  occurredAt: string;
};

export const KIND_LABELS: Record<ApplicationKind, string> = {
  PUBLIC_SITE: "Website công khai",
  INTEGRATION: "Tích hợp backend",
};
export const KIND_HINTS: Record<ApplicationKind, string> = {
  PUBLIC_SITE: "Website của đơn vị gọi API công khai từ trình duyệt bằng site key; khai báo domain được phép (CORS).",
  INTEGRATION: "Backend của đơn vị (ERP/CRM) xin token bằng client_id và client_secret để đọc dữ liệu theo scope. Cần hợp đồng đang hiệu lực.",
};

export const APP_STATUS_LABELS: Record<ApplicationStatus, { label: string; color: string }> = {
  ACTIVE: { label: "Đang hoạt động", color: "success" },
  SUSPENDED: { label: "Tạm ngưng", color: "warning" },
};

export type ScopeDef = { key: string; label: string; grantable: boolean };

/** Danh mục scope hợp lệ của BE. Chỉ ba scope đọc được cấp ở giai đoạn này; còn lại hiển thị khóa kèm chú thích "chưa mở". */
export const SCOPES: ScopeDef[] = [
  { key: "books:read", label: "Đọc đầu sách", grantable: true },
  { key: "inventory:read", label: "Đọc tồn kho", grantable: true },
  { key: "orders:read", label: "Đọc đơn hàng", grantable: true },
  { key: "books:write", label: "Ghi đầu sách", grantable: false },
  { key: "inventory:write", label: "Ghi tồn kho", grantable: false },
  { key: "orders:write", label: "Ghi đơn hàng", grantable: false },
  { key: "customers:read", label: "Đọc khách hàng", grantable: false },
  { key: "customers:write", label: "Ghi khách hàng", grantable: false },
];
export const GRANTABLE_SCOPES = SCOPES.filter((s) => s.grantable).map((s) => s.key);

export const REVOKE_REASON_LABELS: Record<string, string> = {
  MANUAL: "Thu hồi thủ công",
  ROTATED: "Đã xoay vòng",
  COMPROMISED: "Nghi bị lộ",
  APPLICATION_DELETED: "Ứng dụng bị thu hồi",
  EXPIRED: "Hết hạn",
};

export const CREDENTIAL_STATUS: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: "Đang dùng", color: "success" },
  EXPIRED: { label: "Hết hạn", color: "default" },
  REVOKED: { label: "Đã thu hồi", color: "error" },
};

/** Trạng thái hiển thị của credential: ACTIVE mà không còn dùng được nghĩa là hết hạn. */
export function credentialState(c: Pick<CredentialView, "status" | "usable">): keyof typeof CREDENTIAL_STATUS {
  if (c.status === "REVOKED") return "REVOKED";
  return c.usable ? "ACTIVE" : "EXPIRED";
}

export const HISTORY_ACTION_LABELS: Record<string, string> = {
  CREATED: "Tạo ứng dụng",
  UPDATED: "Sửa thông tin ứng dụng",
  SUSPENDED: "Tạm ngưng ứng dụng",
  REACTIVATED: "Kích hoạt lại ứng dụng",
  DELETED: "Thu hồi ứng dụng",
  SCOPES_CHANGED: "Cập nhật scope",
  SITE_KEY_ROTATED: "Đổi site key",
  CREDENTIAL_CREATED: "Tạo credential",
  CREDENTIAL_REVOKED: "Thu hồi credential",
  TOKEN_DENIED_REPEATEDLY: "Xin token bị từ chối nhiều lần",
  DOMAIN_ADDED: "Thêm domain",
  DOMAIN_REMOVED: "Xóa domain",
};

export const MAX_APPLICATIONS_NOTE = "Mỗi đơn vị tạo được tối đa 20 ứng dụng chưa thu hồi.";
