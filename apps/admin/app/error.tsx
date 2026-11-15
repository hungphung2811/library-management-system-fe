"use client";
import { Button, Result } from "@mfe/ui";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return <Result status="500" title="Đã có lỗi xảy ra" extra={<Button onClick={reset}>Thử lại</Button>} />;
}
