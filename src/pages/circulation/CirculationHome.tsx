import { PERMISSIONS, can, useSession } from "@/api";
import { Card, PageHeader, Tag, Text } from "@/ui";

export default function CirculationHomePage() {
  const s = useSession();
  const perm = (key: string) => (can(s, key) ? <Tag color="success">Được phép</Tag> : <Tag>Không có quyền</Tag>);

  return (
    <>
      <PageHeader title="Mượn trả" description="Lập phiếu, nhận trả, gia hạn và đặt trước sách." />
      <div className="flex max-w-[1200px] flex-col gap-5">
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
