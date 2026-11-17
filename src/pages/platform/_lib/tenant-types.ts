export type TenantStatus = "ACTIVE" | "SUSPENDED";
export type ModuleCode = "LENDING" | "SALES";

/** GET /api/platform/tenants (phần tử) và phản hồi tạo/sửa/ngưng/kích hoạt. */
export type TenantSummary = {
  id: string;
  code: string;
  name: string;
  organizationId: string | null;
  status: TenantStatus;
  memberCount: number;
  modules?: string[];
  /** null khi ACTIVE: MANUAL | CONTRACT_EXPIRED | CONTRACT_CANCELLED (ADR-0012). */
  suspensionCause?: string | null;
};

/** GET /api/platform/tenants/{id}. */
export type TenantDetail = TenantSummary & { adminUserIds: string[] };

export type TenantPage = { items: TenantSummary[]; total: number; page: number; size: number };

export type Organization = { id: string; name: string; createdAt: string };

/** GET /api/platform/tenants/{id}/modules (phần tử). */
export type TenantModule = { module: string; enabled: boolean; updatedAt: string | null; updatedBy: string | null };

export type NewAdminInput = { username: string; fullName: string; email: string; temporaryPassword: string };

export type TenantUser = { id: string; username: string; fullName: string; email?: string | null; status?: string };
export type TenantUserPage = { items: TenantUser[]; total: number; page: number; size: number };
