"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { bffFetch } from "@mfe/api/client";
import { RemoteSelect, type Opt } from "./RemoteSelect";

type UserView = { id: string; username: string; fullName: string; email: string };

/** Chọn độc giả để xem phạt: đẩy `readerId` lên URL (trang server tự tải dữ liệu). */
export function FineReaderPicker({ current }: { current?: Opt }) {
  const router = useRouter();
  const [value, setValue] = useState<Opt | undefined>(current);
  const search = async (q: string): Promise<Opt[]> => {
    const r = await bffFetch<{ items: UserView[] }>(`/api/users?keyword=${encodeURIComponent(q)}&page=0&size=10`);
    return r.items.map((u) => ({ value: u.id, label: `${u.fullName} · ${u.username} · ${u.email}` }));
  };
  return (
    <div className="max-w-[560px]">
      <RemoteSelect
        fetcher={search}
        value={value}
        placeholder="Tìm độc giả theo tên, tài khoản hoặc email"
        onChange={(o) => {
          setValue(o);
          router.push(o ? `/circulation/fines?readerId=${encodeURIComponent(o.value)}` : "/circulation/fines");
        }}
      />
    </div>
  );
}
