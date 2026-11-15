"use client";
import { useId } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Switch } from "@mfe/ui";

/** Bộ lọc "Chỉ hiện sách còn bản sẵn sàng": đẩy `available=true` lên URL và bỏ `page`. */
export function AvailableToggle({ checked }: { checked: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
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
          router.replace(q.size ? `${pathname}?${q}` : pathname);
        }}
      />
      <label htmlFor={id} className="text-sm">
        Chỉ hiện sách còn bản sẵn sàng
      </label>
    </div>
  );
}
