import { PERMISSIONS, can, useSession } from "@/api";
import { NoPermission, PageHeader } from "@/ui";
import { BarcodeLookup } from "./_components/BarcodeLookup";

export default function BarcodePage() {
  const s = useSession();
  return (
    <>
      <PageHeader title="Tra cứu theo mã vạch" description="Quét hoặc nhập mã vạch để xem bản sao và trạng thái." />
      {can(s, PERMISSIONS.COPY_BY_BARCODE) ? (
        <div className="max-w-[720px]">
          <BarcodeLookup canChange={can(s, PERMISSIONS.COPY_CHANGE_STATUS)} />
        </div>
      ) : (
        <NoPermission feature="Tra cứu theo mã vạch" />
      )}
    </>
  );
}
