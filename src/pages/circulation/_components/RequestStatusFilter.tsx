import { useSearchParams } from "react-router";
import { Select } from "@/ui";
import { REQUEST_STATUS } from "../_lib/compensation";

/** Ô lọc trạng thái yêu cầu, ghi vào query `status` và đặt lại trang. */
export function RequestStatusFilter({ id }: { id: string }) {
  const [sp, setSp] = useSearchParams();
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        Trạng thái
      </label>
      <Select
        id={id}
        className="w-48"
        value={sp.get("status") ?? ""}
        onChange={(v) => {
          const n = new URLSearchParams(sp);
          if (v) n.set("status", v);
          else n.delete("status");
          n.delete("page");
          setSp(n, { replace: true });
        }}
        options={[{ value: "", label: "Tất cả" }, ...Object.entries(REQUEST_STATUS).map(([value, label]) => ({ value, label }))]}
      />
    </div>
  );
}
