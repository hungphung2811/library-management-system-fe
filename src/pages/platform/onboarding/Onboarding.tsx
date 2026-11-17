import { useRef, useState } from "react";
import type { Dayjs } from "dayjs";
import { apiFetch, toErrorInfo, useApi } from "@/api";
import {
  Alert,
  Button,
  Checkbox,
  DatePicker,
  Form,
  Input,
  InputNumber,
  LinkButton,
  PageHeader,
  Radio,
  Result,
  Select,
  Steps,
  Tag,
} from "@/ui";
import { PlatformGate } from "../_components/PlatformGate";
import { BILLING_UNIT_OPTIONS } from "../_lib/contract-format";
import type { Contract } from "../_lib/contract-types";
import { checkOriginInput, describeOriginError } from "../_lib/storefront-origin";
import { MODULE_OPTIONS, moduleLabel, withTenantErrors } from "../_lib/tenant-format";
import type { Organization, TenantSummary } from "../_lib/tenant-types";

type Values = {
  code: string;
  name: string;
  organizationId?: string;
  modules: string[];
  adminMode: "new" | "existing";
  username?: string;
  fullName?: string;
  email?: string;
  temporaryPassword?: string;
  existingUserId?: string;
  withContract: boolean;
  contractName?: string;
  startDate?: Dayjs;
  endDate?: Dayjs;
  totalAmount?: number;
  cycleValue?: number | null;
  cycleUnit?: string | null;
  internalNote?: string;
  activate: boolean;
  origins?: string;
};

type TaskStatus = "wait" | "run" | "done" | "error";
type Task = { key: "tenant" | "contract" | "activate" | "origins"; label: string; status: TaskStatus; error?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STEP_FIELDS: (keyof Values)[][] = [
  ["code", "name", "organizationId"],
  ["modules", "adminMode", "username", "fullName", "email", "temporaryPassword", "existingUserId"],
  ["withContract", "contractName", "startDate", "endDate", "totalAmount", "cycleValue", "cycleUnit", "internalNote", "activate"],
  ["origins"],
];
const STATUS_TAG: Record<TaskStatus, { text: string; color: string }> = {
  wait: { text: "Chờ", color: "default" },
  run: { text: "Đang chạy", color: "processing" },
  done: { text: "Xong", color: "success" },
  error: { text: "Lỗi", color: "error" },
};

const iso = (d: Dayjs | null | undefined) => (d ? d.format("YYYY-MM-DD") : undefined);
const originList = (raw: string | undefined) =>
  (raw ?? "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

export default function OnboardingPage() {
  return (
    <PlatformGate>
      <Wizard />
    </PlatformGate>
  );
}

/**
 * Wizard triển khai khách mới: gom tạo đơn vị (kèm quản trị viên đầu tiên và module), hợp đồng, kích hoạt và origin website
 * vào một luồng. Không có API gộp ở BE nên FE chạy tuần tự từng bước; bước lỗi dừng lại và "Thử lại" chỉ chạy các bước chưa xong
 * (id đã tạo được giữ trong ref, không tạo trùng).
 */
function Wizard() {
  const [form] = Form.useForm<Values>();
  const [step, setStep] = useState(0);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [running, setRunning] = useState(false);
  const created = useRef<{ tenant?: TenantSummary; contract?: Contract; origins: Set<string> }>({ origins: new Set() });
  const orgs = useApi<Organization[]>("/api/platform/organizations");
  const orgOptions = (orgs.data ?? []).map((o) => ({ value: o.id, label: o.name }));

  const modules = (Form.useWatch("modules", form) as string[] | undefined) ?? ["LENDING"];
  const adminMode = Form.useWatch("adminMode", form) ?? "new";
  const withContract = Form.useWatch("withContract", form) ?? true;
  const hasSales = modules.includes("SALES");
  const locked = tasks !== null;

  const next = async () => {
    await form.validateFields(STEP_FIELDS[step]);
    setStep((s) => s + 1);
  };

  const plan = (v: Values): Task[] => {
    const t: Task[] = [{ key: "tenant", label: "Tạo đơn vị và quản trị viên đầu tiên", status: "wait" }];
    if (v.withContract) {
      t.push({ key: "contract", label: "Tạo hợp đồng", status: "wait" });
      if (v.activate) t.push({ key: "activate", label: "Kích hoạt hợp đồng", status: "wait" });
    }
    if (hasSales && originList(v.origins).length > 0) t.push({ key: "origins", label: "Khai báo origin website", status: "wait" });
    return t;
  };

  const runTask = async (key: Task["key"], v: Values) => {
    const c = created.current;
    if (key === "tenant") {
      if (c.tenant) return;
      c.tenant = await withTenantErrors(() =>
        apiFetch<TenantSummary>("/api/platform/tenants", {
          method: "POST",
          json: {
            code: v.code.trim(),
            name: v.name.trim(),
            organizationId: v.organizationId || undefined,
            modules: v.modules,
            ...(v.adminMode === "existing"
              ? { existingUserId: v.existingUserId?.trim() }
              : {
                  newAdmin: {
                    username: v.username?.trim(),
                    fullName: v.fullName?.trim(),
                    email: v.email?.trim(),
                    temporaryPassword: v.temporaryPassword,
                  },
                }),
          },
        }),
      );
    } else if (key === "contract") {
      if (c.contract || !c.tenant) return;
      const billingCycle = v.cycleValue && v.cycleUnit ? { unit: v.cycleUnit, value: v.cycleValue } : null;
      c.contract = await withTenantErrors(() =>
        apiFetch<Contract>(`/api/platform/tenants/${encodeURIComponent(c.tenant!.id)}/contracts`, {
          method: "POST",
          json: {
            name: v.contractName?.trim(),
            modules: v.modules,
            startDate: iso(v.startDate),
            endDate: iso(v.endDate),
            totalAmount: v.totalAmount,
            billingCycle,
            internalNote: v.internalNote?.trim() || null,
          },
        }),
      );
    } else if (key === "activate") {
      if (!c.contract || c.contract.status === "ACTIVE") return;
      c.contract = await withTenantErrors(() =>
        apiFetch<Contract>(`/api/platform/contracts/${encodeURIComponent(c.contract!.id)}/activate`, { method: "POST" }),
      );
    } else if (c.tenant) {
      for (const origin of originList(v.origins)) {
        if (c.origins.has(origin)) continue;
        try {
          await apiFetch(`/api/platform/tenants/${encodeURIComponent(c.tenant.id)}/storefront-origins`, { method: "POST", json: { origin } });
        } catch (e) {
          const d = describeOriginError(e);
          throw new Error(d ? `${origin}: ${d.text}` : `${origin}: ${toErrorInfo(e).message ?? "không thêm được"}`);
        }
        c.origins.add(origin);
      }
    }
  };

  const run = async () => {
    const v = form.getFieldsValue(true) as Values;
    const list = tasks ?? plan(v);
    setRunning(true);
    let cur = list.map((t) => (t.status === "done" ? t : { ...t, status: "wait" as TaskStatus, error: undefined }));
    setTasks(cur);
    for (const t of cur) {
      if (t.status === "done") continue;
      cur = cur.map((x) => (x.key === t.key ? { ...x, status: "run" } : x));
      setTasks(cur);
      try {
        await runTask(t.key, v);
        cur = cur.map((x) => (x.key === t.key ? { ...x, status: "done" } : x));
        setTasks(cur);
      } catch (e) {
        const msg = e instanceof Error && !(e as { status?: number }).status ? e.message : (toErrorInfo(e).message ?? "Thao tác không thành công.");
        cur = cur.map((x) => (x.key === t.key ? { ...x, status: "error", error: msg } : x));
        setTasks(cur);
        break;
      }
    }
    setRunning(false);
  };

  const allDone = tasks !== null && tasks.every((t) => t.status === "done");
  const v = form.getFieldsValue(true) as Values;
  const tenant = created.current.tenant;

  return (
    <>
      <PageHeader title="Triển khai khách mới" description="Tạo đơn vị, hợp đồng, kích hoạt và khai báo website trong một luồng." />
      <div className="flex max-w-[860px] flex-col gap-6">
        <Steps
          current={allDone ? 4 : step}
          size="small"
          items={[{ title: "Đơn vị" }, { title: "Quản trị & module" }, { title: "Hợp đồng" }, { title: "Website" }, { title: "Xác nhận" }]}
        />
        {allDone && tenant ? (
          <Result
            status="success"
            title={`Đã triển khai ${tenant.name}`}
            subTitle={
              v.adminMode === "new"
                ? `Quản trị viên "${v.username}" đăng nhập bằng mật khẩu tạm bạn vừa đặt và phải đổi ngay ở lần đầu. Gửi thông tin này cho khách qua kênh an toàn.`
                : "Quản trị viên là tài khoản có sẵn: dùng mật khẩu hiện tại của họ."
            }
            extra={[
              <LinkButton key="t" type="primary" to={`/platform/tenants/${encodeURIComponent(tenant.id)}`}>
                Mở đơn vị
              </LinkButton>,
              created.current.contract ? (
                <LinkButton key="c" to={`/platform/tenants/${encodeURIComponent(tenant.id)}/contracts/${encodeURIComponent(created.current.contract.id)}`}>
                  Mở hợp đồng
                </LinkButton>
              ) : null,
              <LinkButton key="n" to="/platform/tenants">
                Danh sách đơn vị
              </LinkButton>,
            ]}
          />
        ) : (
          <Form<Values>
            form={form}
            layout="vertical"
            disabled={locked}
            initialValues={{ modules: ["LENDING"], adminMode: "new", withContract: true, activate: true, cycleUnit: "MONTH" }}
          >
            <section hidden={step !== 0}>
              <Form.Item name="code" label="Mã đơn vị" extra="Không đổi được sau khi tạo." rules={[{ required: true, whitespace: true, message: "Nhập mã đơn vị" }, { min: 2, max: 50, message: "Từ 2 đến 50 ký tự" }]}>
                <Input autoComplete="off" />
              </Form.Item>
              <Form.Item name="name" label="Tên đơn vị" rules={[{ required: true, whitespace: true, message: "Nhập tên đơn vị" }, { max: 255, message: "Tối đa 255 ký tự" }]}>
                <Input autoComplete="off" />
              </Form.Item>
              <Form.Item name="organizationId" label="Tổ chức" extra="Chỉ chọn khi khách có nhiều đơn vị. Tổ chức tạo ở mục Tổ chức.">
                <Select allowClear showSearch={{ optionFilterProp: "label" }} options={orgOptions} placeholder="Không thuộc tổ chức nào" />
              </Form.Item>
            </section>

            <section hidden={step !== 1}>
              <Form.Item name="modules" label="Module theo gói đã ký" rules={[{ required: true, type: "array", min: 1, message: "Chọn ít nhất một module" }]}>
                <Checkbox.Group options={MODULE_OPTIONS} />
              </Form.Item>
              <Form.Item name="adminMode" label="Quản trị viên đầu tiên">
                <Radio.Group options={[{ value: "new", label: "Tạo tài khoản mới" }, { value: "existing", label: "Dùng tài khoản có sẵn" }]} />
              </Form.Item>
              {adminMode === "existing" ? (
                <Form.Item name="existingUserId" label="Mã người dùng (UUID)" rules={[{ required: true, message: "Nhập mã người dùng" }, { pattern: UUID, message: "Phải là UUID" }]}>
                  <Input autoComplete="off" className="font-mono" />
                </Form.Item>
              ) : (
                <>
                  <Form.Item name="username" label="Tên đăng nhập quản trị" rules={[{ required: true, whitespace: true, message: "Nhập tên đăng nhập" }, { min: 3, max: 100, message: "Từ 3 đến 100 ký tự" }]}>
                    <Input autoComplete="off" />
                  </Form.Item>
                  <Form.Item name="fullName" label="Họ tên quản trị" rules={[{ required: true, whitespace: true, message: "Nhập họ tên" }, { max: 255, message: "Tối đa 255 ký tự" }]}>
                    <Input autoComplete="off" />
                  </Form.Item>
                  <Form.Item name="email" label="Email quản trị" rules={[{ required: true, message: "Nhập email" }, { type: "email", message: "Email chưa đúng định dạng" }]}>
                    <Input autoComplete="off" />
                  </Form.Item>
                  <Form.Item name="temporaryPassword" label="Mật khẩu tạm" extra="Quản trị viên dùng mật khẩu này đăng nhập lần đầu (phải đổi ngay)." rules={[{ required: true, message: "Nhập mật khẩu tạm" }, { min: 8, max: 128, message: "Từ 8 đến 128 ký tự" }]}>
                    <Input.Password autoComplete="new-password" />
                  </Form.Item>
                </>
              )}
            </section>

            <section hidden={step !== 2}>
              <Form.Item name="withContract" valuePropName="checked">
                <Checkbox>Tạo hợp đồng cho đơn vị này</Checkbox>
              </Form.Item>
              {withContract ? (
                <>
                  <Form.Item name="contractName" label="Tên hợp đồng" rules={[{ required: true, whitespace: true, message: "Nhập tên hợp đồng" }, { max: 255, message: "Tối đa 255 ký tự" }]}>
                    <Input autoComplete="off" />
                  </Form.Item>
                  <div className="grid gap-x-4 sm:grid-cols-2">
                    <Form.Item name="startDate" label="Ngày bắt đầu" rules={[{ required: true, message: "Chọn ngày bắt đầu" }]}>
                      <DatePicker format="DD/MM/YYYY" className="w-full" />
                    </Form.Item>
                    <Form.Item
                      name="endDate"
                      label="Ngày kết thúc"
                      dependencies={["startDate"]}
                      rules={[
                        { required: true, message: "Chọn ngày kết thúc" },
                        ({ getFieldValue }) => ({
                          validator: (_, d: Dayjs | undefined) => {
                            const s = getFieldValue("startDate") as Dayjs | undefined;
                            return d && s && d.isBefore(s, "day") ? Promise.reject(new Error("Ngày kết thúc không được trước ngày bắt đầu")) : Promise.resolve();
                          },
                        }),
                      ]}
                    >
                      <DatePicker format="DD/MM/YYYY" className="w-full" />
                    </Form.Item>
                  </div>
                  <Form.Item name="totalAmount" label="Tổng tiền (VND)" extra="Tổng theo cả hợp đồng, số nguyên đồng." rules={[{ required: true, type: "number", min: 0, message: "Nhập tổng tiền từ 0 trở lên" }]}>
                    <InputNumber<number>
                      className="w-full"
                      min={0}
                      step={1000}
                      precision={0}
                      formatter={(x) => (x == null ? "" : String(x).replace(/\B(?=(\d{3})+(?!\d))/g, "."))}
                      parser={(x) => Number(String(x ?? "").replace(/\./g, "")) || 0}
                    />
                  </Form.Item>
                  <Form.Item label="Chu kỳ thanh toán (tham khảo)">
                    <div className="flex gap-2">
                      <Form.Item name="cycleValue" noStyle>
                        <InputNumber min={1} precision={0} placeholder="Số" aria-label="Chu kỳ thanh toán: số" />
                      </Form.Item>
                      <Form.Item name="cycleUnit" noStyle>
                        <Select aria-label="Chu kỳ thanh toán: đơn vị" options={BILLING_UNIT_OPTIONS} className="min-w-28" />
                      </Form.Item>
                    </div>
                  </Form.Item>
                  <Form.Item name="internalNote" label="Ghi chú nội bộ" extra="Chỉ platform admin thấy.">
                    <Input.TextArea rows={2} maxLength={2000} />
                  </Form.Item>
                  <Form.Item name="activate" valuePropName="checked" extra="Hợp đồng đang là nháp thì chưa áp dụng module cho đơn vị.">
                    <Checkbox>Kích hoạt hợp đồng ngay sau khi tạo</Checkbox>
                  </Form.Item>
                </>
              ) : (
                <Alert type="warning" showIcon title="Không tạo hợp đồng: đơn vị sẽ chưa có hợp đồng hiệu lực. Bạn có thể thêm sau ở tab Hợp đồng của đơn vị." />
              )}
            </section>

            <section hidden={step !== 3}>
              {hasSales ? (
                <Form.Item
                  name="origins"
                  label="Origin website (mỗi dòng một địa chỉ)"
                  extra="Tùy chọn. Ví dụ https://tenant.example.com: không đường dẫn, không wildcard; có thể thêm sau ở tab Origin website."
                  rules={[
                    {
                      validator: (_, raw: string | undefined) => {
                        for (const o of originList(raw)) {
                          const bad = checkOriginInput(o);
                          if (bad) return Promise.reject(new Error(`${o}: ${bad}`));
                        }
                        return Promise.resolve();
                      },
                    },
                  ]}
                >
                  <Input.TextArea rows={4} autoComplete="off" placeholder="https://tenant.example.com" />
                </Form.Item>
              ) : (
                <Alert type="info" showIcon title="Chỉ cần khai báo website khi đơn vị bật module Bán hàng. Bỏ qua bước này." />
              )}
            </section>

            {step === 4 && (
              <div className="flex flex-col gap-3" data-testid="onboarding-review">
                <Alert type="info" showIcon title="Kiểm tra lại, bấm Triển khai để chạy lần lượt các bước bên dưới." />
                <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[180px_1fr]">
                  <dt className="text-muted">Đơn vị</dt>
                  <dd>
                    {v.name} <span className="font-mono text-sm">({v.code})</span>
                  </dd>
                  <dt className="text-muted">Tổ chức</dt>
                  <dd>{orgOptions.find((o) => o.value === v.organizationId)?.label ?? "Không"}</dd>
                  <dt className="text-muted">Module</dt>
                  <dd>{(v.modules ?? []).map(moduleLabel).join(", ")}</dd>
                  <dt className="text-muted">Quản trị viên</dt>
                  <dd>{v.adminMode === "existing" ? `Tài khoản có sẵn (${v.existingUserId})` : `${v.fullName} (${v.username}, ${v.email})`}</dd>
                  <dt className="text-muted">Hợp đồng</dt>
                  <dd>
                    {v.withContract
                      ? `${v.contractName}, ${iso(v.startDate)} đến ${iso(v.endDate)}, ${(v.totalAmount ?? 0).toLocaleString("vi-VN")} đ${v.activate ? ", kích hoạt ngay" : ", để nháp"}`
                      : "Không tạo"}
                  </dd>
                  <dt className="text-muted">Origin website</dt>
                  <dd>{hasSales && originList(v.origins).length > 0 ? originList(v.origins).join(", ") : "Không"}</dd>
                </dl>
                {tasks && (
                  <ul className="flex flex-col gap-2" data-testid="onboarding-tasks">
                    {tasks.map((t) => (
                      <li key={t.key} className="flex flex-wrap items-center gap-2">
                        <Tag color={STATUS_TAG[t.status].color}>{STATUS_TAG[t.status].text}</Tag>
                        <span>{t.label}</span>
                        {t.error && (
                          <span className="text-sm text-red-600" role="alert">
                            {t.error}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {tenant && !allDone && (
                  <Alert type="warning" showIcon title="Đơn vị đã được tạo. Thử lại chỉ chạy tiếp các bước chưa xong, không tạo trùng." />
                )}
              </div>
            )}
          </Form>
        )}

        {!allDone && (
          <div className="flex gap-2">
            {step > 0 && !tenant && (
              <Button disabled={running} onClick={() => setStep((s) => s - 1)}>
                Quay lại
              </Button>
            )}
            {step < 4 ? (
              <Button type="primary" onClick={() => void next().catch(() => undefined)}>
                Tiếp tục
              </Button>
            ) : (
              <Button type="primary" loading={running} onClick={() => void run()}>
                {tasks?.some((t) => t.status === "error") ? "Thử lại" : "Triển khai"}
              </Button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
