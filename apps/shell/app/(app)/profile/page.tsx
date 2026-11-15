import { gatewayFetch, requireSession, toErrorInfo, type ErrorInfo } from "@mfe/api";
import { Button, Card, ErrorPanel, KeyValueList, PageHeader, StatusTag, Tag, formatDate } from "@mfe/ui";
import { ExternalLinks, type ExternalLogin, type ExternalProvider } from "./ExternalLinks";

type UserView = { id: string; username: string; fullName?: string; email?: string; departmentId?: string; status?: string };
type ReaderProfile = {
  cardNo?: string;
  fullName?: string;
  readerType?: string;
  cardExpiryDate?: string;
  status?: string;
  cardValid?: boolean;
};

const READER_TYPES: Record<string, string> = { STUDENT: "Sinh viên", LECTURER: "Giảng viên" };
const DAY_MS = 86_400_000;

/** Đọc một API; trả `{ error }` thay vì ném để mỗi thẻ độc lập với nhau. */
async function load<T>(path: string): Promise<{ data: T } | { error: ErrorInfo }> {
  try {
    return { data: await gatewayFetch<T>(path, { signal: AbortSignal.timeout(8000) }) };
  } catch (e) {
    return { error: toErrorInfo(e) };
  }
}

function cardExpiryNote(dateOnly: string | undefined) {
  if (!dateOnly) return null;
  const exp = Date.parse(`${dateOnly}T23:59:59+07:00`);
  if (Number.isNaN(exp)) return null;
  const left = Math.ceil((exp - Date.now()) / DAY_MS);
  if (left < 0) return <Tag color="error">Đã hết hạn</Tag>;
  if (left <= 30) return <Tag color="warning">Còn {left} ngày</Tag>;
  return null;
}

export default async function ProfilePage() {
  // requireSession ném redirect nên phải gọi ngoài mọi try.
  const s = await requireSession("/profile");
  const [me, reader, providers, links] = await Promise.all([
    load<UserView>("/api/users/me"),
    load<ReaderProfile>("/api/users/me/reader-profile"),
    load<ExternalProvider[]>("/api/auth/external/providers"),
    load<ExternalLogin[]>("/api/auth/me/external"),
  ]);

  const user = "data" in me ? me.data : null;
  const displayName = user?.fullName || user?.username || s.username;
  // Nhân viên thường không có thẻ độc giả: 404 thì ẩn thẻ, không báo lỗi.
  const card = "data" in reader ? reader.data : null;
  const cardError = "error" in reader && reader.error.status !== 404 ? reader.error : null;

  const providerList = "data" in providers && Array.isArray(providers.data) ? providers.data : [];
  const linkList = "data" in links && Array.isArray(links.data) ? links.data : [];
  const showExternal = providerList.length > 0 || linkList.length > 0;

  return (
    <>
      <PageHeader title="Hồ sơ của tôi" description="Thông tin tài khoản và thẻ thư viện của bạn." />

      <div className="flex max-w-[960px] flex-col gap-5">
        <Card title="Tài khoản">
          {"error" in me ? (
            <ErrorPanel error={me.error} retryHref="/profile" />
          ) : (
            <div className="flex flex-col gap-5 sm:flex-row">
              <span
                aria-hidden
                className="grid size-16 shrink-0 place-items-center rounded-full bg-brand-50 text-2xl font-semibold text-brand-600"
              >
                {displayName.trim().charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <KeyValueList
                  columns={2}
                  items={[
                    { label: "Họ tên", value: user?.fullName },
                    { label: "Tên đăng nhập", value: user?.username ?? s.username, mono: true },
                    { label: "Email", value: user?.email },
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
                  <Button href="/change-password">Đổi mật khẩu</Button>
                  <span className="text-sm text-muted">Muốn đổi thông tin, liên hệ quản trị viên.</span>
                </div>
              </div>
            </div>
          )}
        </Card>

        {cardError ? (
          <Card title="Thẻ thư viện">
            <ErrorPanel error={cardError} retryHref="/profile" />
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

        {showExternal && (
          <Card title="Đăng nhập bằng tài khoản ngoài">
            <ExternalLinks providers={providerList} links={linkList} />
          </Card>
        )}
      </div>
    </>
  );
}
