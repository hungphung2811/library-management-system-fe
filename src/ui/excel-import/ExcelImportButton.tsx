import { useState } from "react";
import { can, useSession } from "@/api";
import { Button } from "../antd";
import { ExcelImportModal } from "./ExcelImportModal";
import type { ExcelImportConfig } from "./types";

/**
 * Nút "Nhập Excel" cho thanh thao tác của trang. Tự ẩn khi người dùng thiếu khóa tải lên hoặc xác nhận
 * (BE vẫn kiểm lại; kiểm module do trang gọi đảm nhiệm như các nút khác của trang). Hộp thoại gỡ khỏi cây khi đóng nên mỗi lần mở là phiên mới.
 */
export function ExcelImportButton({ cfg }: { cfg: ExcelImportConfig }) {
  const s = useSession();
  const [open, setOpen] = useState(false);
  if (!can(s, cfg.uploadKey) || !can(s, cfg.confirmKey)) return null;
  return (
    <>
      <Button onClick={() => setOpen(true)}>Nhập Excel</Button>
      {open && <ExcelImportModal cfg={cfg} onClosed={() => setOpen(false)} />}
    </>
  );
}
