import { useState } from "react";
import { PERMISSIONS, apiFetch, can, useInvalidateApi, useSession } from "@/api";
import { Alert, Ban, Button, DataTable, Form, FormModal, InputNumber, KeyRound, PlusOutlined, RefreshCw, Tag, TriangleAlert, actionsColumn } from "@/ui";
import { CREDENTIAL_STATUS, REVOKE_REASON_LABELS, credentialState, type ApplicationDetail, type CreatedCredential, type CredentialView } from "../../_lib/applications";
import { SecretOnceModal, type OnceReveal } from "./SecretOnceModal";

const hintText = (c: Pick<CredentialView, "secretHint">) => `lms_sk_…${c.secretHint}`;

/**
 * Credential của Application INTEGRATION: tạo, xoay vòng, thu hồi, hiển thị secretHint.
 * Secret đầy đủ chỉ đi qua `apiFetch` trực tiếp (không useMutation/useApi, nên không vào react-query cache) rồi nằm trong state
 * `reveal` tới khi đóng hộp thoại.
 */
export function CredentialsPanel({ app }: { app: ApplicationDetail }) {
  const s = useSession();
  const invalidate = useInvalidateApi();
  const [reveal, setReveal] = useState<OnceReveal | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const base = `/api/applications/${encodeURIComponent(app.id)}` as const;
  const active = app.status === "ACTIVE";
  const canCreate = can(s, PERMISSIONS.APPLICATION_CREATE_CREDENTIAL) && active;
  const canRevoke = can(s, PERMISSIONS.APPLICATION_REVOKE_CREDENTIAL);
  const usable = app.credentials.filter((c) => c.usable).length;

  const issue = async (expiresInDays: number | undefined, note?: string) => {
    const c = await apiFetch<CreatedCredential>(`${base}/credentials`, { method: "POST", json: expiresInDays ? { expiresInDays } : {} });
    setReveal({
      title: "Credential mới",
      note,
      expiresAt: c.expiresAt,
      items: [
        { label: "client_id", value: c.clientId },
        { label: "client_secret", value: c.clientSecret, secret: true },
      ],
    });
    await invalidate("/api/applications");
  };

  const revoke = async (c: CredentialView, reason: "MANUAL" | "COMPROMISED") => {
    await apiFetch<CredentialView>(`${base}/credentials/${encodeURIComponent(c.id)}/revocation`, { method: "POST", json: { reason } });
    await invalidate("/api/applications");
  };

  return (
    <div className="flex flex-col gap-3" data-testid="credentials-panel">
      <Alert
        type="info"
        showIcon
        title="Tối đa 2 credential dùng được cùng lúc. Xoay vòng: tạo credential mới, đổi phía backend của bạn, rồi thu hồi credential cũ."
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-muted" data-testid="credential-usage">
          Đang dùng được {usable}/2
        </span>
        {canCreate && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            Tạo credential
          </Button>
        )}
      </div>
      <DataTable
        rowKey="id"
        mobileTitleKey="secretHint"
        rows={app.credentials.map((c) => ({ ...c }))}
        columns={[
          { key: "secretHint", title: "Secret (4 ký tự cuối)", dataIndex: "secretHint", render: (_v, row) => <span className="font-mono">{hintText(row as unknown as CredentialView)}</span> },
          {
            key: "status",
            title: "Trạng thái",
            dataIndex: "status",
            render: (_v, row) => {
              const m = CREDENTIAL_STATUS[credentialState(row as unknown as CredentialView)];
              return (
                <Tag dot color={m.color}>
                  {m.label}
                </Tag>
              );
            },
          },
          { key: "createdAt", title: "Tạo lúc", dataIndex: "createdAt", kind: "datetime" },
          { key: "expiresAt", title: "Hết hạn", dataIndex: "expiresAt", kind: "datetime" },
          { key: "lastUsedAt", title: "Dùng gần nhất", dataIndex: "lastUsedAt", kind: "datetime" },
          {
            key: "revokedAt",
            title: "Thu hồi",
            dataIndex: "revokedAt",
            render: (v, row) =>
              v ? `${new Date(String(v)).toLocaleString("vi-VN")} (${REVOKE_REASON_LABELS[String(row.revokeReason)] ?? String(row.revokeReason ?? "")})` : "—",
          },
          actionsColumn((row) => {
            const c = row as unknown as CredentialView;
            const live = c.status === "ACTIVE";
            return [
              {
                key: "rotate",
                label: `Xoay vòng credential ${hintText(c)}`,
                icon: <RefreshCw size={16} />,
                hidden: !canCreate || !c.usable,
                confirm: {
                  title: "Xoay vòng credential này?",
                  description: `Tạo một credential mới. Sau khi backend đã đổi sang credential mới, hãy thu hồi credential ${hintText(c)}.`,
                  okText: "Tạo credential mới",
                },
                onClick: () => issue(undefined, `Đã tạo credential mới để thay ${hintText(c)}. Cập nhật backend rồi thu hồi credential cũ.`),
              },
              {
                key: "revoke",
                label: `Thu hồi credential ${hintText(c)}`,
                icon: <Ban size={16} />,
                danger: true,
                hidden: !canRevoke || !live,
                confirm: { title: "Thu hồi credential này?", description: "Backend đang dùng nó sẽ không xin được token nữa. Không hoàn tác được.", okText: "Thu hồi" },
                onClick: () => revoke(c, "MANUAL"),
              },
              {
                key: "compromised",
                label: `Thu hồi credential ${hintText(c)} do nghi bị lộ`,
                icon: <TriangleAlert size={16} />,
                danger: true,
                hidden: !canRevoke || !live,
                confirm: { title: "Thu hồi vì nghi bị lộ?", description: "Ghi lý do COMPROMISED vào lịch sử. Không hoàn tác được.", okText: "Thu hồi" },
                onClick: () => revoke(c, "COMPROMISED"),
              },
            ];
          }, 3),
        ]}
        empty={{ title: "Ứng dụng chưa có credential nào.", hint: canCreate ? "Bấm “Tạo credential” để lấy client_id và client_secret." : undefined }}
      />
      <FormModal<{ expiresInDays?: number | null }>
        open={createOpen}
        title={
          <span className="inline-flex items-center gap-2">
            <KeyRound size={18} /> Tạo credential
          </span>
        }
        okText="Tạo credential"
        onCancel={() => setCreateOpen(false)}
        onSubmit={(v) => issue(v.expiresInDays ?? undefined)}
        initialValues={{ expiresInDays: null }}
      >
        <Form.Item
          name="expiresInDays"
          label="Hạn dùng (ngày)"
          extra="Để trống để dùng mặc định 365 ngày. Tối đa 730 ngày."
          rules={[{ type: "number", min: 1, max: 730, message: "Nhập số ngày từ 1 đến 730" }]}
        >
          <InputNumber className="w-full" min={1} max={730} precision={0} />
        </Form.Item>
      </FormModal>
      <SecretOnceModal reveal={reveal} onClose={() => setReveal(null)} />
    </div>
  );
}
