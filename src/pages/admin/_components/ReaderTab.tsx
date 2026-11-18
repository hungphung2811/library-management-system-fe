import { apiFetch, useApiMutation, type ErrorInfo } from "@/api";
import {
  Alert,
  CommonPersonalFields,
  EditOutlined,
  FormSection,
  KEEP_NOTE,
  blankToUndefined,
  dateToIso,
  dobText,
  genderLabel,
  isoToDate,
  presentItems,
  App,
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
  Skeleton,
  StatusTag,
  Tag,
  dayjs,
  formatDate,
  useFormModal,
} from "@/ui";
import { READER_TYPES, readerTypeLabel, type Gender, type ReaderProfileView, type UserView } from "../_lib/types";

const DATE_FORMAT = "DD/MM/YYYY";
// Hạn thẻ phải sau hôm nay (chặn ngày quá khứ phía client; BE vẫn là nơi quyết định).
const disablePast = (d: dayjs.Dayjs) => d.isBefore(dayjs().endOf("day"));

type PersonalValues = {
  phone?: string;
  dateOfBirth?: dayjs.Dayjs;
  gender?: Gender;
  address?: string;
  faculty?: string;
  className?: string;
  memberCode?: string;
  cardIssuedDate?: dayjs.Dayjs;
};
type IssueValues = PersonalValues & { cardNo: string; fullName: string; email: string; readerType: string; cardExpiryDate: dayjs.Dayjs };

const personalPayload = (v: PersonalValues) => ({
  phone: blankToUndefined(v.phone),
  dateOfBirth: dateToIso(v.dateOfBirth),
  gender: v.gender || undefined,
  address: blankToUndefined(v.address),
  faculty: blankToUndefined(v.faculty),
  className: blankToUndefined(v.className),
  memberCode: blankToUndefined(v.memberCode),
  cardIssuedDate: dateToIso(v.cardIssuedDate),
});

/** Nhóm field cá nhân + học vụ của hồ sơ độc giả; `expiry` để kiểm ngày cấp không sau hạn thẻ. */
function ReaderPersonalFields({ getExpiry, note }: { getExpiry: () => dayjs.Dayjs | undefined; note: string }) {
  return (
    <>
      <FormSection title="Thông tin cá nhân" note={note} />
      <CommonPersonalFields />
      <Form.Item name="faculty" label="Khoa / đơn vị" rules={[{ max: 150, message: "Tối đa 150 ký tự" }]}>
        <Input autoComplete="off" />
      </Form.Item>
      <Form.Item name="className" label="Lớp / ngành" rules={[{ max: 50, message: "Tối đa 50 ký tự" }]}>
        <Input autoComplete="off" />
      </Form.Item>
      <Form.Item name="memberCode" label="Mã sinh viên / mã cán bộ" rules={[{ max: 32, message: "Tối đa 32 ký tự" }]}>
        <Input autoComplete="off" />
      </Form.Item>
      <Form.Item
        name="cardIssuedDate"
        label="Ngày cấp thẻ"
        rules={[
          {
            validator: async (_, v: dayjs.Dayjs | undefined) => {
              const exp = getExpiry();
              if (v && exp && v.isAfter(exp, "day")) throw new Error("Ngày cấp không được sau hạn thẻ");
            },
          },
        ]}
      >
        <DatePicker className="w-full" format={DATE_FORMAT} />
      </Form.Item>
    </>
  );
}

/** Tab "Hồ sơ độc giả": xem, cấp thẻ, gia hạn thẻ, khóa/mở khóa. */
export function ReaderTab({
  user,
  canView,
  loading,
  data,
  error,
  canIssue,
  canRenew,
  canStatus,
  canUpdate = false,
}: {
  user: UserView;
  canView: boolean;
  loading: boolean;
  data: ReaderProfileView | null;
  error: ErrorInfo | null;
  canIssue: boolean;
  canRenew: boolean;
  canStatus: boolean;
  canUpdate?: boolean;
}) {
  const { message } = App.useApp();
  const base = `/api/users/${encodeURIComponent(user.id)}/reader-profile` as const;

  const issue = useFormModal<IssueValues>({
    title: "Cấp thẻ độc giả",
    okText: "Cấp thẻ",
    successMessage: "Đã cấp thẻ độc giả.",
    invalidate: ["/api/users"],
    initialValues: {
      fullName: user.fullName,
      email: user.email,
      phone: user.phone ?? undefined,
      dateOfBirth: isoToDate(user.dateOfBirth),
      gender: user.gender ?? undefined,
      address: user.address ?? undefined,
      memberCode: user.employeeCode ?? undefined,
    },
    request: (v) =>
      apiFetch(base, {
        method: "POST",
        json: {
          cardNo: v.cardNo,
          fullName: v.fullName,
          email: v.email,
          readerType: v.readerType,
          cardExpiryDate: v.cardExpiryDate.format("YYYY-MM-DD"),
          ...personalPayload(v),
        },
      }),
  });
  const edit = useFormModal<PersonalValues>({
    title: "Sửa hồ sơ độc giả",
    okText: "Lưu",
    successMessage: "Đã cập nhật hồ sơ độc giả.",
    invalidate: ["/api/users"],
    initialValues: () => ({
      phone: data?.phone ?? undefined,
      dateOfBirth: isoToDate(data?.dateOfBirth),
      gender: data?.gender ?? undefined,
      address: data?.address ?? undefined,
      faculty: data?.faculty ?? undefined,
      className: data?.className ?? undefined,
      memberCode: data?.memberCode ?? undefined,
      cardIssuedDate: isoToDate(data?.cardIssuedDate),
    }),
    request: (v) => apiFetch(base, { method: "PUT", json: personalPayload(v) }),
  });
  const renew = useFormModal<{ newExpiryDate: dayjs.Dayjs }>({
    title: "Gia hạn thẻ",
    okText: "Gia hạn",
    successMessage: "Đã gia hạn thẻ.",
    invalidate: ["/api/users"],
    request: (v) => apiFetch(`${base}/card-expiry`, { method: "PUT", json: { newExpiryDate: v.newExpiryDate.format("YYYY-MM-DD") } }),
  });
  const changeStatus = useApiMutation(
    (status: "ACTIVE" | "LOCKED") => apiFetch(`${base}/status`, { method: "PUT", json: { status } }),
    { invalidate: ["/api/users"] },
  );

  if (!canView) return <Alert type="info" showIcon title="Bạn không có quyền xem hồ sơ độc giả." />;
  if (loading) return <Skeleton active paragraph={{ rows: 4 }} />;
  if (error) return <ErrorPanel error={error} />;

  if (!data) {
    return (
      <>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Người này chưa có thẻ độc giả.">
          {canIssue && (
            <Button type="primary" onClick={() => issue.openModal()}>
              Cấp thẻ độc giả
            </Button>
          )}
        </Empty>
        <FormModal<IssueValues> {...issue.modalProps}>
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
          <Form.Item noStyle shouldUpdate={(a, b) => a.cardExpiryDate !== b.cardExpiryDate}>
            {({ getFieldValue }) => (
              <ReaderPersonalFields getExpiry={() => getFieldValue("cardExpiryDate")} note="Tất cả đều tùy chọn." />
            )}
          </Form.Item>
        </FormModal>
      </>
    );
  }

  const locked = data.status === "LOCKED";
  const setStatus = async () => {
    await changeStatus.mutateAsync(locked ? "ACTIVE" : "LOCKED");
    message.success(locked ? "Đã mở khóa thẻ." : "Đã khóa thẻ.");
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
          ...presentItems([
            { label: "Số điện thoại", value: data.phone },
            { label: "Ngày sinh", value: dobText(data.dateOfBirth) },
            { label: "Giới tính", value: genderLabel(data.gender) },
            { label: "Địa chỉ", value: data.address },
            { label: "Khoa / đơn vị", value: data.faculty },
            { label: "Lớp / ngành", value: data.className },
            { label: "Mã SV / cán bộ", value: data.memberCode, mono: true },
            { label: "Ngày cấp thẻ", value: data.cardIssuedDate ? formatDate(data.cardIssuedDate) : null },
          ]),
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
        {canUpdate && (
          <Button icon={<EditOutlined />} onClick={() => edit.openModal()}>
            Sửa hồ sơ
          </Button>
        )}
        {canRenew && <Button onClick={() => renew.openModal()}>Gia hạn thẻ</Button>}
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

      <FormModal<PersonalValues> {...edit.modalProps}>
        <ReaderPersonalFields getExpiry={() => dayjs(data.cardExpiryDate)} note={KEEP_NOTE} />
      </FormModal>

      <FormModal<{ newExpiryDate: dayjs.Dayjs }> {...renew.modalProps}>
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
