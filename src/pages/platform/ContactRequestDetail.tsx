import { useState } from "react";
import { Link, useParams } from "react-router";
import { apiFetch, toErrorInfo, useApi, useApiMutation } from "@/api";
import {
  Alert,
  App,
  Breadcrumb,
  Button,
  Card,
  ConfirmAction,
  Eye,
  EyeOff,
  KeyValueList,
  PageHeader,
  QueryBoundary,
  Select,
  StatusTag,
  describeError,
  formatDateTime,
} from "@/ui";
import { PlatformGate } from "./_components/PlatformGate";
import {
  BUSINESS_LABELS,
  CONTACT_STATUS_OPTIONS,
  CONTACT_TRANSITIONS,
  PLATFORM_ERRORS,
  maskEmail,
  maskPhone,
} from "./_lib/format";
import type { ContactRequest, ContactStatus } from "./_lib/types";

export default function ContactRequestDetailPage() {
  return (
    <PlatformGate>
      <Detail />
    </PlatformGate>
  );
}

function Detail() {
  const { id = "" } = useParams();
  const query = useApi<ContactRequest>(`/api/cms/contact-requests/${encodeURIComponent(id)}`);
  return (
    <QueryBoundary query={query} errorMessages={PLATFORM_ERRORS}>
      {(r) => <View key={r.id} r={r} reload={() => void query.refetch()} />}
    </QueryBoundary>
  );
}

/** Dữ liệu cá nhân chỉ hiện đầy đủ khi người dùng bấm "Hiện"; không ghi log hay gửi sang công cụ phân tích. Mọi chuỗi hiển thị bằng text (React escape). */
function View({ r, reload }: { r: ContactRequest; reload: () => void }) {
  const { message } = App.useApp();
  const [reveal, setReveal] = useState(false);
  const [next, setNext] = useState<ContactStatus | undefined>();
  const [notice, setNotice] = useState<{ type: "error" | "warning"; text: string } | null>(null);
  const base = `/api/cms/contact-requests/${encodeURIComponent(r.id)}` as const;
  const inv = { invalidate: ["/api/cms/contact-requests"] };

  const changeStatus = useApiMutation(
    (status: ContactStatus) => apiFetch<ContactRequest>(`${base}/status`, { method: "PUT", json: { status, version: r.version } }),
    inv,
  );
  const anonymize = useApiMutation(() => apiFetch<ContactRequest>(`${base}/anonymization`, { method: "POST" }), inv);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setNotice(null);
    try {
      await fn();
      setNext(undefined);
      setReveal(false);
      void message.success(ok);
    } catch (e) {
      const info = toErrorInfo(e);
      setNotice({ type: "error", text: describeError(info, PLATFORM_ERRORS).text });
      // Lệch phiên bản hoặc trạng thái đã khác: tải lại bản mới để người dùng thử lại.
      if (info.code === "CONTACT_REQUEST_VERSION_CONFLICT" || info.code === "CONTACT_STATUS_TRANSITION_INVALID") {
        setNotice({ type: "warning", text: describeError(info, PLATFORM_ERRORS).text });
        reload();
      }
    }
  };

  const anonymized = r.anonymizedAt != null;
  const targets = CONTACT_STATUS_OPTIONS.filter((o) => CONTACT_TRANSITIONS[r.status]?.includes(o.value));
  const personal = (v: string | null, masked: string) => (anonymized ? "Đã ẩn danh" : reveal ? v : masked);

  return (
    <div className="flex max-w-[900px] flex-col gap-4">
      <Breadcrumb items={[{ title: <Link to="/platform/contact-requests">Yêu cầu liên hệ</Link> }, { title: r.organization ?? "Chi tiết" }]} />
      <PageHeader
        title={r.organization ?? "Yêu cầu liên hệ"}
        description={<StatusTag domain="contact" value={r.status} />}
        actions={
          anonymized ? undefined : (
            <>
              <Button icon={reveal ? <EyeOff size={14} /> : <Eye size={14} />} onClick={() => setReveal((v) => !v)}>
                {reveal ? "Che thông tin cá nhân" : "Hiện thông tin cá nhân"}
              </Button>
              <ConfirmAction
                title="Ẩn danh yêu cầu này?"
                description="Xóa họ tên, email, điện thoại và lời nhắn. Không hoàn tác được."
                okText="Ẩn danh"
                danger
                onConfirm={() => run(() => anonymize.mutateAsync(), "Đã ẩn danh.")}
              >
                <Button danger>Ẩn danh ngay</Button>
              </ConfirmAction>
            </>
          )
        }
      />
      {notice && <Alert type={notice.type} showIcon title={notice.text} closable={{ onClose: () => setNotice(null) }} />}
      {anonymized && <Alert type="info" showIcon title={`Đã ẩn danh lúc ${formatDateTime(r.anonymizedAt)}. Thông tin cá nhân không còn.`} />}
      <Card title="Người gửi">
        <KeyValueList
          columns={2}
          items={[
            { label: "Họ tên", value: anonymized ? "Đã ẩn danh" : r.fullName },
            { label: "Email", value: personal(r.email, maskEmail(r.email)) },
            { label: "Điện thoại", value: personal(r.phone, maskPhone(r.phone)) },
            { label: "Đơn vị", value: r.organization },
            { label: "Loại hình", value: BUSINESS_LABELS[r.businessType] ?? r.businessType },
            { label: "Gửi lúc", value: formatDateTime(r.createdAt) },
            { label: "Đồng ý xử lý dữ liệu lúc", value: r.consentAt ? formatDateTime(r.consentAt) : null },
          ]}
        />
        <div className="mt-2 text-muted">Lời nhắn</div>
        {/* Văn bản thuần: hiển thị bằng nội suy của React, xuống dòng bằng CSS, không dùng innerHTML. */}
        <div className="mt-1 whitespace-pre-wrap break-words" data-testid="contact-message">
          {anonymized ? "Đã ẩn danh" : reveal ? (r.message ?? "—") : r.message ? "••• (bấm «Hiện thông tin cá nhân» để xem)" : "—"}
        </div>
      </Card>
      <Card title="Xử lý">
        <KeyValueList
          columns={2}
          items={[
            { label: "Trạng thái", value: <StatusTag domain="contact" value={r.status} /> },
            { label: "Người xử lý", value: r.handledBy },
            { label: "Xử lý lúc", value: r.handledAt ? formatDateTime(r.handledAt) : null },
            { label: "Phiên bản", value: String(r.version), mono: true },
          ]}
        />
        {!anonymized && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Select
              aria-label="Trạng thái mới"
              className="min-w-48"
              placeholder="Chuyển sang trạng thái"
              value={next}
              options={targets}
              onChange={(v) => setNext(v)}
            />
            <Button type="primary" disabled={!next} loading={changeStatus.isPending} onClick={() => next && void run(() => changeStatus.mutateAsync(next), "Đã đổi trạng thái.")}>
              Đổi trạng thái
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
