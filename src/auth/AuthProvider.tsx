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
import { apiFetch, refreshSession } from "@/api/client";
import type { TokenResponse } from "@/api/config";
import { sessionFromToken, type Session } from "@/api/session";
import { clearTokens, getAccessToken, getRefreshToken, setTokens, subscribeTokens } from "@/api/token-store";

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
  switchTenant: (tenantId: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const token = useSyncExternalStore(subscribeTokens, getAccessToken, () => null);
  const session = useMemo(() => sessionFromToken(token), [token]);
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
    qc.clear();
  }, [qc]);

  const switchTenant = useCallback<AuthContextValue["switchTenant"]>(
    async (tenantId) => {
      const refreshToken = getRefreshToken();
      const t = await apiFetch<TokenResponse>("/api/auth/switch-tenant", { method: "POST", json: { tenantId, refreshToken } });
      qc.removeQueries({ predicate: (q) => q.queryKey[0] === "api" });
      setTokens(t);
    },
    [qc],
  );

  const value = useMemo(() => ({ session, ready, login, logout, switchTenant }), [session, ready, login, logout, switchTenant]);
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
