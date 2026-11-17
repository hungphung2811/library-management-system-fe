import type { ReactNode } from "react";
import { useSession } from "@/api";
import { NoPermission } from "@/ui";

/** Chỉ platform admin vào được (token không có tenantId, claim platformAdmin). BE trả 403 mới là quyết định cuối. */
export function PlatformGate({ children }: { children: ReactNode }) {
  const s = useSession();
  if (!s.platformAdmin) return <NoPermission feature="Quản trị nền tảng (chỉ platform admin)" />;
  return <>{children}</>;
}
