import { Alert, AppShell, Card, Empty, PageHeader } from "@mfe/ui";
import { requireSession } from "@mfe/api";

export default async function CatalogPage() {
  const s = await requireSession("/catalog");
  return (
    <AppShell current="/catalog" session={s}>
      <PageHeader title="Danh mục sách" description="Tra cứu và quản lý đầu sách trong thư viện" />
      <Alert
        type="warning"
        showIcon
        title="catalog-service ở BE mới là khung (chưa có endpoint /api/books). Sẽ nối khi BE sẵn sàng."
        className="mb-5"
      />
      <Card>
        <Empty description="Chưa có dữ liệu sách" />
      </Card>
    </AppShell>
  );
}
