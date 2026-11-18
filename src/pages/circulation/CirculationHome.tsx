import type { ReactNode } from "react";
import { PERMISSIONS, can, useSession } from "@/api";
import { Card, DataTable, PageHeader, Tag, Text } from "@/ui";

export default function CirculationHomePage() {
  const s = useSession();
  const perm = (key: string) => (can(s, key) ? <Tag color="success">Được phép</Tag> : <Tag>Không có quyền</Tag>);

  return (
    <>
      <PageHeader title="Mượn trả" description="Lập phiếu, nhận trả, gia hạn và đặt trước sách." />
      <div className="flex flex-col gap-5">
        <Card title="Quyền nghiệp vụ của bạn">
          <DataTable
            embedded
            rowKey="id"
            empty={{ title: "Chưa có nghiệp vụ nào" }}
            columns={[
              { key: "action", title: "Nghiệp vụ", dataIndex: "action" },
              { key: "allowed", title: "Quyền", dataIndex: "allowed", width: 160, render: (v) => v as ReactNode },
            ]}
            rows={[
              { id: "borrow", action: "Mượn sách", allowed: perm(PERMISSIONS.BORROW_BOOK) },
              { id: "return", action: "Trả sách", allowed: perm(PERMISSIONS.RETURN_BOOK) },
            ]}
          />
        </Card>

        <Text type="secondary">
          Danh sách phiếu mượn của tôi, trả theo mã vạch, báo hỏng, báo mất và thu phạt sẽ có khi hệ thống hỗ trợ.
        </Text>
      </div>
    </>
  );
}
