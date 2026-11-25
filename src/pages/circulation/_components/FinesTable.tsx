import { useMemo } from "react";
import { apiFetch } from "@/api";
import { DataTable, FilterBar, Form, FormModal, Input, InputNumber, Select, Send, actionsColumn, formatMoney, useFilterParams, useFormModal, type FilterField } from "@/ui";
import { FINE_REASONS, shortId, type FineView } from "../_lib/circulation";
import { COMPENSATION_ERRORS } from "../_lib/compensation";

type RequestValues = { type: "WAIVE" | "REDUCE"; payableAmount?: number; reason: string };


/** Danh sách phạt của một độc giả (BE trả đủ, nên lọc/phân trang phía client): trạng thái, lý do, khoảng ngày phát sinh, tổng theo bộ lọc. */
export function FinesTable({ fines, canRequestAdjustment = false }: { fines: FineView[]; canRequestAdjustment?: boolean }) {
  const adjust = useFormModal<RequestValues, unknown, FineView>({
    title: "Yêu cầu điều chỉnh khoản phạt",
    okText: "Gửi yêu cầu",
    successMessage: "Đã gửi yêu cầu, chờ người có quyền duyệt.",
    initialValues: { type: "WAIVE" },
    invalidate: ["/api/fines", "/api/fines/adjustment-requests"],
    request: async (v, t) => {
      if (!t) return;
      await apiFetch(`/api/fines/${encodeURIComponent(t.id)}/adjustment-requests`, {
        method: "POST",
        json: { type: v.type, reason: v.reason.trim(), ...(v.type === "REDUCE" ? { payableAmount: v.payableAmount } : {}) },
      });
    },
  });
  const schema = useMemo<FilterField[]>(
    () => [
      {
        type: "select",
        name: "fineStatus",
        label: "Trạng thái",
        options: [
          { value: "UNPAID", label: "Chưa thanh toán" },
          { value: "PAID", label: "Đã thanh toán" },
          { value: "REDUCED", label: "Đã giảm" },
          { value: "WAIVED", label: "Đã miễn" },
        ],
      },
      {
        type: "multiselect",
        name: "reason",
        label: "Lý do",
        options: Object.entries(FINE_REASONS).map(([value, label]) => ({ value, label })),
      },
      { type: "dateRange", name: "created", label: "Ngày phát sinh" },
    ],
    [],
  );
  const f = useFilterParams(schema, { defaultSize: 20 });
  const status = f.str("fineStatus");
  const reasons = f.list("reason");
  const range = f.range("created");

  const filtered = fines.filter((x) => {
    const day = String(x.createdAt ?? "").slice(0, 10);
    return (
      (!status || x.status === status) &&
      (reasons.length === 0 || reasons.includes(x.reason)) &&
      (!range.from || day >= range.from) &&
      (!range.to || day <= range.to)
    );
  });
  const sum = (list: FineView[]) => list.reduce((a, x) => a + Number(x.amount), 0);
  const rows = filtered.map((x) => ({
    id: x.id,
    createdAt: x.createdAt,
    reason: FINE_REASONS[x.reason] ?? x.reason,
    borrowing: shortId(x.borrowingId),
    amount: x.amount,
    payable: x.payableAmount ?? x.amount,
    status: x.status,
    fine: x,
    paidAt: x.paidAt,
  }));

  return (
    <div className="flex flex-col gap-3">
      <FilterBar filters={f} total={rows.length} unit="khoản phạt" />
      <div className="text-sm text-muted" data-testid="fine-filter-total">
        Tổng theo bộ lọc: <b className="font-semibold text-ink">{formatMoney(sum(filtered))}</b>
        {" · "}chưa thanh toán: <b className="font-semibold text-ink">{formatMoney(sum(filtered.filter((x) => x.status === "UNPAID")))}</b>
      </div>
      <DataTable
        key={`${f.params.toString()}|${f.size}`}
        rowKey="id"
        rows={rows}
        mobileTitleKey="reason"
        pagination={{ mode: "client", pageSize: f.size, onSizeChange: f.setSize }}
        empty={
          f.hasFilter
            ? { title: "Không có khoản phạt nào khớp bộ lọc." }
            : { title: "Độc giả không có khoản phạt nào." }
        }
        columns={[
          { key: "createdAt", title: "Ngày phát sinh", dataIndex: "createdAt", kind: "date" },
          { key: "reason", title: "Lý do", dataIndex: "reason" },
          { key: "borrowing", title: "Phiếu mượn", dataIndex: "borrowing", kind: "mono" },
          { key: "amount", title: "Số tiền gốc", dataIndex: "amount", kind: "money", align: "right" },
          { key: "payable", title: "Phải thu", dataIndex: "payable", kind: "money", align: "right" },
          { key: "status", title: "Trạng thái", dataIndex: "status", kind: "status", statusDomain: "fine" },
          { key: "paidAt", title: "Ngày thanh toán", dataIndex: "paidAt", kind: "date" },
          ...(canRequestAdjustment
            ? [
                actionsColumn(
                  (r) => [
                    {
                      key: "adjust",
                      label: "Yêu cầu điều chỉnh",
                      icon: <Send size={16} />,
                      hidden: r.status !== "UNPAID",
                      onClick: () => adjust.openModal(r.fine as FineView),
                    },
                  ],
                  1,
                ),
              ]
            : []),
        ]}
      />
      <FormModal<RequestValues> {...adjust.modalProps}>
        {adjust.target && (
          <p className="mt-0 text-muted" data-testid="adjust-fine">
            Khoản phạt {FINE_REASONS[adjust.target.reason] ?? adjust.target.reason}: {formatMoney(adjust.target.amount)}. Yêu cầu cần người có quyền khác duyệt.
          </p>
        )}
        <Form.Item name="type" label="Hình thức" rules={[{ required: true }]}>
          <Select
            options={[
              { value: "WAIVE", label: "Miễn toàn phần" },
              { value: "REDUCE", label: "Giảm số phải thu" },
            ]}
          />
        </Form.Item>
        <Form.Item noStyle shouldUpdate={(a, b) => a.type !== b.type}>
          {({ getFieldValue }) =>
            getFieldValue("type") === "REDUCE" ? (
              <Form.Item
                name="payableAmount"
                label="Số phải thu mới (VND)"
                extra={adjust.target ? `Lớn hơn 0 và nhỏ hơn ${formatMoney(adjust.target.amount)}.` : undefined}
                rules={[
                  { required: true, message: "Nhập số phải thu mới" },
                  {
                    validator: (_, v) =>
                      v == null || (v > 0 && (!adjust.target || v < adjust.target.amount))
                        ? Promise.resolve()
                        : Promise.reject(new Error(COMPENSATION_ERRORS.INVALID_ADJUSTMENT_AMOUNT)),
                  },
                ]}
              >
                <InputNumber<number> className="w-full" min={1} step={1000} precision={0} />
              </Form.Item>
            ) : null
          }
        </Form.Item>
        <Form.Item name="reason" label="Lý do" rules={[{ required: true, whitespace: true, message: "Nhập lý do" }]}>
          <Input.TextArea rows={3} maxLength={500} showCount />
        </Form.Item>
      </FormModal>
    </div>
  );
}
