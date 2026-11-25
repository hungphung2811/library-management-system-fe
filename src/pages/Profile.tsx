import type { UseQueryResult } from "@tanstack/react-query";
import { useApi, toErrorInfo } from "@/api";
import { useSession } from "@/auth/AuthProvider";
import { Card, ErrorPanel, KeyValueList, LinkButton, PageHeader, StatusTag, Tag, UserAvatar, dobText, formatDate, genderLabel, presentItems } from "@/ui";
import { DeviceSessions } from "./profile/DeviceSessions";
import { NotificationPreferences } from "./profile/NotificationPreferences";
import { ExternalLinks, type ExternalLogin, type ExternalProvider } from "./profile/ExternalLinks";

type UserView = {
  id: string;
  username: string;
  fullName?: string;
  email?: string;
  departmentId?: string;
  status?: string;
  phone?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  address?: string | null;
  avatarUrl?: string | null;
  jobTitle?: string | null;
  employeeCode?: string | null;
};
type ReaderProfile = {
  cardNo?: string;
  fullName?: string;
  readerType?: string;
  cardExpiryDate?: string;
  status?: string;
  cardValid?: boolean;
  phone?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  address?: string | null;
  faculty?: string | null;
  className?: string | null;
  memberCode?: string | null;
  cardIssuedDate?: string | null;
};

const READER_TYPES: Record<string, string> = { STUDENT: "Sinh viên", LECTURER: "Giảng viên" };
const DAY_MS = 86_400_000;

function cardExpiryNote(dateOnly: string | undefined) {
  if (!dateOnly) return null;
  const exp = Date.parse(`${dateOnly}T23:59:59+07:00`);
  if (Number.isNaN(exp)) return null;
  const left = Math.ceil((exp - Date.now()) / DAY_MS);
  if (left < 0) return <Tag color="error">Đã hết hạn</Tag>;
  if (left <= 30) return <Tag color="warning">Còn {left} ngày</Tag>;
  return null;
}

const retryOf = (q: UseQueryResult) => () => void q.refetch();

export default function ProfilePage() {
  const s = useSession();
  // Mỗi thẻ độc lập: một API lỗi không làm hỏng các thẻ còn lại.
  const me = useApi<UserView>("/api/users/me");
  const reader = useApi<ReaderProfile>("/api/users/me/reader-profile");
  const providers = useApi<ExternalProvider[]>("/api/auth/external/providers");
  const links = useApi<ExternalLogin[]>("/api/auth/me/external");

  const user = me.data ?? null;
  const displayName = user?.fullName || user?.username || s.username;
  // Nhân viên thường không có thẻ độc giả: 404 thì ẩn thẻ, không báo lỗi.
  const card = reader.data ?? null;
  const cardError = reader.isError && toErrorInfo(reader.error).status !== 404 ? toErrorInfo(reader.error) : null;

  const providerList = Array.isArray(providers.data) ? providers.data : [];
  const linkList = Array.isArray(links.data) ? links.data : [];
  const showExternal = providerList.length > 0 || linkList.length > 0;

  return (
    <>
      <PageHeader title="Hồ sơ của tôi" description="Thông tin tài khoản và thẻ thư viện của bạn." />

      <div className="flex max-w-[960px] flex-col gap-5">
        <Card title="Tài khoản" loading={me.isPending}>
          {me.isError ? (
            <ErrorPanel error={toErrorInfo(me.error)} onRetry={retryOf(me)} />
          ) : (
            <div className="flex flex-col gap-5 sm:flex-row">
              <UserAvatar name={displayName} src={user?.avatarUrl} size={64} />
              <div className="min-w-0 flex-1">
                <KeyValueList
                  columns={2}
                  items={[
                    { label: "Họ tên", value: user?.fullName },
                    { label: "Tên đăng nhập", value: user?.username ?? s.username, mono: true },
                    { label: "Email", value: user?.email },
                    ...presentItems([
                      { label: "Số điện thoại", value: user?.phone },
                      { label: "Ngày sinh", value: dobText(user?.dateOfBirth) },
                      { label: "Giới tính", value: genderLabel(user?.gender) },
                      { label: "Địa chỉ", value: user?.address },
                      { label: "Chức danh", value: user?.jobTitle },
                      { label: "Mã cán bộ", value: user?.employeeCode, mono: true },
                    ]),
                    {
                      label: "Vai trò",
                      value: s.roles.length ? (
                        <span className="flex flex-wrap gap-1">
                          {s.roles.map((r) => (
                            <Tag key={r} color="blue" className="me-0">
                              {r}
                            </Tag>
                          ))}
                        </span>
                      ) : null,
                    },
                  ]}
                />
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <LinkButton to="/change-password">Đổi mật khẩu</LinkButton>
                  <span className="text-sm text-muted">Muốn đổi thông tin, liên hệ quản trị viên.</span>
                </div>
              </div>
            </div>
          )}
        </Card>

        {cardError ? (
          <Card title="Thẻ thư viện">
            <ErrorPanel error={cardError} onRetry={retryOf(reader)} />
          </Card>
        ) : card ? (
          <Card title="Thẻ thư viện">
            <div className="mb-5">
              <div className="text-sm text-muted">Số thẻ</div>
              <div data-testid="card-no" className="font-mono text-2xl font-semibold text-ink">
                {card.cardNo ?? "—"}
              </div>
            </div>
            <KeyValueList
              columns={2}
              items={[
                { label: "Loại độc giả", value: card.readerType ? (READER_TYPES[card.readerType] ?? card.readerType) : null },
                {
                  label: "Hạn thẻ",
                  value: (
                    <span className="flex flex-wrap items-center gap-2">
                      {formatDate(card.cardExpiryDate)}
                      {cardExpiryNote(card.cardExpiryDate)}
                    </span>
                  ),
                },
                { label: "Trạng thái", value: <StatusTag domain="reader" value={card.status} /> },
                ...presentItems([
                  { label: "Khoa / đơn vị", value: card.faculty },
                  { label: "Lớp / ngành", value: card.className },
                  { label: "Mã SV / cán bộ", value: card.memberCode, mono: true },
                  { label: "Ngày cấp thẻ", value: card.cardIssuedDate ? formatDate(card.cardIssuedDate) : null },
                  { label: "Số điện thoại", value: user?.phone ? null : card.phone },
                  { label: "Ngày sinh", value: user?.dateOfBirth ? null : dobText(card.dateOfBirth) },
                  { label: "Giới tính", value: user?.gender ? null : genderLabel(card.gender) },
                  { label: "Địa chỉ", value: user?.address ? null : card.address },
                ]),
                {
                  label: "Hiệu lực",
                  value:
                    card.cardValid === undefined ? null : card.cardValid ? (
                      <Tag color="success">Thẻ hợp lệ</Tag>
                    ) : (
                      <Tag color="error">Thẻ không hợp lệ</Tag>
                    ),
                },
              ]}
            />
          </Card>
        ) : null}

        <Card title="Tùy chọn nhận thông báo">
          <NotificationPreferences />
        </Card>

        <Card title="Thiết bị đăng nhập">
          <DeviceSessions />
        </Card>

        {showExternal && (
          <Card title="Đăng nhập bằng tài khoản ngoài">
            <ExternalLinks providers={providerList} links={linkList} />
          </Card>
        )}
      </div>
    </>
  );
}
