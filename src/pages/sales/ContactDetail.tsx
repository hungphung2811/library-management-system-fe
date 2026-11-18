import { useState } from "react";
import { Link, useParams } from "react-router";
import { PERMISSIONS, apiFetch, can, toErrorInfo, useApi, useApiMutation, useSession } from "@/api";
import { Alert, App, Button, Card, ConfirmAction, QueryBoundary, Tag, describeError, formatDateTime, useDetailModal } from "@/ui";
import { SalesGate } from "./_components/SalesGate";
import {
  CONTACT_NEXT,
  CONTACT_NOTE,
  CONTACT_STATUS,
  CONTACT_STATUS_COLOR,
  CONTACT_TOPICS,
  type ContactDetail,
  type ContactFull,
  type ContactStatus,
} from "./_lib/contacts";
import { label } from "./_lib/sales";

export default function ContactDetailPage() {
  const { id = "" } = useParams();
  const query = useApi<ContactDetail>(`/api/sales/contact-requests/${encodeURIComponent(id)}`);
  return (
    <SalesGate title="Chi tiết liên hệ" description={CONTACT_NOTE} permission={PERMISSIONS.SALES_CONTACT_VIEW}>
      <QueryBoundary query={query}>{(c) => <View key={c.id} c={c} reload={() => void query.refetch()} />}</QueryBoundary>
    </SalesGate>
  );
}

function View({ c, reload }: { c: ContactDetail; reload: () => void }) {
  const s = useSession();
  const inModal = !!useDetailModal();
  const { message } = App.useApp();
  const base = `/api/sales/contact-requests/${encodeURIComponent(c.id)}` as const;
  const inv = { invalidate: ["/api/sales/contact-requests"] };
  const [full, setFull] = useState<ContactFull | null>(null);
  const [notice, setNotice] = useState<{ type: "error" | "warning"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const anonymized = c.piiAnonymizedAt != null;
  const targets = can(s, PERMISSIONS.SALES_CONTACT_STATUS) ? (CONTACT_NEXT[c.status] ?? []) : [];

  const changeStatus = useApiMutation(
    (status: ContactStatus) => apiFetch<ContactDetail>(`${base}/status`, { method: "PUT", json: { status, version: c.version } }),
    inv,
  );
  const anonymize = useApiMutation(() => apiFetch<ContactDetail>(`${base}/anonymization`, { method: "POST" }), inv);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setNotice(null);
    try {
      await fn();
      setFull(null);
      void message.success(ok);
    } catch (e) {
      const info = toErrorInfo(e);
      if (info.code === "SHOP_CONTACT_STATE_CONFLICT") {
        setNotice({ type: "warning", text: describeError(info).text });
        reload();
      } else setNotice({ type: "error", text: describeError(info).text });
    }
  };

  // Dữ liệu cá nhân đầy đủ chỉ giữ trong state của trang: không ghi log/console, không gửi sang nơi khác.
  const showFull = async () => {
    setBusy(true);
    setNotice(null);
    try {
      setFull(await apiFetch<ContactFull>(`${base}/contact`));
    } catch (e) {
      setNotice({ type: "error", text: describeError(toErrorInfo(e)).text });
    } finally {
      setBusy(false);
    }
  };

  const fullShown = full != null && !full.piiAnonymizedAt;
  const name = fullShown ? full.fullName : c.contact?.name;
  const email = fullShown ? full.email : c.contact?.email;
  const phone = fullShown ? full.phone : c.contact?.phone;

  return (
    <div className={inModal ? "flex flex-col gap-4" : "flex max-w-[900px] flex-col gap-4"}>
      {!inModal && <Link to="/sales/contacts">Quay lại danh sách</Link>}
      {notice && <Alert type={notice.type} showIcon title={notice.text} closable={{ onClose: () => setNotice(null) }} />}
      {anonymized && (
        <Alert type="info" showIcon data-testid="contact-anonymized" title={`Đã ẩn danh lúc ${formatDateTime(c.piiAnonymizedAt)}. Thông tin cá nhân và nội dung không còn.`} />
      )}
      <Card title="Yêu cầu">
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-muted">Chủ đề</dt>
          <dd className="m-0" data-testid="contact-topic">{label(CONTACT_TOPICS, c.topic)}</dd>
          <dt className="text-muted">Trạng thái</dt>
          <dd className="m-0">
            <Tag color={CONTACT_STATUS_COLOR[c.status]} data-testid="contact-status">{label(CONTACT_STATUS, c.status)}</Tag>
          </dd>
          <dt className="text-muted">Gửi lúc</dt>
          <dd className="m-0">{formatDateTime(c.createdAt)}</dd>
          <dt className="text-muted">Đóng lúc</dt>
          <dd className="m-0">{c.closedAt ? formatDateTime(c.closedAt) : "—"}</dd>
        </dl>
        <div className="mt-3 text-muted">Nội dung</div>
        {/* Văn bản thuần: nội suy của React, xuống dòng bằng CSS, không dùng innerHTML. */}
        <div className="mt-1 whitespace-pre-wrap break-words" data-testid="contact-message">
          {anonymized ? "Đã ẩn danh" : (c.message ?? "—")}
        </div>
      </Card>
      <Card title="Người liên hệ" data-testid="contact-person">
        {anonymized ? (
          <p className="m-0 text-muted">Đã ẩn danh.</p>
        ) : (
          <>
            <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              <dt className="text-muted">Họ tên</dt>
              <dd className="m-0" data-testid="contact-name">{name || "—"}</dd>
              <dt className="text-muted">Email</dt>
              <dd className="m-0" data-testid="contact-email">{email || "—"}</dd>
              <dt className="text-muted">Điện thoại</dt>
              <dd className="m-0" data-testid="contact-phone">{phone || "—"}</dd>
            </dl>
            {fullShown ? (
              <Alert
                className="mt-2"
                type="warning"
                showIcon
                data-testid="contact-pii-warning"
                title="Đây là dữ liệu cá nhân của khách. Chỉ dùng để liên hệ xử lý yêu cầu này, không sao chép hay chia sẻ ra ngoài."
              />
            ) : (
              <p className="mt-2 mb-0 text-xs text-muted">Thông tin đang được che một phần.</p>
            )}
            {!fullShown && can(s, PERMISSIONS.SALES_CONTACT_FULL) && (
              <Button className="mt-2" size="small" loading={busy} onClick={() => void showFull()}>
                Xem thông tin liên hệ đầy đủ
              </Button>
            )}
          </>
        )}
      </Card>
      {(targets.length > 0 || (!anonymized && can(s, PERMISSIONS.SALES_CONTACT_ANONYMIZE))) && (
        <Card title="Xử lý">
          <div className="flex flex-wrap items-center gap-2">
            {targets.map((t) => (
              <Button
                key={t}
                type={t === "CLOSED" ? "default" : "primary"}
                loading={changeStatus.isPending}
                onClick={() => void run(() => changeStatus.mutateAsync(t), "Đã đổi trạng thái.")}
              >
                {t === "IN_PROGRESS" ? "Bắt đầu xử lý" : "Đóng yêu cầu"}
              </Button>
            ))}
            {!anonymized && can(s, PERMISSIONS.SALES_CONTACT_ANONYMIZE) && (
              <ConfirmAction
                title="Ẩn danh yêu cầu này ngay?"
                description="Xóa họ tên, email, điện thoại và nội dung yêu cầu của khách. Không hoàn tác được."
                okText="Ẩn danh"
                danger
                onConfirm={() => run(() => anonymize.mutateAsync(), "Đã ẩn danh.")}
              >
                <Button danger>Ẩn danh ngay</Button>
              </ConfirmAction>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
