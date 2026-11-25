import { useState, type ReactNode } from "react";
import { PERMISSIONS, apiDownload, can, hasModule, saveBlob, toErrorInfo, useSession } from "@/api";
import { Alert, App, Button, Card, Checkbox, DatePicker, Download, NoPermission, PageHeader, Select, dayjs, describeError } from "@/ui";

type Range = [string, string] | null;

// Khai báo lại (không import từ pages/sales): trang này thuộc chunk "app", import chunk "sales" sẽ tạo vòng phụ thuộc và vỡ lúc khởi động.
const CHANNELS: Record<string, string> = { POS: "Tại quầy", ONLINE: "Trực tuyến" };
const ORDER_STATUS: Record<string, string> = {
  AWAITING_PAYMENT: "Chờ thanh toán",
  PENDING_CONFIRMATION: "Chờ xác nhận",
  CONFIRMED: "Đã xác nhận",
  READY_FOR_PICKUP: "Sẵn sàng nhận",
  SHIPPING: "Đang giao",
  COMPLETED: "Hoàn tất",
  CANCELLED: "Đã hủy",
};

/** Tải một báo cáo CSV (`path` đã gồm query), lưu theo tên tệp BE gợi ý; BE cắt ở 10.000 dòng thì báo cho người dùng. */
function useCsvExport(path: string, fallbackName: string) {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const run = async () => {
    setLoading(true);
    try {
      const { blob, filename, truncated } = await apiDownload(path as `/api/${string}`);
      saveBlob(blob, filename ?? fallbackName);
      if (truncated) message.warning("Báo cáo đã bị cắt ở 10.000 dòng. Hãy thu hẹp bộ lọc để lấy đủ dữ liệu.");
      else message.success("Đã tải báo cáo.");
    } catch (e) {
      message.error(describeError(toErrorInfo(e)).text);
    } finally {
      setLoading(false);
    }
  };
  return { loading, run };
}

function ReportCard({
  title,
  description,
  filters,
  loading,
  onExport,
  testId,
}: {
  title: string;
  description: string;
  filters?: ReactNode;
  loading: boolean;
  onExport: () => void;
  testId: string;
}) {
  return (
    <Card title={title} data-testid={testId}>
      <div className="flex flex-col gap-3">
        <p className="m-0 text-muted">{description}</p>
        {filters && <div className="flex flex-wrap items-center gap-3">{filters}</div>}
        <div>
          <Button type="primary" icon={<Download size={16} />} loading={loading} onClick={onExport}>
            Xuất CSV
          </Button>
        </div>
      </div>
    </Card>
  );
}

function OverdueReport() {
  const x = useCsvExport("/api/reports/overdue-borrowings", "phieu-qua-han.csv");
  return (
    <ReportCard
      testId="report-overdue"
      title="Phiếu mượn quá hạn"
      description="Mỗi dòng là một bản sao chưa trả của phiếu quá hạn, sắp theo số ngày quá hạn giảm dần."
      loading={x.loading}
      onExport={() => void x.run()}
    />
  );
}

function StockReport() {
  const [low, setLow] = useState(false);
  const x = useCsvExport(`/api/reports/stock${low ? "?lowStockOnly=true" : ""}`, "ton-kho.csv");
  return (
    <ReportCard
      testId="report-stock"
      title="Tồn kho"
      description="Tồn kho, số đã giữ, số sẵn bán và ngưỡng cảnh báo của từng mặt hàng."
      filters={
        <Checkbox checked={low} onChange={(e) => setLow(e.target.checked)}>
          Chỉ mặt hàng sắp hết
        </Checkbox>
      }
      loading={x.loading}
      onExport={() => void x.run()}
    />
  );
}

function OrdersReport() {
  const [range, setRange] = useState<Range>(null);
  const [channel, setChannel] = useState("");
  const [status, setStatus] = useState("");
  const qs = new URLSearchParams();
  if (range) {
    qs.set("from", range[0]);
    qs.set("to", range[1]);
  }
  if (channel) qs.set("channel", channel);
  if (status) qs.set("status", status);
  const q = qs.toString();
  const x = useCsvExport(`/api/reports/orders${q ? `?${q}` : ""}`, "don-hang.csv");
  return (
    <ReportCard
      testId="report-orders"
      title="Đơn hàng"
      description="Đơn hàng theo ngày tạo (giờ Việt Nam). Không chọn ngày thì lấy 30 ngày gần nhất; tối đa 366 ngày."
      filters={
        <>
          <DatePicker.RangePicker
            allowClear
            format="DD/MM/YYYY"
            placeholder={["Từ ngày", "Đến ngày"]}
            value={range ? [dayjs(range[0]), dayjs(range[1])] : null}
            onChange={(v) => setRange(v?.[0] && v?.[1] ? [v[0].format("YYYY-MM-DD"), v[1].format("YYYY-MM-DD")] : null)}
          />
          <Select
            aria-label="Kênh bán"
            className="w-40"
            value={channel}
            onChange={setChannel}
            options={[{ value: "", label: "Mọi kênh" }, ...Object.entries(CHANNELS).map(([value, label]) => ({ value, label }))]}
          />
          <Select
            aria-label="Trạng thái đơn"
            className="w-48"
            value={status}
            onChange={setStatus}
            options={[{ value: "", label: "Mọi trạng thái" }, ...Object.entries(ORDER_STATUS).map(([value, label]) => ({ value, label }))]}
          />
        </>
      }
      loading={x.loading}
      onExport={() => void x.run()}
    />
  );
}

/** Báo cáo CSV (GET /api/reports/**): mỗi báo cáo theo module và khóa quyền riêng; BE là nơi quyết định cuối. */
export default function Reports() {
  const s = useSession();
  const overdue = hasModule(s, "LENDING") && can(s, PERMISSIONS.REPORT_OVERDUE_CSV);
  const stock = hasModule(s, "SALES") && can(s, PERMISSIONS.REPORT_STOCK_CSV);
  const orders = hasModule(s, "SALES") && can(s, PERMISSIONS.REPORT_ORDERS_CSV);
  return (
    <>
      <PageHeader title="Báo cáo" description="Xuất dữ liệu ra tệp CSV (mở được bằng Excel)." />
      {!overdue && !stock && !orders ? (
        <NoPermission feature="Báo cáo" />
      ) : (
        <div className="flex flex-col gap-4">
          <Alert type="info" showIcon title="Mỗi tệp tối đa 10.000 dòng; vượt quá thì tệp bị cắt và hệ thống sẽ báo." />
          {overdue && <OverdueReport />}
          {stock && <StockReport />}
          {orders && <OrdersReport />}
        </div>
      )}
    </>
  );
}
