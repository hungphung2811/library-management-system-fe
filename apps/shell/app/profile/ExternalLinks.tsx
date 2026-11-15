"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { bffFetch } from "@mfe/api/client";
import { App, Button, ConfirmAction, Tag, formatDateTime } from "@mfe/ui";

export type ExternalProvider = { name: string; displayName: string };
export type ExternalLogin = { provider: string; email?: string | null; linkedAt?: string | null; lastUsedAt?: string | null };

/**
 * Thẻ "Đăng nhập bằng tài khoản ngoài": xem trạng thái liên kết và hủy liên kết.
 * Nút "Liên kết" cố ý không có: luồng OIDC cần cookie `lms_ext` mà BFF không chuyển tiếp (xem shared-design Q3c).
 */
export function ExternalLinks({ providers, links }: { providers: ExternalProvider[]; links: ExternalLogin[] }) {
  const router = useRouter();
  const { message } = App.useApp();
  // Hủy xong thì ẩn ngay, không chờ router.refresh() tải lại dữ liệu server.
  const [removed, setRemoved] = useState<string[]>([]);

  // Provider đã liên kết nhưng không còn trong danh sách provider của BE vẫn phải hiện để hủy được.
  const names = [...providers.map((p) => p.name), ...links.map((l) => l.provider).filter((n) => !providers.some((p) => p.name === n))];
  const label = (name: string) => providers.find((p) => p.name === name)?.displayName ?? name;

  async function unlink(provider: string) {
    await bffFetch(`/api/auth/me/external/${encodeURIComponent(provider)}`, { method: "DELETE" });
    setRemoved((r) => [...r, provider]);
    message.success(`Đã hủy liên kết với ${label(provider)}.`);
    router.refresh();
  }

  return (
    <ul className="m-0 list-none divide-y divide-line p-0">
      {names.map((name) => {
        const link = removed.includes(name) ? undefined : links.find((l) => l.provider === name);
        return (
          <li key={name} data-testid={`external-${name}`} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-ink">{label(name)}</span>
                {link ? <Tag color="success">Đã liên kết</Tag> : <Tag>Chưa liên kết</Tag>}
              </div>
              {link && (
                <div className="mt-1 text-sm text-muted">
                  {link.email ? <span>{link.email}</span> : null}
                  {link.linkedAt ? <span>{link.email ? " · " : ""}Liên kết lúc {formatDateTime(link.linkedAt)}</span> : null}
                  {link.lastUsedAt ? <span> · Dùng gần nhất {formatDateTime(link.lastUsedAt)}</span> : null}
                </div>
              )}
            </div>
            {link && (
              <ConfirmAction
                title={`Hủy liên kết với «${label(name)}»?`}
                description="Bạn vẫn đăng nhập được bằng mật khẩu. Nếu đây là cách đăng nhập duy nhất, bạn có thể không vào được nữa."
                okText="Hủy liên kết"
                cancelText="Giữ lại"
                danger
                onConfirm={() => unlink(name)}
              >
                <Button danger aria-label={`Hủy liên kết ${label(name)}`}>
                  Hủy liên kết
                </Button>
              </ConfirmAction>
            )}
          </li>
        );
      })}
    </ul>
  );
}
