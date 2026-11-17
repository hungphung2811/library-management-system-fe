import { useState } from "react";
import { apiDownload, saveBlob, toErrorInfo } from "@/api";
import { App, Button, describeError } from "@/ui";

/** Xuất CSV người dùng theo bộ lọc hiện tại (keyword, departmentId, status). */
export function ExportUsersButton({ filters }: { filters: { keyword?: string; departmentId?: string; status?: string } }) {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);

  const onClick = async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (filters.keyword) p.set("keyword", filters.keyword);
      if (filters.departmentId) p.set("departmentId", filters.departmentId);
      if (filters.status) p.set("status", filters.status);
      const qs = p.toString();
      const { blob, filename } = await apiDownload(`/api/users/export${qs ? `?${qs}` : ""}`);
      saveBlob(blob, filename ?? "users.csv");
    } catch (e) {
      message.error(describeError(toErrorInfo(e)).text);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={() => void onClick()} loading={loading}>
      Xuất CSV
    </Button>
  );
}
