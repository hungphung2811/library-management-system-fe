"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input } from "@mfe/ui";
import { UUID_RE } from "../lib/circulation";

/** Tra phiếu mượn theo mã (UUID) rồi chuyển tới trang chi tiết (trong zone nên dùng router, Next tự thêm basePath). */
export function LookupForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const id = code.trim();
  const valid = UUID_RE.test(id);
  const go = () => valid && router.push(`/borrowings/${encodeURIComponent(id)}`);

  return (
    <Card title="Tra phiếu mượn theo mã" className="max-w-[720px]">
      <label htmlFor="lookup-code" className="mb-1 block text-sm font-medium text-ink">
        Mã phiếu mượn (UUID)
      </label>
      <div className="flex gap-2">
        <Input
          id="lookup-code"
          size="large"
          autoComplete="off"
          spellCheck={false}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onPressEnter={go}
        />
        <Button size="large" type="primary" disabled={!valid} onClick={go}>
          Xem phiếu
        </Button>
      </div>
      {id && !valid && <div className="mt-1 text-xs text-red-600">Mã phiếu phải có dạng UUID.</div>}
    </Card>
  );
}
