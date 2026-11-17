"use client";
import { useState } from "react";
import { refreshSession } from "@mfe/api/client";
import { Alert, Modal, Radio } from "./antd";

export type TenantSummary = { id: string; code: string; name: string };

export async function postSwitch(tenantId: string) {
  const call = () =>
    fetch("/api/session/switch-tenant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId }),
    });
  let res = await call();
  if (res.status === 401 && (await refreshSession())) res = await call();
  return res;
}

/** Hộp thoại chọn đơn vị làm việc. Thành công thì tải lại toàn trang về `/?switched=1` (quyền và dữ liệu đổi theo đơn vị). */
export function TenantSwitchModal({
  open,
  tenants,
  currentTenantId,
  onClose,
}: {
  open: boolean;
  tenants: TenantSummary[];
  currentTenantId?: string;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!picked || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await postSwitch(picked);
      if (res.ok) {
        location.assign("/?switched=1");
        return;
      }
      if (res.status === 401) {
        location.assign("/login?next=" + encodeURIComponent(location.pathname + location.search));
        return;
      }
      setError(res.status === 403 ? "Bạn không có quyền ở đơn vị này." : "Không chuyển được đơn vị. Vui lòng thử lại.");
    } catch {
      setError("Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.");
    }
    setLoading(false);
  };

  return (
    <Modal
      open={open}
      title="Chọn đơn vị làm việc"
      okText="Chuyển"
      cancelText="Hủy"
      onOk={submit}
      onCancel={loading ? undefined : onClose}
      confirmLoading={loading}
      okButtonProps={{ disabled: !picked }}
      closable={!loading}
      keyboard={!loading}
      mask={{ closable: false }}
      destroyOnHidden
      afterClose={() => {
        setPicked(undefined);
        setError(null);
      }}
    >
      {error && <Alert type="error" showIcon className="mb-3" title={error} />}
      <Radio.Group
        value={picked ?? currentTenantId}
        onChange={(e) => setPicked(e.target.value as string)}
        className="flex! flex-col gap-2"
        aria-label="Đơn vị"
      >
        {tenants.map((t) => {
          const current = t.id === currentTenantId;
          return (
            <Radio
              key={t.id}
              value={t.id}
              disabled={current}
              className="m-0! w-full rounded-lg border border-line p-3"
            >
              <span className="font-medium text-ink">{t.name}</span>{" "}
              <span className="font-mono text-xs text-muted">{t.code}</span>
              {current && <span className="ml-2 text-xs text-brand-600">✓ Đang làm việc</span>}
            </Radio>
          );
        })}
      </Radio.Group>
    </Modal>
  );
}
