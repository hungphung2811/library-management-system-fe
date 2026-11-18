// Đơn vị (tenant) mà platform admin đang "làm việc thay" (ADR-0016 ở BE): gửi header `X-Tenant-Id` để đọc và ghi dữ liệu
// của đơn vị đó như admin của nó. Giá trị nằm ở localStorage (khóa `lms_act_tenant`) để giữ qua lần tải lại trang.
// Chỉ có tác dụng với tài khoản platform admin (xem `withActingTenant` ở session.ts); BE bỏ qua header của người khác.
// Module này không phụ thuộc React.

export const ACTING_TENANT_KEY = "lms_act_tenant";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function read(): string | null {
  try {
    const v = localStorage.getItem(ACTING_TENANT_KEY);
    return v && UUID.test(v) ? v : null;
  } catch {
    return null;
  }
}

let current: string | null = read();
const listeners = new Set<() => void>();

export function getActingTenant(): string | null {
  return current;
}

/** `null` = không làm việc thay đơn vị nào (xóa lựa chọn). UUID sai định dạng bị coi là `null`. */
export function setActingTenant(tenantId: string | null, opts?: { silent?: boolean }) {
  const next = tenantId && UUID.test(tenantId) ? tenantId : null;
  if (next === current) return;
  try {
    if (next) localStorage.setItem(ACTING_TENANT_KEY, next);
    else localStorage.removeItem(ACTING_TENANT_KEY);
  } catch {
    /* localStorage bị chặn: lựa chọn chỉ sống tới khi tải lại trang */
  }
  // silent: chỉ ghi localStorage cho lần tải lại sắp tới, không đổi giá trị trong bộ nhớ nên giao diện không render lại,
  // không bắn lời gọi API nào theo đơn vị mới trước khi trang reload.
  if (opts?.silent) return;
  current = next;
  listeners.forEach((l) => l());
}

export function subscribeActingTenant(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/**
 * Đường dẫn không gắn header: đăng nhập/làm mới/đăng xuất, và vùng quản trị nền tảng (`/api/platform/**`, `/api/cms/**`)
 * vốn không thuộc một đơn vị nào (BE dùng `@PlatformAdminOnly`).
 */
export function skipsActingTenant(path: string): boolean {
  return path.startsWith("/api/auth/") || path.startsWith("/api/platform/") || path.startsWith("/api/cms/");
}
