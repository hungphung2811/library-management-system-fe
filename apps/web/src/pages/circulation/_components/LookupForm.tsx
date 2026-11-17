import { useState } from "react";
import { useNavigate } from "react-router";
import { Button, Card, Input } from "@/ui";
import { UUID_RE } from "../_lib/circulation";

/** Tra phiếu mượn theo mã (UUID) rồi chuyển tới trang chi tiết. */
export function LookupForm() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const id = code.trim();
  const valid = UUID_RE.test(id);
  const go = () => valid && void navigate(`/circulation/borrowings/${encodeURIComponent(id)}`);

  return (
    <Card title="Tra phiếu mượn theo mã" className="max-w-[720px]">
      <label htmlFor="lookup-code" className="mb-1 block text-sm font-medium text-ink">
        Mã phiếu mượn (UUID)
      </label>
      <div className="flex gap-2">
        <Input
          id="lookup-code"
          autoComplete="off"
          spellCheck={false}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onPressEnter={go}
        />
        <Button type="primary" disabled={!valid} onClick={go}>
          Xem phiếu
        </Button>
      </div>
      {id && !valid && <div className="mt-1 text-xs text-red-600">Mã phiếu phải có dạng UUID.</div>}
    </Card>
  );
}
