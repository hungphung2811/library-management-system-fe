import { useId } from "react";
import { useSearchParams } from "react-router";
import { Switch } from "@/ui";

/** Bộ lọc "Chỉ hiện sách còn bản sẵn sàng": đẩy `available=true` lên URL và bỏ `page`. */
export function AvailableToggle({ checked }: { checked: boolean }) {
  const [sp, setSp] = useSearchParams();
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <Switch
        id={id}
        checked={checked}
        onChange={(on) => {
          const q = new URLSearchParams(sp.toString());
          if (on) q.set("available", "true");
          else q.delete("available");
          q.delete("page");
          setSp(q, { replace: true });
        }}
      />
      <label htmlFor={id} className="text-sm">
        Chỉ hiện sách còn bản sẵn sàng
      </label>
    </div>
  );
}
