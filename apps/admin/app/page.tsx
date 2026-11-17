import { PERMISSIONS, can, requireSession } from "@mfe/api";
import { Activity, Alert, Card, DataTable, ErrorPanel, KeyRound, Network, PageHeader, ScrollText, ShieldCheck, Statistic, Text, Users } from "@mfe/ui";
import type { ComponentType } from "react";
import { load } from "./data";
import type { AuditLogView, DepartmentView, PageView, RoleView, UserPage } from "./types";

type Shortcut = { href: string; title: string; desc: string; allowed: boolean; tone: Tone };
type Tone = "blue" | "green" | "amber" | "violet";
type Icon = ComponentType<{ size?: number; strokeWidth?: number }>;

/** Mỗi mảng chức năng một màu: nền nhạt, chữ/icon đậm, viền trên làm điểm nhấn. */
const TONES: Record<Tone, { chip: string; bar: string; text: string }> = {
  blue: { chip: "bg-[#e8f2ff]", bar: "bg-[#1b84ff]", text: "text-[#1368cc]" },
  green: { chip: "bg-[#e3f8ee]", bar: "bg-[#17b26a]", text: "text-[#0f8a50]" },
  amber: { chip: "bg-[#fff3de]", bar: "bg-[#f5a524]", text: "text-[#b57308]" },
  violet: { chip: "bg-[#efe9ff]", bar: "bg-[#7a5af8]", text: "text-[#5b3fd0]" },
};
const ICONS: Record<string, Icon> = {
  "/admin/users": Users,
  "/admin/roles": KeyRound,
  "/admin/departments": Network,
  "/admin/audit-logs": ScrollText,
};
const TONE_OF: Record<string, Tone> = {
  "/admin/users": "blue",
  "/admin/roles": "violet",
  "/admin/departments": "green",
  "/admin/audit-logs": "amber",
};

function IconChip({ href, size = 18 }: { href: string; size?: number }) {
  const I = ICONS[href] ?? Activity;
  const t = TONES[TONE_OF[href] ?? "blue"];
  return (
    <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${t.chip} ${t.text}`}>
      <I size={size} strokeWidth={1.8} />
    </span>
  );
}

// Dùng <a> thường (không next/link): admin có basePath "/admin" nên Link sẽ nối thành /admin/admin/...
export default async function AdminPage() {
  const s = await requireSession("/admin");
  const canUsers = can(s, PERMISSIONS.USER_SEARCH);
  const canRoles = can(s, PERMISSIONS.LIST_ROLES);
  const canDepts = can(s, PERMISSIONS.DEPT_LIST);
  const canAudit = can(s, PERMISSIONS.AUDIT_SEARCH);
  const anyAdmin = canUsers || canRoles || canDepts || canAudit || can(s, PERMISSIONS.DEPT_TREE);

  // Các khối độc lập nhau nên gọi song song; khối nào không có quyền thì bỏ qua, không làm hỏng cả trang.
  const [users, roles, depts, audit] = await Promise.all([
    canUsers ? load<UserPage>("/api/users?page=0&size=1") : null,
    canRoles ? load<RoleView[]>("/api/roles") : null,
    canDepts ? load<DepartmentView[]>("/api/departments") : null,
    canAudit ? load<PageView<AuditLogView>>("/api/audit-logs?page=0&size=8") : null,
  ]);

  const adminRoles = roles?.data?.filter((r) => r.isAdmin ?? r.admin).length ?? 0;
  const activeDepts = depts?.data?.filter((d) => d.status === "ACTIVE").length ?? 0;

  const stats = [
    users && { title: "Người dùng", value: users.data?.total, href: "/admin/users" },
    roles && { title: "Vai trò", value: roles.data?.length, href: "/admin/roles", note: `${adminRoles} vai trò quản trị` },
    depts && { title: "Phòng ban", value: depts.data?.length, href: "/admin/departments", note: `${activeDepts} đang dùng` },
    audit && { title: "Sự kiện đã ghi", value: audit.data?.total, href: "/admin/audit-logs" },
  ].filter(Boolean) as { title: string; value?: number; href: string; note?: string }[];

  const shortcuts: Shortcut[] = [
    { href: "/admin/users", title: "Người dùng", desc: "Tạo, sửa, khóa tài khoản và thẻ độc giả.", allowed: canUsers, tone: "blue" as Tone },
    { href: "/admin/roles", title: "Vai trò và quyền", desc: "Gán quyền cho vai trò, gán vai trò cho người dùng.", allowed: canRoles, tone: "violet" as Tone },
    { href: "/admin/departments", title: "Phòng ban", desc: "Cây phòng ban và trạng thái sử dụng.", allowed: can(s, PERMISSIONS.DEPT_TREE), tone: "green" as Tone },
    { href: "/admin/audit-logs", title: "Nhật ký hoạt động", desc: "Tra cứu sự kiện nghiệp vụ theo đối tượng hoặc loại.", allowed: canAudit, tone: "amber" as Tone },
  ].filter((x) => x.allowed);

  return (
    <>
      <PageHeader title="Quản trị" description="Tổng quan người dùng, vai trò, phòng ban và hoạt động hệ thống." />
      <div className="flex max-w-[1200px] flex-col gap-4">
        <Text type="secondary">Vai trò của bạn: {s.roles.join(", ") || "—"}</Text>

        {!anyAdmin && (
          <Alert
            type="warning"
            showIcon
            title={`Cần quyền ${PERMISSIONS.LIST_ROLES} (hoặc một quyền quản trị khác) để dùng khu vực này.`}
          />
        )}

        {stats.length > 0 && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {stats.map((x) => (
              <a key={x.title} href={x.href} className="block">
                <Card hoverable styles={{ body: { padding: 0 } }} className="overflow-hidden">
                  <div className={`h-1 ${TONES[TONE_OF[x.href] ?? "blue"].bar}`} />
                  <div className="flex items-start justify-between gap-3 p-4">
                    <div>
                      <Statistic title={x.title} value={x.value ?? "—"} />
                      {x.note && <div className={`mt-1 text-xs ${TONES[TONE_OF[x.href] ?? "blue"].text}`}>{x.note}</div>}
                    </div>
                    <IconChip href={x.href} />
                  </div>
                </Card>
              </a>
            ))}
          </div>
        )}

        {shortcuts.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {shortcuts.map((x) => (
              <a key={x.href} href={x.href} className="block">
                <Card hoverable>
                  <div className="flex items-start gap-3">
                    <IconChip href={x.href} />
                    <div>
                      <div className={`font-medium ${TONES[x.tone].text}`}>{x.title}</div>
                      <div className="mt-0.5 text-xs text-muted">{x.desc}</div>
                    </div>
                  </div>
                </Card>
              </a>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          {audit && (
            <Card title={<span className="flex items-center gap-2"><Activity size={15} className="text-[#b57308]" />Hoạt động gần đây</span>} styles={{ body: { padding: 0 } }} className="overflow-hidden lg:col-span-3">
              {audit.error ? (
                <div className="p-4">
                  <ErrorPanel error={audit.error} retryHref="/admin" />
                </div>
              ) : (
                <DataTable
                  rowKey="id"
                  rows={audit.data.items.map((a) => ({
                    id: a.id,
                    eventType: a.eventType,
                    aggregateId: a.aggregateId ?? "",
                    occurredAt: a.occurredAt ?? a.recordedAt ?? "",
                  }))}
                  columns={[
                    { key: "occurredAt", title: "Thời gian", dataIndex: "occurredAt", kind: "datetime" },
                    { key: "eventType", title: "Sự kiện", dataIndex: "eventType" },
                    { key: "aggregateId", title: "Đối tượng", dataIndex: "aggregateId", kind: "mono" },
                  ]}
                  empty={{ title: "Chưa có hoạt động nào." }}
                />
              )}
            </Card>
          )}
          {roles && (
            <Card title={<span className="flex items-center gap-2"><ShieldCheck size={15} className="text-[#5b3fd0]" />Vai trò</span>} styles={{ body: { padding: 0 } }} className="overflow-hidden lg:col-span-2">
              {roles.error ? (
                <div className="p-4">
                  <ErrorPanel error={roles.error} retryHref="/admin" />
                </div>
              ) : (
                <DataTable
                  rowKey="id"
                  rows={roles.data}
                  columns={[{ key: "name", title: "Vai trò", dataIndex: "name", kind: "link", href: "/admin/roles/{id}" }]}
                  empty={{ title: "Chưa có vai trò nào." }}
                />
              )}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
