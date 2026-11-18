import { useEffect, useRef } from "react";
import { apiFetch } from "@/api";
import { Alert, FormModal, Form, Input, Radio } from "@/ui";
import {
  BUYER_TAX_CODE,
  EMAIL,
  NO_INVOICE_BUYER_NAME,
  cleanBuyer,
  type BuyerFormValues,
  type InvoiceRequestView,
  type InvoiceView,
} from "../_lib/invoices";
import { newRequestId, type SalesOrder } from "../_lib/sales";

const REASON_RULES = [
  { required: true, whitespace: true, message: "Nhập lý do" },
  { max: 500, message: "Tối đa 500 ký tự" },
];

/**
 * Các ô thông tin người mua (đúng luật BE): cần tên người mua hoặc tên đơn vị; có MST thì bắt buộc tên đơn vị và địa chỉ;
 * MST 10 chữ số, 10-3 hoặc 12 chữ số; email đúng định dạng. Là các `Form.Item` nên đặt trong FormModal.
 */
export function BuyerFields({ required = true }: { required?: boolean }) {
  return (
    <>
      <div className="grid gap-x-4 sm:grid-cols-2">
        <Form.Item
          name="name"
          label="Tên người mua"
          dependencies={["company"]}
          rules={[
            { max: 200, message: "Tối đa 200 ký tự" },
            ({ getFieldValue }) => ({
              validator: (_, v: string | undefined) =>
                !required || (v ?? "").trim() || (getFieldValue("company") ?? "").trim() ? Promise.resolve() : Promise.reject(new Error("Nhập tên người mua hoặc tên đơn vị")),
            }),
          ]}
        >
          <Input autoComplete="off" />
        </Form.Item>
        <Form.Item
          name="company"
          label="Tên đơn vị"
          dependencies={["taxCode", "name"]}
          rules={[
            { max: 255, message: "Tối đa 255 ký tự" },
            ({ getFieldValue }) => ({
              validator: (_, v: string | undefined) =>
                !(getFieldValue("taxCode") ?? "").trim() || (v ?? "").trim() ? Promise.resolve() : Promise.reject(new Error("Có mã số thuế thì phải nhập tên đơn vị")),
            }),
          ]}
        >
          <Input autoComplete="off" />
        </Form.Item>
        <Form.Item
          name="taxCode"
          label="Mã số thuế"
          extra="10 chữ số, 10 chữ số-3 chữ số (ví dụ 0123456789-001) hoặc 12 chữ số. Chỉ kiểm định dạng."
          rules={[
            {
              validator: (_, v: string | undefined) =>
                !(v ?? "").trim() || BUYER_TAX_CODE.test((v ?? "").trim()) ? Promise.resolve() : Promise.reject(new Error("Mã số thuế chưa đúng định dạng")),
            },
          ]}
        >
          <Input autoComplete="off" inputMode="numeric" />
        </Form.Item>
        <Form.Item
          name="email"
          label="Email nhận hóa đơn (tùy chọn)"
          rules={[
            {
              validator: (_, v: string | undefined) =>
                !(v ?? "").trim() || EMAIL.test((v ?? "").trim()) ? Promise.resolve() : Promise.reject(new Error("Email chưa đúng định dạng")),
            },
          ]}
        >
          <Input autoComplete="off" type="email" />
        </Form.Item>
      </div>
      <Form.Item
        name="address"
        label="Địa chỉ"
        dependencies={["taxCode"]}
        rules={[
          { max: 500, message: "Tối đa 500 ký tự" },
          ({ getFieldValue }) => ({
            validator: (_, v: string | undefined) =>
              !(getFieldValue("taxCode") ?? "").trim() || (v ?? "").trim() ? Promise.resolve() : Promise.reject(new Error("Có mã số thuế thì phải nhập địa chỉ")),
          }),
        ]}
      >
        <Input autoComplete="off" />
      </Form.Item>
    </>
  );
}

type IssueValues = BuyerFormValues & { mode: "buyer" | "request" | "walkin" };

/**
 * Xuất hóa đơn cho đơn: lưu yêu cầu xuất hóa đơn (PUT, nếu nhập thông tin người mua) rồi phát hành (POST, chỉ có clientRequestId).
 * Đơn đã có yêu cầu đang chờ thì không chọn được "khách lẻ" (BE sẽ dùng yêu cầu đó); không có khóa lưu yêu cầu thì dùng nguyên yêu cầu sẵn có.
 */
export function IssueInvoiceModal({
  order,
  request,
  canSaveRequest,
  open,
  onClose,
  onIssued,
}: {
  order: SalesOrder;
  request: InvoiceRequestView | null;
  canSaveRequest: boolean;
  open: boolean;
  onClose: () => void;
  onIssued: (i: InvoiceView) => void;
}) {
  const reqId = useRef(newRequestId());
  useEffect(() => {
    if (open) reqId.current = newRequestId();
  }, [open]);
  const pending = request?.status === "OPEN" ? request : null;
  const mode: IssueValues["mode"] = pending ? (canSaveRequest ? "buyer" : "request") : canSaveRequest ? "buyer" : "walkin";
  const initial: Partial<IssueValues> = {
    mode,
    name: pending?.buyerName ?? "",
    company: pending?.buyerCompany ?? "",
    taxCode: pending?.buyerTaxCode ?? "",
    address: pending?.buyerAddress ?? "",
    email: pending?.buyerEmail ?? "",
  };
  return (
    <FormModal<IssueValues>
      open={open}
      title={`Xuất hóa đơn cho đơn ${order.orderNo}`}
      okText="Xuất hóa đơn"
      onCancel={onClose}
      initialValues={initial}
      successMessage="Đã xuất hóa đơn."
      onSubmit={async (v) => {
        if (v.mode === "buyer") {
          await apiFetch(`/api/sales/orders/${encodeURIComponent(order.id)}/invoice-request`, { method: "PUT", json: { buyer: cleanBuyer(v) } });
        }
        const inv = await apiFetch<InvoiceView>(`/api/sales/orders/${encodeURIComponent(order.id)}/invoice`, {
          method: "POST",
          json: { clientRequestId: reqId.current },
        });
        onIssued(inv);
      }}
    >
      <Alert className="mb-4" type="warning" showIcon title="Hóa đơn nội bộ, chưa có giá trị pháp lý của hóa đơn điện tử." />
      <Form.Item name="mode" hidden>
        <Input />
      </Form.Item>
      <IssueModeBody pending={pending} canSaveRequest={canSaveRequest} />
    </FormModal>
  );
}

function IssueModeBody({ pending, canSaveRequest }: { pending: InvoiceRequestView | null; canSaveRequest: boolean }) {
  const form = Form.useFormInstance<IssueValues>();
  const mode = Form.useWatch("mode", form) as IssueValues["mode"] | undefined;
  return (
    <>
      {!pending && canSaveRequest && (
        <Form.Item label="Người mua">
          <Radio.Group
            value={mode}
            onChange={(e) => form.setFieldValue("mode", e.target.value)}
            options={[
              { value: "buyer", label: "Khách lấy hóa đơn (nhập thông tin)" },
              { value: "walkin", label: "Khách lẻ, không lấy hóa đơn" },
            ]}
          />
        </Form.Item>
      )}
      {pending && (
        <p className="mt-0 text-sm text-muted">
          Đơn đã có yêu cầu xuất hóa đơn của khách ({pending.source === "ONLINE" ? "trực tuyến" : "tại quầy"}).
          {canSaveRequest ? " Kiểm tra hoặc sửa thông tin bên dưới trước khi xuất." : " Hóa đơn sẽ dùng đúng thông tin khách đã gửi."}
        </p>
      )}
      {mode === "walkin" && <p className="m-0 text-sm text-muted">Hóa đơn ghi người mua là «{NO_INVOICE_BUYER_NAME}», không có mã số thuế.</p>}
      {mode === "request" && pending && (
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-muted">Người mua</dt>
          <dd className="m-0">{pending.buyerCompany || pending.buyerName || "—"}</dd>
          <dt className="text-muted">Mã số thuế</dt>
          <dd className="m-0">{pending.buyerTaxCode || "—"}</dd>
          <dt className="text-muted">Địa chỉ</dt>
          <dd className="m-0">{pending.buyerAddress || "—"}</dd>
        </dl>
      )}
      {mode === "buyer" && <BuyerFields />}
    </>
  );
}

/** Hủy hóa đơn: bắt buộc lý do (tối đa 500 ký tự). */
export function CancelInvoiceModal({ invoice, open, onClose, onDone }: { invoice: InvoiceView; open: boolean; onClose: () => void; onDone: () => void }) {
  return (
    <FormModal<{ reason: string }>
      open={open}
      title={`Hủy hóa đơn ${invoice.invoiceNumber ?? ""}`.trim()}
      okText="Hủy hóa đơn"
      onCancel={onClose}
      successMessage="Đã hủy hóa đơn."
      onSubmit={async (v) => {
        await apiFetch(`/api/sales/invoices/${encodeURIComponent(invoice.id)}/cancellation`, { method: "POST", json: { reason: v.reason.trim() } });
        onDone();
      }}
    >
      <Alert className="mb-4" type="warning" showIcon title="Hóa đơn đã hủy vẫn giữ số và số tiền để đối chiếu. Sau khi hủy có thể xuất lại hóa đơn mới cho đơn." />
      <Form.Item name="reason" label="Lý do hủy" rules={REASON_RULES}>
        <Input.TextArea rows={3} maxLength={500} showCount />
      </Form.Item>
    </FormModal>
  );
}

type ReplaceValues = BuyerFormValues & { reason: string };

/** Thay thế hóa đơn: hủy bản cũ và lập bản mới trong cùng giao dịch; lý do bắt buộc, thông tin người mua tùy chọn đổi. */
export function ReplaceInvoiceModal({ invoice, open, onClose, onDone }: { invoice: InvoiceView; open: boolean; onClose: () => void; onDone: (i: InvoiceView) => void }) {
  const reqId = useRef(newRequestId());
  useEffect(() => {
    if (open) reqId.current = newRequestId();
  }, [open]);
  const b = invoice.buyer;
  const walkIn = b.name === NO_INVOICE_BUYER_NAME && !b.company;
  const initial: Partial<ReplaceValues> = {
    reason: "",
    name: walkIn ? "" : (b.name ?? ""),
    company: b.company ?? "",
    taxCode: b.taxCode ?? "",
    address: b.address ?? "",
    email: b.email ?? "",
  };
  return (
    <FormModal<ReplaceValues>
      open={open}
      title={`Thay thế hóa đơn ${invoice.invoiceNumber ?? ""}`.trim()}
      okText="Thay thế"
      onCancel={onClose}
      initialValues={initial}
      successMessage="Đã thay thế hóa đơn."
      onSubmit={async (v) => {
        const buyer = cleanBuyer(v);
        const changed = (["name", "company", "taxCode", "address", "email"] as const).some((k) => (buyer[k] ?? "") !== (initial[k] ?? ""));
        const created = await apiFetch<InvoiceView>(`/api/sales/invoices/${encodeURIComponent(invoice.id)}/replacement`, {
          method: "POST",
          json: { reason: v.reason.trim(), ...(changed ? { buyer } : {}), clientRequestId: reqId.current },
        });
        onDone(created);
      }}
    >
      <Alert className="mb-4" type="warning" showIcon title="Hóa đơn cũ bị hủy và hóa đơn mới được lập với số mới. Người bán, mẫu số, ký hiệu theo cấu hình hiện tại." />
      <Form.Item name="reason" label="Lý do thay thế" rules={REASON_RULES}>
        <Input.TextArea rows={2} maxLength={500} showCount />
      </Form.Item>
      <p className="mt-0 mb-2 text-sm font-medium">Thông tin người mua (để nguyên nếu không đổi)</p>
      {walkIn ? <p className="mt-0 text-xs text-muted">Hóa đơn cũ ghi khách lẻ không lấy hóa đơn; nhập bên dưới nếu muốn đổi.</p> : null}
      <BuyerFields required={false} />
    </FormModal>
  );
}
