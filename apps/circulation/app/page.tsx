import Link from "next/link";
import { Card, Empty, PageHeader, Tag, Text } from "@mfe/ui";
import { PERMISSIONS, can, requireSession } from "@mfe/api";

type Shortcut = { href: string; title: string; hint: string };

export default async function CirculationPage() {
  const s = await requireSession("/circulation");
  const perm = (key: string) =>
    can(s, key) ? <Tag color="success">Được phép</Tag> : <Tag>Không có quyền</Tag>;

  const shortcuts: Shortcut[] = [
    ...(can(s, PERMISSIONS.BORROW_BOOK)
      ? [{ href: "/borrow", title: "Lập phiếu mượn", hint: "Chọn độc giả, quét sách và lập phiếu." }]
      : []),
    ...(can(s, PERMISSIONS.RETURN_BOOK)
      ? [{ href: "/return", title: "Nhận trả sách", hint: "Nhập mã phiếu rồi quét sách để trả." }]
      : []),
    { href: "/borrowings", title: "Tra phiếu mượn", hint: "Xem phiếu mượn theo mã phiếu, gia hạn." },
    ...(can(s, PERMISSIONS.RESERVATION_MINE)
      ? [{ href: "/reservations", title: "Đặt trước của tôi", hint: "Xem hàng đợi, hạn nhận và hủy đặt trước." }]
      : []),
  ];

  return (
    <>
      <PageHeader title="Mượn trả" description="Lập phiếu, nhận trả, gia hạn và đặt trước sách." />
      <div className="flex max-w-[1200px] flex-col gap-5">
        {shortcuts.length === 0 ? (
          <Empty description="Tài khoản của bạn chưa được cấp quyền nghiệp vụ mượn trả." />
        ) : (
          <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2">
            {shortcuts.map((c) => (
              <li key={c.href}>
                <Link
                  href={c.href}
                  className="block min-h-16 rounded-xl border border-line bg-white p-4 no-underline transition-colors hover:border-brand-500 focus-visible:outline-2 focus-visible:outline-brand-500"
                >
                  <span className="block text-base font-semibold text-ink">{c.title}</span>
                  <span className="block text-sm text-muted">{c.hint}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <Card title="Quyền nghiệp vụ của bạn">
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            <li className="flex items-center justify-between gap-3">
              <span>Mượn sách</span>
              {perm(PERMISSIONS.BORROW_BOOK)}
            </li>
            <li className="flex items-center justify-between gap-3">
              <span>Trả sách</span>
              {perm(PERMISSIONS.RETURN_BOOK)}
            </li>
          </ul>
        </Card>

        <Text type="secondary">
          Danh sách phiếu mượn của tôi, trả theo mã vạch, báo hỏng, báo mất và thu phạt sẽ có khi hệ thống hỗ trợ.
        </Text>
      </div>
    </>
  );
}
