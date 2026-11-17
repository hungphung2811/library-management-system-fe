import { useState } from "react";
import { useSearchParams } from "react-router";
import { apiFetch } from "@/api";
import { RemoteSelect, type Opt } from "@/ui";
import { userLabel, type UserBrief } from "../_lib/circulation";

/** Chọn độc giả để xem phạt: đẩy `readerId` lên URL (trang tự tải dữ liệu theo URL). */
export function FineReaderPicker({ current }: { current?: Opt }) {
  const [, setSp] = useSearchParams();
  // Giữ mục vừa chọn (đủ nhãn) trong lúc nhãn đầy đủ từ URL chưa tải xong.
  const [picked, setPicked] = useState<Opt | undefined>();
  const value = picked && (!current || picked.value === current.value) ? picked : current;
  const search = async (q: string): Promise<Opt[]> => {
    const r = await apiFetch<{ items: UserBrief[] }>(`/api/users?keyword=${encodeURIComponent(q)}&page=0&size=10`);
    return r.items.map((u) => ({ value: u.id, label: userLabel(u) }));
  };
  return (
    <div className="max-w-[560px]">
      <RemoteSelect
        fetcher={search}
        value={value}
        placeholder="Tìm độc giả theo tên, tài khoản hoặc email"
        onChange={(o) => {
          setPicked(o);
          setSp(o ? { readerId: o.value } : {});
        }}
      />
    </div>
  );
}
