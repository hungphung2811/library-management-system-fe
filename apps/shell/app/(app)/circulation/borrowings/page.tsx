import { PageHeader, Text } from "@mfe/ui";
import { requireSession } from "@mfe/api";
import { LookupForm } from "../_components/LookupForm";

export default async function BorrowingsPage() {
  const s = await requireSession("/circulation/borrowings");
  return (
    <>
      <PageHeader title="Phiếu mượn" description="Tra phiếu mượn theo mã phiếu." />
      <div className="flex flex-col gap-4">
        <LookupForm />
        <Text type="secondary">Danh sách phiếu mượn sẽ có khi hệ thống hỗ trợ.</Text>
      </div>
    </>
  );
}
