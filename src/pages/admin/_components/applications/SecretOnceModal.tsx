import { useState } from "react";
import { Alert, App, Button, Copy, Modal, Text } from "@/ui";

/** Thông tin chỉ hiện một lần. `value` là chuỗi nhạy cảm (client_secret): chỉ nằm trong state cục bộ của nơi gọi, không vào cache/URL/storage. */
export type OnceReveal = {
  title: string;
  /** Câu dẫn dưới cảnh báo (ví dụ nhắc thu hồi credential cũ sau khi xoay vòng). */
  note?: string;
  items: { label: string; value: string; secret?: boolean }[];
  expiresAt?: string | null;
};

/**
 * Hộp thoại hiện client_id + client_secret (hoặc khóa khác) MỘT LẦN. Đóng chỉ bằng nút "Tôi đã lưu, đóng" (không đóng bằng mask/Esc
 * khi chưa chủ ý); khi đóng, nơi gọi đặt state về null nên giá trị biến mất khỏi DOM và bộ nhớ React.
 */
export function SecretOnceModal({ reveal, onClose }: { reveal: OnceReveal | null; onClose: () => void }) {
  return (
    <Modal
      open={reveal !== null}
      centered
      width={640}
      title={reveal?.title ?? ""}
      onCancel={onClose}
      mask={{ closable: false }}
      keyboard={false}
      destroyOnHidden
      footer={
        <Button type="primary" onClick={onClose}>
          Tôi đã lưu, đóng
        </Button>
      }
    >
      {reveal && <Body reveal={reveal} />}
    </Modal>
  );
}

function Body({ reveal }: { reveal: OnceReveal }) {
  return (
    <div className="flex flex-col gap-3" data-testid="secret-once">
      <Alert
        type="warning"
        showIcon
        data-testid="secret-once-warning"
        title="Chỉ hiện một lần"
        description="Hệ thống chỉ lưu bản băm nên không xem lại được. Hãy sao chép và lưu ở nơi bí mật (biến môi trường, kho khóa) phía backend. Đóng hộp thoại này là mất."
      />
      {reveal.note && <p className="m-0 text-sm text-muted">{reveal.note}</p>}
      {reveal.items.map((it) => (
        <CopyRow key={it.label} {...it} />
      ))}
      {reveal.expiresAt && <Text type="secondary">Hết hạn: {new Date(reveal.expiresAt).toLocaleString("vi-VN")}</Text>}
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string; secret?: boolean }) {
  const { message } = App.useApp();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      message.success(`Đã sao chép ${label}`);
    } catch {
      message.error("Không sao chép được. Hãy chọn và sao chép thủ công.");
    }
  };
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-start gap-2">
        <code className="min-w-0 flex-1 rounded-control border border-line bg-subtle px-2 py-1.5 font-mono text-sm break-all select-all" data-testid={`once-${label}`}>
          {value}
        </code>
        <Button icon={<Copy size={16} />} aria-label={`Sao chép ${label}`} onClick={() => void copy()}>
          {copied ? "Đã chép" : "Sao chép"}
        </Button>
      </div>
    </div>
  );
}
