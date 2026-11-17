import type { ComponentType } from "react";
import { Link } from "react-router";
import { PERMISSIONS, can, useApi, useSession } from "@/api";
import {
  Activity,
  Alert,
  Card,
  DataTable,
  KeyRound,
  Network,
  PageHeader,
  PageSkeleton,
  ScrollText,
  ShieldCheck,
  Skeleton,
  Statistic,
  Text,
  Users,
} from "@/ui";
import { ErrorBlock } from "./_components/ErrorBlock";
import type { AuditLogView, DepartmentView, PageView, RoleView, UserPage } from "./_lib/types";

type Tone = "blue" | "green" | "amber" | "violet";
type Icon = ComponentType<{ size?: number; strokeWidth?: number }>;

/** Mỗi mảng chức năng một sắc thái (token của theme): nền chip nhạt, chữ/icon đậm. */
const TONES: Record<Tone, { chip: string; bar: string; text: string }> = {
  blue: { chip: "bg-primary-soft", bar: "bg-primary", text: "text-primary" },
  green: { chip: "bg-success-soft", bar: "bg-success", text: "text-success" },
  amber: { chip: "bg-warning-soft", bar: "bg-warning", text: "text-warning" },
  violet: { chip: "bg-violet-soft", bar: "bg-violet", text: "text-violet" },
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
    <span className={`inline-flex size-9 shrink-0 items-center justify-center rounded-control ${t.chip} ${t.text}`}>
      <I size={size} strokeWidth={1.8} />
    </span>
  );
}

export default function AdminHome() {
  const s = useSession();
  const canUsers = can(s, PERMISSIONS.USER_SEARCH);
  const canRoles = can(s, PERMISSIONS.LIST_ROLES);
  const canDepts = can(s, PERMISSIONS.DEPT_LIST);
  const canAudit = can(s, PERMISSIONS.AUDIT_SEARCH);
  const anyAdmin = canUsers || canRoles || canDepts || canAudit || can(s, PERMISSIONS.DEPT_TREE);

  // Các khối độc lập nhau nên gọi song song; khối nào không có quyền thì bỏ qua, không làm hỏng cả trang.
  const users = useApi<UserPage>(canUsers ? "/api/users?page=0&size=1" : null);
  const roles = useApi<RoleView[]>(canRoles ? "/api/roles" : null);
  const depts = useApi<DepartmentView[]>(canDepts ? "/api/departments" : null);
  const audit = useApi<PageView<AuditLogView>>(canAudit ? "/api/audit-logs?page=0&size=8" : null);

  // Khung chờ chỉ theo 3 truy vấn chính; nhật ký (support-service) có khối riêng, lỗi hay chậm cũng không chặn trang.
  const pending = (canUsers && users.isPending) || (canRoles && roles.isPending) || (canDepts && depts.isPending);
  if (pending) return <PageSkeleton variant="cards" />;

  const adminRoles = roles.data?.filter((r) => r.isAdmin ?? r.admin).length ?? 0;
  const activeDepts = depts.data?.filter((d) => d.status === "ACTIVE").length ?? 0;

  const stats = [
    canUsers && { title: "Người dùng", value: users.data?.total, href: "/admin/users" },
    canRoles && { title: "Vai trò", value: roles.data?.length, href: "/admin/roles", note: `${adminRoles} vai trò quản trị` },
    canDepts && { title: "Phòng ban", value: depts.data?.length, href: "/admin/departments", note: `${activeDepts} đang dùng` },
    canAudit && { title: "Sự kiện đã ghi", value: audit.data?.total, href: "/admin/audit-logs" },
  ].filter(Boolean) as { title: string; value?: number; href: string; note?: string }[];

  const shortcuts = [
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
              <Link key={x.title} to={x.href} className="block">
                <Card hoverable styles={{ body: { padding: 0 } }} className="overflow-hidden shadow-card">
                  <div className="flex items-start justify-between gap-3 p-4">
                    <div>
                      <Statistic title={x.title} value={x.value ?? "—"} />
                      {x.note && <div className={`mt-1 text-xs ${TONES[TONE_OF[x.href] ?? "blue"].text}`}>{x.note}</div>}
                    </div>
                    <IconChip href={x.href} />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {shortcuts.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {shortcuts.map((x) => (
              <Link key={x.href} to={x.href} className="block">
                <Card hoverable>
                  <div className="flex items-start gap-3">
                    <IconChip href={x.href} />
                    <div>
                      <div className={`font-medium ${TONES[x.tone].text}`}>{x.title}</div>
                      <div className="mt-0.5 text-xs text-muted">{x.desc}</div>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          {canAudit && (
            <Card
              title={
                <span className="flex items-center gap-2">
                  <Activity size={15} className="text-warning" />
                  Hoạt động gần đây
                </span>
              }
              styles={{ body: { padding: 0 } }}
              className="overflow-hidden lg:col-span-3"
            >
              {audit.isPending ? (
                <div className="p-4">
                  <Skeleton active paragraph={{ rows: 4 }} />
                </div>
              ) : audit.isError ? (
                <div className="p-4">
                  <ErrorBlock query={audit} />
                </div>
              ) : (
                <DataTable
                  embedded
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
          {canRoles && (
            <Card
              title={
                <span className="flex items-center gap-2">
                  <ShieldCheck size={15} className="text-violet" />
                  Vai trò
                </span>
              }
              styles={{ body: { padding: 0 } }}
              className="overflow-hidden lg:col-span-2"
            >
              {roles.isError ? (
                <div className="p-4">
                  <ErrorBlock query={roles} />
                </div>
              ) : (
                <DataTable
                  embedded
                  rowKey="id"
                  rows={roles.data ?? []}
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
