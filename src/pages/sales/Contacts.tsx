import { usePageSize, Eye, actionsColumn } from "@/ui";
import { useSearchParams } from "react-router";
import { PERMISSIONS, can, useApi, useSession } from "@/api";
import { DataTable, DatePicker, QueryBoundary, Select, Tag, dayjs, type DataColumn } from "@/ui";
import { SalesGate } from "./_components/SalesGate";
import { CONTACT_NOTE, CONTACT_STATUS, CONTACT_STATUS_COLOR, CONTACT_TOPICS, type ContactSummary } from "./_lib/contacts";
import { label, pageParams, type Page } from "./_lib/sales";


export default function ContactsPage() {
  const s = useSession();
  const [sp, setSp] = useSearchParams();
  const SIZE = usePageSize();
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const status = sp.get("status") ?? "";
  const topic = sp.get("topic") ?? "";
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";
  const allowed = can(s, PERMISSIONS.SALES_CONTACT_SEARCH);
  // `from` bao gồm, `to` loại trừ: ngày kết thúc người dùng chọn là bao gồm nên cộng một ngày.
  const iso = (d: string, plus = 0) => (d ? dayjs(d).add(plus, "day").startOf("day").toISOString() : undefined);
  const q = useApi<Page<ContactSummary>>(
    allowed ? `/api/sales/contact-requests?${pageParams(sp, SIZE, { status, topic, from: iso(from), to: iso(to, 1) })}` : null,
  );

  const setMany = (kv: Record<string, string | undefined>) => {
    const n = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(kv)) {
      if (v) n.set(k, v);
      else n.delete(k);
    }
    n.delete("page");
    setSp(n, { replace: true });
  };

  const columns: DataColumn[] = [
    { key: "topic", title: "Chủ đề", dataIndex: "topic", kind: "link", href: "/sales/contacts/{id}", render: (v) => label(CONTACT_TOPICS, v as string) },
    { key: "st", title: "Trạng thái", dataIndex: "status", render: (v) => <Tag color={CONTACT_STATUS_COLOR[v as string]}>{label(CONTACT_STATUS, v as string)}</Tag> },
    { key: "at", title: "Gửi lúc", dataIndex: "createdAt", kind: "datetime" },
    {
      key: "who",
      title: "Người liên hệ",
      dataIndex: "contact",
      render: (_v, r) => {
        const c = r.contact as ContactSummary["contact"];
        return [c?.name, c?.email, c?.phone].filter(Boolean).join(" · ") || "—";
      },
    },
    { key: "anon", title: "Ẩn danh", dataIndex: "piiAnonymizedAt", render: (v) => (v ? <Tag>Đã ẩn danh</Tag> : "—") },
actionsColumn((row) => [{ key: "view", label: "Xem", icon: <Eye size={16} />, to: `/sales/contacts/${encodeURIComponent(String(row.id))}` }], 1),
];

  return (
    <SalesGate title="Liên hệ khách" description={CONTACT_NOTE} permission={PERMISSIONS.SALES_CONTACT_SEARCH}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            aria-label="Trạng thái liên hệ"
            className="w-44"
            value={status}
            onChange={(v) => setMany({ status: v })}
            options={[{ value: "", label: "Mọi trạng thái" }, ...Object.entries(CONTACT_STATUS).map(([value, l]) => ({ value, label: l }))]}
          />
          <Select
            aria-label="Chủ đề liên hệ"
            className="w-40"
            value={topic}
            onChange={(v) => setMany({ topic: v })}
            options={[{ value: "", label: "Mọi chủ đề" }, ...Object.entries(CONTACT_TOPICS).map(([value, l]) => ({ value, label: l }))]}
          />
          <DatePicker.RangePicker
            allowClear
            format="DD/MM/YYYY"
            placeholder={["Từ ngày", "Đến ngày"]}
            value={from && to ? [dayjs(from), dayjs(to)] : null}
            onChange={(v) =>
              setMany(v?.[0] && v?.[1] ? { from: v[0].format("YYYY-MM-DD"), to: v[1].format("YYYY-MM-DD") } : { from: undefined, to: undefined })
            }
          />
        </div>
        <QueryBoundary query={q}>
          {(p) => (
            <DataTable
              columns={columns}
              rows={p.items as unknown as Record<string, unknown>[]}
              rowKey="id"
              mobileTitleKey="topic"
              pagination={{ mode: "server", page, pageSize: SIZE, total: p.total }}
              empty={{ title: "Không có yêu cầu liên hệ nào.", hint: "Thử đổi bộ lọc." }}
            />
          )}
        </QueryBoundary>
      </div>
    </SalesGate>
  );
}
