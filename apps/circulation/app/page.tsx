import { Card, Descriptions, Nav, Page, PageHeader, Tag, Text } from "@mfe/ui";
import { PERMISSIONS, can, requireSession } from "@mfe/api";

export default async function CirculationPage() {
  const s = await requireSession("/circulation");
  const perm = (key: string) =>
    can(s, key) ? <Tag color="success">Được phép</Tag> : <Tag>Không có quyền</Tag>;

  return (
    <>
      <Nav current="/circulation" session={s} />
      <Page>
        <PageHeader title="Mượn trả sách" description="Quyền của bạn trong nghiệp vụ mượn trả" />
        <Card title="Quyền nghiệp vụ" className="mb-4">
          <Descriptions
            column={1}
            items={[
              { key: "borrow", label: "Mượn sách", children: perm(PERMISSIONS.BORROW_BOOK) },
              { key: "return", label: "Trả sách", children: perm(PERMISSIONS.RETURN_BOOK) },
            ]}
          />
        </Card>
        <Text type="secondary">
          BE có sẵn: POST /api/borrowings, POST /api/borrowings/:id/returns, POST /api/borrowings/:id/renewals,
          GET /api/borrowings/:id.
        </Text>
      </Page>
    </>
  );
}
