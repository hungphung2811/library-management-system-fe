// Kiểu dữ liệu BE (lms-api) mà nhóm admin dùng. Chỉ khai báo trường FE đọc.
export type UserView = {
  id: string;
  username: string;
  fullName: string;
  email: string;
  departmentId?: string | null;
  status: string;
  /** Khóa đăng nhập tự động còn hiệu lực (sau nhiều lần sai). */
  locked?: boolean;
  lockedUntil?: string | null;
};

export type UserPage = { items: UserView[]; total: number; page: number; size: number };

export type RoleView = {
  id: string;
  name: string;
  description?: string;
  /** BE ký tên trường là `isAdmin`; chấp nhận cả `admin` phòng khi Jackson đổi tên. */
  isAdmin?: boolean;
  admin?: boolean;
  permissions?: string[];
};

export type PermissionView = {
  code: string;
  description?: string;
  source?: string;
  service?: string;
  httpMethod?: string;
  pathPattern?: string;
  firstSeenAt?: string;
};

export type UserAccessView = { userId: string; roles: string[]; permissions: string[]; admin: boolean };

export type DepartmentView = { id: string; code: string; name: string; parentId?: string | null; status: string };

export type DepartmentNode = { id: string; code: string; name: string; status: string; children?: DepartmentNode[] };

export type ReaderProfileView = {
  userId: string;
  cardNo: string;
  fullName: string;
  email: string;
  readerType: string;
  cardExpiryDate: string;
  status: string;
  cardValid: boolean;
};

export type AuditLogView = {
  id: string;
  eventId?: string;
  eventType: string;
  aggregateId?: string;
  /** Có khi BE trả (platform admin đọc xuyên tenant). */
  tenantId?: string | null;
  occurredAt?: string;
  recordedAt?: string;
  payload?: unknown;
};

export type PageView<T> = { items: T[]; total: number; page: number; size: number };

export const isAdminRole = (r: RoleView) => (r.isAdmin ?? r.admin) === true;

export const READER_TYPES = [
  { value: "STUDENT", label: "Sinh viên" },
  { value: "LECTURER", label: "Giảng viên" },
];
export const readerTypeLabel = (v?: string) => READER_TYPES.find((t) => t.value === v)?.label ?? v;
