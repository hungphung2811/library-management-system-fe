import { apiFetch } from "@/api";
import type { Page } from "./sales";

/** Hóa đơn VAT nội bộ (ADR-0030 gói A, docs/api/sales-invoices.md). Tiền là số nguyên đồng. */
export type InvoiceStatus = "DRAFT" | "ISSUED" | "CANCELLED";
export type InvoiceKind = "ORIGINAL" | "REPLACEMENT" | "ADJUSTMENT_DECREASE";

export const INVOICE_STATUS: Record<string, string> = { DRAFT: "Nháp", ISSUED: "Đã phát hành", CANCELLED: "Đã hủy" };
export const INVOICE_STATUS_COLOR: Record<string, string> = { DRAFT: "default", ISSUED: "success", CANCELLED: "error" };
export const INVOICE_KIND: Record<string, string> = {
  ORIGINAL: "Hóa đơn gốc",
  REPLACEMENT: "Hóa đơn thay thế",
  ADJUSTMENT_DECREASE: "Điều chỉnh giảm",
};

/** Câu cảnh báo mặc định khi chưa có phản hồi nào mang trường `notice` của BE. */
export const INVOICE_NOTICE_FALLBACK = "Hóa đơn nội bộ, không thay thế hóa đơn điện tử";
/** Tên BE ghi cho khách lẻ không lấy hóa đơn. */
export const NO_INVOICE_BUYER_NAME = "Người mua không lấy hóa đơn";

export type InvoiceParty = {
  legalName?: string | null;
  name?: string | null;
  company?: string | null;
  taxCode?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
};

export type InvoiceLine = {
  lineNo: number;
  itemName: string;
  isbn: string | null;
  unit: string | null;
  quantity: number;
  unitPrice: number;
  discount: number;
  amountBeforeVat: number;
  vatRateBps: number | null;
  vatAmount: number;
  lineTotal: number;
};

export type InvoiceAdjustmentRef = { id: string; invoiceNumber: string; grandTotal: number; issuedAt: string; returnId: string | null };

export type InvoiceView = {
  id: string;
  kind: InvoiceKind;
  status: InvoiceStatus;
  orderId: string;
  orderNo: string;
  returnId: string | null;
  originalInvoiceId: string | null;
  originalInvoiceNumber: string | null;
  templateCode: string;
  series: string;
  fiscalYear: number;
  invoiceNo: number | null;
  invoiceNumber: string | null;
  issuedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  seller: InvoiceParty;
  buyer: InvoiceParty;
  currency: string;
  pricesIncludeVat: boolean;
  paymentMethod: string | null;
  totalBeforeVat: number;
  vatTotal: number;
  grandTotal: number;
  amountInWords: string | null;
  createdAt: string;
  version: number;
  lines: InvoiceLine[];
  adjustments?: InvoiceAdjustmentRef[];
  notice?: string;
};

export type InvoiceSummary = {
  id: string;
  kind: InvoiceKind;
  status: InvoiceStatus;
  orderId: string;
  orderNo: string;
  originalInvoiceId: string | null;
  templateCode: string;
  series: string;
  invoiceNumber: string | null;
  buyerName: string | null;
  buyerCompany: string | null;
  buyerTaxCode: string | null;
  grandTotal: number;
  issuedAt: string | null;
  createdAt: string;
};

export type InvoiceRequestView = {
  id: string;
  orderId: string;
  buyerName: string | null;
  buyerCompany: string | null;
  buyerTaxCode: string | null;
  buyerAddress: string | null;
  buyerEmail: string | null;
  source: "POS" | "ONLINE";
  status: "OPEN" | "FULFILLED" | "WITHDRAWN";
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type InvoiceSettings = {
  sellerLegalName: string | null;
  sellerTaxCode: string | null;
  sellerAddress: string | null;
  sellerPhone: string | null;
  sellerEmail: string | null;
  templateCode: string | null;
  series: string | null;
  autoIssueOnCompletion: boolean;
  complete: boolean;
  version: number;
  updatedAt: string | null;
};

/** Người mua trong form (thân `buyer` của PUT invoice-request và POST replacement). */
export type BuyerFormValues = { name?: string; company?: string; taxCode?: string; address?: string; email?: string };

export const REQUEST_STATUS: Record<string, string> = { OPEN: "Chờ xuất", FULFILLED: "Đã xuất", WITHDRAWN: "Đã rút" };

/** MST người mua: 10 chữ số, 10-3 hoặc 12 chữ số (chỉ kiểm định dạng như BE). */
export const BUYER_TAX_CODE = /^(\d{10}|\d{10}-\d{3}|\d{12})$/;
/** MST người bán: 10 chữ số hoặc 10-3. */
export const SELLER_TAX_CODE = /^(\d{10}|\d{10}-\d{3})$/;
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Dọn khoảng trắng; trường rỗng bỏ khỏi thân gửi BE. */
export function cleanBuyer(v: BuyerFormValues): BuyerFormValues {
  const out: BuyerFormValues = {};
  for (const k of ["name", "company", "taxCode", "address", "email"] as const) {
    const t = v[k]?.trim();
    if (t) out[k] = t;
  }
  return out;
}

/** Tên hiển thị người mua trong danh sách. */
export const buyerLabel = (b: { name?: string | null; company?: string | null }) => b.company || b.name || "—";

/** Hóa đơn gốc/thay thế còn hiệu lực của đơn (tối đa một). */
export const isEffective = (i: { kind: InvoiceKind; status: InvoiceStatus }) => i.kind !== "ADJUSTMENT_DECREASE" && i.status === "ISSUED";

/** Các hóa đơn của một đơn: BE chưa có bộ lọc theo orderId nên tìm theo số đơn rồi lọc lại theo orderId. */
export async function fetchInvoicesOfOrder(orderId: string, orderNo: string): Promise<InvoiceSummary[]> {
  const p = await apiFetch<Page<InvoiceSummary>>(`/api/sales/invoices?keyword=${encodeURIComponent(orderNo)}&page=0&size=100`);
  return p.items.filter((i) => i.orderId === orderId);
}

/** Bản in HTML của hóa đơn (text/html), lấy bằng fetch có token; KHÔNG chèn vào DOM của app mà chỉ đưa vào iframe sandbox. */
export async function fetchInvoiceHtml(id: string): Promise<string> {
  const { blob } = await apiFetch<{ blob: Blob }>(`/api/sales/invoices/${encodeURIComponent(id)}/print`, { download: true });
  return blob.text();
}
