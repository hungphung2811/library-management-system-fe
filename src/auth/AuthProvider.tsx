import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getActingTenant, setActingTenant, subscribeActingTenant } from "@/api/acting-tenant";
import { apiFetch, refreshSession, refreshSessionDetailed } from "@/api/client";
import type { TokenResponse } from "@/api/config";
import { sessionFromToken, withActingTenant, type Session } from "@/api/session";
import { clearTokens, getAccessToken, getRefreshToken, persistRefreshTokenOnly, setTokens, subscribeTokens } from "@/api/token-store";

export type TenantSummary = { id: string; code: string; name: string };

type AuthContextValue = {
  /** null = chưa đăng nhập. */
  session: Session | null;
  /** false trong lúc boot đang làm mới phiên từ refresh token (hiện màn hình chờ, chưa quyết định chuyển trang). */
  ready: boolean;
  /** Đăng nhập; trả cờ mustChangePassword để trang login chuyển sang /change-password. */
  login: (username: string, password: string) => Promise<{ mustChangePassword: boolean }>;
  /** Thu hồi refresh token (best-effort), xóa phiên và cache dữ liệu. */
  logout: () => Promise<void>;
  /** Chuyển đơn vị: cần refresh token; token mới thay token cũ và cache dữ liệu của tenant cũ bị bỏ. Lỗi ném ApiCallError. */
  switchTenant: (tenantId: string, opts?: { reload?: boolean }) => Promise<void>;
  /**
   * Chỉ platform admin (ADR-0016): làm việc thay đơn vị `tenantId` (null = thôi chọn). Mọi lời gọi `/api/**` sau đó gửi
   * `X-Tenant-Id`, session hiệu lực mang tenantId đó như admin của đơn vị, và cache dữ liệu của lựa chọn cũ bị bỏ.
   */
  actAsTenant: (tenantId: string | null, opts?: { reload?: boolean }) => void;
  /**
   * Làm mới quyền (ADR-0022): `POST /api/auth/refresh` để token mới mang role/permission/module mới nhất, bỏ cache dữ liệu
   * ("api", "tenants") để menu và nút tính lại. Không đổi lựa chọn đơn vị của platform admin. `changed` = so claim
   * permissions/modules/admin/roles của token cũ và mới. `ended` = phiên đã bị xóa (người dùng sẽ về trang đăng nhập).
   */
  refreshPermissions: () => Promise<PermissionRefreshResult>;
};

export type PermissionRefreshResult =
  | { status: "updated" | "unchanged" }
  | { status: "ended"; reason: "revoked" | "disabled" | "locked" | "no-token" }
  | { status: "failed"; reason: "temporary" | "superseded" | "no-tenant" };

const sameSet = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join("\n") === [...b].sort().join("\n");

function claimsChanged(a: Session | null, b: Session | null): boolean {
  if (!a || !b) return a !== b;
  return (
    a.admin !== b.admin ||
    a.tenantId !== b.tenantId ||
    !sameSet(a.permissions, b.permissions) ||
    !sameSet(a.modules, b.modules) ||
    !sameSet(a.roles, b.roles)
  );
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const token = useSyncExternalStore(subscribeTokens, getAccessToken, () => null);
  const acting = useSyncExternalStore(subscribeActingTenant, getActingTenant, () => null);
  const session = useMemo(() => withActingTenant(sessionFromToken(token), acting), [token, acting]);
  // Có refresh token mà chưa có access token (vừa tải trang): làm mới trước khi biết đã đăng nhập hay chưa.
  const [ready, setReady] = useState(() => !!getAccessToken() || !getRefreshToken());

  useEffect(() => {
    if (ready) return;
    let alive = true;
    void refreshSession().finally(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, [ready]);

  const login = useCallback<AuthContextValue["login"]>(
    async (username, password) => {
      const t = await apiFetch<TokenResponse>("/api/auth/login", { method: "POST", json: { username, password }, anonymous: true });
      qc.clear();
      setActingTenant(null); // đăng nhập tài khoản khác: không thừa hưởng đơn vị đã chọn của phiên trước
      setTokens(t);
      return { mustChangePassword: t.mustChangePassword === true };
    },
    [qc],
  );

  const logout = useCallback<AuthContextValue["logout"]>(async () => {
    const rt = getRefreshToken();
    if (rt) {
      await apiFetch("/api/auth/logout", { method: "POST", json: { refreshToken: rt }, anonymous: true }).catch(() => null);
    }
    clearTokens();
    setActingTenant(null);
    qc.clear();
  }, [qc]);

  const actAsTenant = useCallback<AuthContextValue["actAsTenant"]>(
    (tenantId, opts) => {
      if (tenantId === getActingTenant()) return;
      if (opts?.reload) {
        // Chỉ ghi lựa chọn rồi tải lại: không xóa cache, không render lại, nên không có lời gọi API thừa.
        setActingTenant(tenantId, { silent: true });
        window.location.reload();
        return;
      }
      qc.removeQueries({ predicate: (q) => q.queryKey[0] === "api" });
      setActingTenant(tenantId);
    },
    [qc],
  );

  const switchTenant = useCallback<AuthContextValue["switchTenant"]>(
    async (tenantId, opts) => {
      const refreshToken = getRefreshToken();
      const t = await apiFetch<TokenResponse>("/api/auth/switch-tenant", { method: "POST", json: { tenantId, refreshToken } });
      if (opts?.reload) {
        // Refresh token cũ đã bị thu hồi: chỉ lưu token mới rồi tải lại; boot sẽ đổi nó ra access token của đơn vị mới.
        persistRefreshTokenOnly(t.refreshToken);
        window.location.reload();
        return;
      }
      qc.removeQueries({ predicate: (q) => q.queryKey[0] === "api" });
      setTokens(t);
    },
    [qc],
  );

  const refreshPermissions = useCallback<AuthContextValue["refreshPermissions"]>(async () => {
    const before = sessionFromToken(getAccessToken());
    const outcome = await refreshSessionDetailed();
    if (outcome === "ok") {
      // Chỉ bỏ cache; không đụng lựa chọn đơn vị (lms_act_tenant) của platform admin.
      qc.removeQueries({ predicate: (q) => q.queryKey[0] === "api" });
      void qc.invalidateQueries({ queryKey: ["tenants"] });
      return { status: claimsChanged(before, sessionFromToken(getAccessToken())) ? "updated" : "unchanged" };
    }
    if (outcome === "revoked" || outcome === "disabled" || outcome === "locked" || outcome === "no-token") {
      setActingTenant(null);
      qc.clear();
      return { status: "ended", reason: outcome };
    }
    return { status: "failed", reason: outcome === "transient" ? "temporary" : outcome };
  }, [qc]);

  const value = useMemo(
    () => ({ session, ready, login, logout, switchTenant, actAsTenant, refreshPermissions }),
    [session, ready, login, logout, switchTenant, actAsTenant, refreshPermissions],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const v = useContext(AuthContext);
  if (!v) throw new Error("useAuth phải nằm trong <AuthProvider>");
  return v;
}

/** Session hiện tại hoặc null (dùng ở trang công khai như /login). */
export function useSessionOptional(): Session | null {
  return useAuth().session;
}

/** Session của người đã đăng nhập; chỉ dùng bên trong ProtectedRoute (ngoài đó ném lỗi). */
export function useSession(): Session {
  const s = useSessionOptional();
  if (!s) throw new Error("useSession chỉ dùng được trong vùng ProtectedRoute; trang công khai dùng useSessionOptional");
  return s;
}

/** Danh sách đơn vị của người dùng (`/api/me/tenants`), dùng chung cho TenantSwitcher và UserMenu. */
export function useTenants() {
  const userId = useSessionOptional()?.userId;
  return useQuery<TenantSummary[]>({
    queryKey: ["tenants", userId],
    queryFn: async () => {
      const l = await apiFetch<TenantSummary[]>("/api/me/tenants");
      return Array.isArray(l) ? l : [];
    },
    enabled: !!userId,
    staleTime: 5 * 60_000,
  });
}
