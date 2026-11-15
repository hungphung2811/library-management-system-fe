import { PERMISSIONS, can, requireSession } from "@mfe/api";
import { NoPermission, PageHeader } from "@mfe/ui";
import { BarcodeLookup } from "../_components/BarcodeLookup";

export default async function BarcodePage() {
  const s = await requireSession("/catalog/barcode");
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
