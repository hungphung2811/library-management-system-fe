"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { bffFetch, type ErrorInfo } from "@mfe/api/client";
import {
  Alert,
  Button,
  ConfirmAction,
  DatePicker,
  Empty,
  ErrorPanel,
  Form,
  FormModal,
  Input,
  KeyValueList,
  Select,
  StatusTag,
  Tag,
  App,
  dayjs,
  formatDate,
} from "@mfe/ui";
import { READER_TYPES, readerTypeLabel, type ReaderProfileView, type UserView } from "../../types";

const DATE_FORMAT = "DD/MM/YYYY";
// Hạn thẻ phải sau hôm nay (chặn ngày quá khứ phía client; BE vẫn là nơi quyết định).
const disablePast = (d: dayjs.Dayjs) => d.isBefore(dayjs().endOf("day"));

/** Tab "Hồ sơ độc giả": xem, cấp thẻ, gia hạn thẻ, khóa/mở khóa. */
export function ReaderTab({
  user,
  canView,
  data,
  error,
  canIssue,
  canRenew,
  canStatus,
}: {
  user: UserView;
  canView: boolean;
  data: ReaderProfileView | null;
  error: ErrorInfo | null;
  canIssue: boolean;
  canRenew: boolean;
  canStatus: boolean;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [issuing, setIssuing] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const base = `/api/users/${encodeURIComponent(user.id)}/reader-profile` as const;

  if (!canView) return <Alert type="info" showIcon title="Bạn không có quyền xem hồ sơ độc giả." />;
  if (error) return <ErrorPanel error={error} />;

  if (!data) {
    return (
      <>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Người này chưa có thẻ độc giả."
        >
          {canIssue && (
            <Button type="primary" onClick={() => setIssuing(true)}>
              Cấp thẻ độc giả
            </Button>
          )}
        </Empty>
        <FormModal<{ cardNo: string; fullName: string; email: string; readerType: string; cardExpiryDate: dayjs.Dayjs }>
          open={issuing}
          title="Cấp thẻ độc giả"
          okText="Cấp thẻ"
          successMessage="Đã cấp thẻ độc giả."
          onCancel={() => setIssuing(false)}
          initialValues={{ fullName: user.fullName, email: user.email }}
          onSubmit={async (v) => {
            await bffFetch(base, {
              method: "POST",
              json: {
                cardNo: v.cardNo,
                fullName: v.fullName,
                email: v.email,
                readerType: v.readerType,
                cardExpiryDate: v.cardExpiryDate.format("YYYY-MM-DD"),
              },
            });
            router.refresh();
          }}
        >
          <Form.Item
            name="cardNo"
            label="Số thẻ"
            rules={[{ required: true, message: "Nhập số thẻ" }, { max: 32, message: "Tối đa 32 ký tự" }]}
          >
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item
            name="fullName"
            label="Họ tên trên thẻ"
            rules={[{ required: true, message: "Nhập họ tên" }, { max: 255, message: "Tối đa 255 ký tự" }]}
          >
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item
            name="email"
            label="Email"
            rules={[{ required: true, message: "Nhập email" }, { type: "email", message: "Email chưa đúng định dạng" }]}
          >
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item name="readerType" label="Loại độc giả" rules={[{ required: true, message: "Chọn loại độc giả" }]}>
            <Select options={READER_TYPES} placeholder="Chọn loại độc giả" />
          </Form.Item>
          <Form.Item name="cardExpiryDate" label="Hạn thẻ" rules={[{ required: true, message: "Chọn hạn thẻ" }]}>
            <DatePicker className="w-full" format={DATE_FORMAT} disabledDate={disablePast} />
          </Form.Item>
        </FormModal>
      </>
    );
  }

  const locked = data.status === "LOCKED";
  const setStatus = async () => {
    await bffFetch(`${base}/status`, { method: "PUT", json: { status: locked ? "ACTIVE" : "LOCKED" } });
    message.success(locked ? "Đã mở khóa thẻ." : "Đã khóa thẻ.");
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-4">
      <KeyValueList
        columns={2}
        items={[
          { label: "Số thẻ", value: data.cardNo, mono: true },
          { label: "Họ tên trên thẻ", value: data.fullName },
          { label: "Email", value: data.email },
          { label: "Loại độc giả", value: <Tag>{readerTypeLabel(data.readerType)}</Tag> },
          {
            label: "Hạn thẻ",
            value: <span className={!data.cardValid && !locked ? "text-red-600" : undefined}>{formatDate(data.cardExpiryDate)}</span>,
          },
          { label: "Trạng thái", value: <StatusTag domain="reader" value={data.status} /> },
          {
            label: "Thẻ còn hiệu lực",
            value: data.cardValid ? (
              <Tag color="success">Hợp lệ</Tag>
            ) : (
              <Tag color="error">{locked ? "Không hợp lệ: thẻ bị khóa" : "Không hợp lệ: thẻ đã hết hạn"}</Tag>
            ),
          },
        ]}
      />
      <div className="flex flex-wrap gap-2">
        {canRenew && <Button onClick={() => setRenewing(true)}>Gia hạn thẻ</Button>}
        {canStatus && (
          <ConfirmAction
            danger={!locked}
            title={locked ? "Mở khóa thẻ?" : "Khóa thẻ?"}
            description={locked ? undefined : "Độc giả sẽ không mượn được sách cho đến khi mở khóa."}
            okText={locked ? "Mở khóa" : "Khóa thẻ"}
            onConfirm={setStatus}
          >
            <Button danger={!locked}>{locked ? "Mở khóa thẻ" : "Khóa thẻ"}</Button>
          </ConfirmAction>
        )}
      </div>

      <FormModal<{ newExpiryDate: dayjs.Dayjs }>
        open={renewing}
        title="Gia hạn thẻ"
        okText="Gia hạn"
        successMessage="Đã gia hạn thẻ."
        onCancel={() => setRenewing(false)}
        onSubmit={async (v) => {
          await bffFetch(`${base}/card-expiry`, { method: "PUT", json: { newExpiryDate: v.newExpiryDate.format("YYYY-MM-DD") } });
          router.refresh();
        }}
      >
        <Form.Item
          name="newExpiryDate"
          label="Ngày hết hạn mới"
          extra={`Hạn hiện tại: ${formatDate(data.cardExpiryDate)}. Phải sau hạn hiện tại và sau hôm nay.`}
          rules={[
            { required: true, message: "Chọn ngày hết hạn mới" },
            {
              validator: async (_, v: dayjs.Dayjs | undefined) => {
                if (v && !v.isAfter(dayjs(data.cardExpiryDate), "day")) throw new Error("Ngày mới phải sau hạn hiện tại");
              },
            },
          ]}
        >
          <DatePicker className="w-full" format={DATE_FORMAT} disabledDate={disablePast} />
        </Form.Item>
      </FormModal>
    </div>
  );
}
