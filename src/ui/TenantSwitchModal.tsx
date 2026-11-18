import { useState } from "react";
import { toErrorInfo } from "@/api";
import { useAuth, type TenantSummary } from "@/auth/AuthProvider";
import { Alert, Modal, Radio } from "./antd";

export type { TenantSummary } from "@/auth/AuthProvider";

/** Hộp thoại chọn đơn vị làm việc. Thành công thì token mới thay token cũ, cache dữ liệu bị bỏ và trang được tải lại tại đúng đường dẫn hiện tại (quyền, menu và dữ liệu đổi theo đơn vị). */
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
  const { switchTenant } = useAuth();
  const [picked, setPicked] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!picked || loading) return;
    setLoading(true);
    setError(null);
    try {
      // reload: lưu token mới rồi tải lại trang (nút giữ trạng thái đang chạy tới lúc đó), không gọi lại API của đơn vị cũ.
      await switchTenant(picked, { reload: true });
      return;
    } catch (e) {
      const st = toErrorInfo(e);
      if (st.status === 401) {
        setLoading(false); // phiên hết hạn: ProtectedRoute đưa về /login
        return;
      }
      setError(
        st.status === 403
          ? "Bạn không có quyền ở đơn vị này."
          : st.code === "NETWORK"
            ? "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại."
            : "Không chuyển được đơn vị. Vui lòng thử lại.",
      );
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
              className="m-0! w-full rounded-control border border-line p-3"
            >
              <span className="font-medium text-ink">{t.name}</span>{" "}
              <span className="font-mono text-xs text-muted">{t.code}</span>
              {current && <span className="ml-2 text-xs text-primary">✓ Đang làm việc</span>}
            </Radio>
          );
        })}
      </Radio.Group>
    </Modal>
  );
}
