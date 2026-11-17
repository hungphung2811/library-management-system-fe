// Mock pha 2 của module bán hàng: đơn online (máy trạng thái), thanh toán, trả hàng (trong hạn, quá hạn), hoàn tiền, nhật ký.
// Theo docs/api/sales.md (phần "Pha 2") của repo BE. Dùng chung trạng thái với sales.mjs (truyền qua `S`).
// Khách đặt hàng qua customer-api (ngoài FE nhân viên) nên mock có endpoint dựng đơn sẵn: POST /api/sales/_mock/orders (không kiểm khóa).

const ACTIVE = ["PENDING_CONFIRMATION", "CONFIRMED", "READY_FOR_PICKUP", "SHIPPING"];

export function createPhase2(S) {
  const { K, STOCK, ORDERS, ORDER_PII, RETURNS, AUDIT, audit, entry, stockView, page, uuid, now, getSettings, orderView, USERS } = S;
  const REFUNDS = [];
  let seq = 0;
  let retSeq = 0;

  const disc = (d, base) => (!d ? 0 : d.type === "PERCENT" ? Math.floor((base * d.value) / 10000) : d.value);

  /** Tính lại các dòng và tổng đơn theo giảm giá (thay toàn bộ) và phí ship; phí ship không chịu VAT. Trả mã lỗi nếu vượt. */
  function recalc(o, orderDiscount, lineDiscounts) {
    const settings = getSettings();
    let subtotal = 0;
    let lineDisc = 0;
    for (const l of o.lines) {
      const gross = l.unitPrice * l.quantity;
      const d = disc(lineDiscounts.find((x) => x.lineNo === l.lineNo)?.discount, gross);
      if (d > gross) return "DISCOUNT_EXCEEDS_AMOUNT";
      l.lineDiscount = d;
      subtotal += gross;
      lineDisc += d;
    }
    const orderDisc = disc(orderDiscount, subtotal - lineDisc);
    if (orderDisc > subtotal - lineDisc) return "DISCOUNT_EXCEEDS_AMOUNT";
    let left = orderDisc;
    let vatTotal = 0;
    o.lines.forEach((l, i) => {
      const gross = l.unitPrice * l.quantity;
      const base = gross - l.lineDiscount;
      const alloc = i === o.lines.length - 1 ? left : Math.min(left, Math.floor((orderDisc * base) / Math.max(1, subtotal - lineDisc)));
      left -= alloc;
      l.allocatedOrderDiscount = alloc;
      l.amount = base - alloc;
      l.vatAmount = Math.floor((l.amount * settings.vatRateBps) / 10000);
      l.lineTotal = l.amount + l.vatAmount;
      vatTotal += l.vatAmount;
    });
    o.subtotal = subtotal;
    o.discountTotal = lineDisc + orderDisc;
    o.vatTotal = vatTotal;
    o.grandTotal = o.lines.reduce((a, l) => a + l.lineTotal, 0) + o.shippingFee;
    return null;
  }

  function buildOrder(b) {
    const settings = getSettings();
    const titleId = b.titleId ?? [...STOCK.keys()][0];
    const q = b.quantity ?? 1;
    const unitPrice = stockView(titleId).effectivePrice;
    const id = uuid();
    const created = new Date(Date.now() - (b.ageHours ?? 0) * 3600_000).toISOString();
    const o = {
      id, orderNo: `OL-${String(++seq).padStart(6, "0")}`, channel: b.channel ?? "ONLINE", status: b.status ?? "PENDING_CONFIRMATION", paymentStatus: b.paid ? "PAID" : "UNPAID",
      paymentMethod: b.paymentMethod ?? "BANK_TRANSFER", fulfilment: b.fulfilment ?? "DELIVERY", customerUserId: uuid(), vatRateBps: settings.vatRateBps,
      pricesIncludeVat: settings.pricesIncludeVat, currency: "VND", subtotal: 0, discountTotal: 0, vatTotal: 0, shippingFee: 0, grandTotal: 0,
      createdAt: created, confirmedAt: null, paidAt: null, completedAt: null, cancelledAt: null, cancelReason: null, exchangeOfReturnId: null, version: 0,
      lines: [{ id: uuid(), lineNo: 1, titleId, titleName: stockView(titleId).titleName ?? "", isbn: null, quantity: q, unitPrice, lineDiscount: 0, allocatedOrderDiscount: 0, amount: 0, vatAmount: 0, lineTotal: 0 }],
      _orderDiscount: 0, _taxable: 0,
    };
    recalc(o, undefined, []);
    o._taxable = o.subtotal - o.discountTotal;
    if (o.status !== "PENDING_CONFIRMATION") o.confirmedAt = created;
    if (o.paymentStatus === "PAID") o.paidAt = created;
    const s = STOCK.get(titleId);
    // Đơn dựng sẵn không được làm cạn tồn của các test khác dùng chung mock: tự bổ sung khi còn ít.
    if (s.onHand - s.reserved < q + 5) {
      s.onHand += 50;
      s.ledger.push(entry(titleId, "RECEIPT", 50, "Bổ sung tồn cho đơn dựng sẵn"));
    }
    if (["PENDING_CONFIRMATION", "CONFIRMED", "READY_FOR_PICKUP"].includes(o.status)) {
      s.reserved += q;
      s.ledger.push(entry(titleId, "RESERVE", 0, null, { refType: "ORDER", refId: id, deltaReserved: q }));
    } else {
      s.onHand -= q;
      s.ledger.push(entry(titleId, o.status === "COMPLETED" ? "SALE" : "FULFIL", -q, null, { refType: "ORDER", refId: id }));
    }
    if (o.status === "COMPLETED") o.completedAt = new Date(Date.now() - (b.completedAgoDays ?? 0) * 86400_000).toISOString();
    if (o.channel === "ONLINE") ORDER_PII.set(id, { name: b.recipient?.name ?? "Nguyễn Văn Khách", phone: b.recipient?.phone ?? "0912345678", address: b.recipient?.address ?? "12 Lê Lợi, Quận 1, TP Hồ Chí Minh" });
    ORDERS.unshift(o);
    return o;
  }

  const returnedQty = (orderId) => {
    const m = {};
    for (const r of RETURNS.filter((x) => x.orderId === orderId)) for (const l of r.lines) m[l.orderLineId] = (m[l.orderLineId] ?? 0) + l.quantity;
    return m;
  };

  return function handle({ method, url, body, send, requireKey, caller, err }) {
    const p = url.pathname;
    const sp = url.searchParams;
    let m;
    const invalid = (...d) => err(400, "VALIDATION_FAILED", "Dữ liệu chưa hợp lệ", d);
    const conflict = (msg = "Đơn đã được thao tác hoặc không còn ở trạng thái này") => err(409, "ORDER_STATE_CONFLICT", msg);
    const staleVersion = (o) => body.version != null && body.version !== o.version;
    const touch = (o) => {
      o.version += 1;
      return o;
    };

    // ---- Dựng đơn sẵn (thay cho khách đặt hàng qua customer-api) ----
    if (p === "/api/sales/_mock/orders" && method === "POST") return send(201, orderView(buildOrder(body))), true;

    // ---- Thao tác đơn ----
    if ((m = p.match(/^\/api\/sales\/orders\/([^/]+)\/(confirmation|discount|payment|ready-for-pickup|shipping|completion|cancellation)$/)) && method === "POST") {
      const [, id, op] = m;
      const key = { confirmation: K.ORDER_CONFIRM, discount: K.ORDER_DISCOUNT, payment: K.ORDER_PAID, "ready-for-pickup": K.ORDER_READY, shipping: K.ORDER_SHIPPING, completion: K.ORDER_COMPLETE, cancellation: K.ORDER_CANCEL }[op];
      if (!requireKey(key)) return true;
      const o = ORDERS.find((x) => x.id === id);
      if (!o) return err(404, "ORDER_NOT_FOUND", "Không có đơn hàng");
      if (staleVersion(o)) return conflict();
      const s = STOCK.get(o.lines[0].titleId);
      const q = o.lines[0].quantity;
      const ref = { refType: "ORDER", refId: o.id };
      if (op === "confirmation") {
        if (o.status !== "PENDING_CONFIRMATION") return conflict();
        let fee = body.shippingFee;
        if (o.fulfilment === "PICKUP") {
          if (fee > 0) return err(400, "INVALID_REQUEST", "Nhận tại cửa hàng không có phí vận chuyển");
          fee = 0;
        } else fee = fee ?? getSettings().fixedShippingFee;
        o.shippingFee = fee;
        o.grandTotal = o.lines.reduce((a, l) => a + l.lineTotal, 0) + fee;
        Object.assign(o, { status: "CONFIRMED", confirmedAt: now() });
        audit(caller, "ORDER_CONFIRMED", "ORDER", o.id, { shippingFee: fee, grandTotal: o.grandTotal });
      } else if (op === "discount") {
        if (!(o.channel === "ONLINE" && o.paymentStatus === "UNPAID" && ["PENDING_CONFIRMATION", "CONFIRMED"].includes(o.status))) return conflict();
        const bad = recalc(o, body.orderDiscount, body.lineDiscounts ?? []);
        if (bad) return err(400, bad, "Giảm giá vượt giá trị");
        o.grandTotal = o.lines.reduce((a, l) => a + l.lineTotal, 0) + o.shippingFee;
        audit(caller, "ORDER_DISCOUNT_APPLIED", "ORDER", o.id, { discountTotal: o.discountTotal });
      } else if (op === "payment") {
        if (!["BANK_TRANSFER", "CASH", "CARD", "COD"].includes(body.method)) return invalid("method: giá trị không hợp lệ");
        if (o.paymentStatus !== "UNPAID" || !["CONFIRMED", "READY_FOR_PICKUP", "SHIPPING"].includes(o.status)) return conflict();
        Object.assign(o, { paymentStatus: "PAID", paymentMethod: body.method, paidAt: now() });
        audit(caller, "ORDER_PAID", "ORDER", o.id, { amount: o.grandTotal, method: body.method, reference: body.reference ?? null });
      } else if (op === "ready-for-pickup") {
        if (o.status !== "CONFIRMED" || o.fulfilment !== "PICKUP") return conflict();
        o.status = "READY_FOR_PICKUP";
        audit(caller, "ORDER_READY_FOR_PICKUP", "ORDER", o.id);
      } else if (op === "shipping") {
        if (o.status !== "CONFIRMED" || o.fulfilment !== "DELIVERY") return conflict();
        s.onHand -= q;
        s.reserved -= q;
        s.ledger.push(entry(o.lines[0].titleId, "FULFIL", -q, null, { ...ref, deltaReserved: -q }));
        o.status = "SHIPPING";
        audit(caller, "ORDER_SHIPPING", "ORDER", o.id);
      } else if (op === "completion") {
        if (!["READY_FOR_PICKUP", "SHIPPING"].includes(o.status)) return conflict();
        if (o.paymentStatus === "UNPAID") return err(409, "ORDER_NOT_PAID", "Đơn chưa thu tiền");
        if (o.status === "READY_FOR_PICKUP") {
          s.onHand -= q;
          s.reserved -= q;
          s.ledger.push(entry(o.lines[0].titleId, "FULFIL", -q, null, { ...ref, deltaReserved: -q }));
        }
        Object.assign(o, { status: "COMPLETED", completedAt: now() });
        audit(caller, "ORDER_COMPLETED", "ORDER", o.id);
      } else {
        if (!String(body.reason ?? "").trim()) return invalid("reason: không được để trống");
        if (!ACTIVE.includes(o.status)) return conflict();
        if (o.status === "SHIPPING") {
          s.onHand += q;
          s.ledger.push(entry(o.lines[0].titleId, "CANCEL_RESTOCK", q, null, ref));
        } else {
          s.reserved -= q;
          s.ledger.push(entry(o.lines[0].titleId, "RELEASE", 0, null, { ...ref, deltaReserved: -q }));
        }
        Object.assign(o, { status: "CANCELLED", cancelledAt: now(), cancelReason: body.reason.trim() });
        if (o.paymentStatus === "PAID") {
          const r = { id: uuid(), orderId: o.id, source: "CANCELLATION", returnId: null, amount: o.grandTotal, status: "PENDING", method: null, reference: null, createdAt: now(), refundedBy: null, refundedAt: null, version: 0 };
          REFUNDS.unshift(r);
          audit(caller, "REFUND_CREATED", "REFUND", r.id, { orderId: o.id, amount: r.amount });
        }
        audit(caller, "ORDER_CANCELLED", "ORDER", o.id, { reason: body.reason.trim() });
      }
      touch(o);
      return send(200, orderView(o)), true;
    }

    // ---- Trả hàng ----
    if ((p === "/api/sales/returns" || p === "/api/sales/returns/late") && method === "POST") {
      const late = p.endsWith("/late");
      if (!requireKey(late ? K.RETURN_LATE : K.RETURN_CREATE)) return true;
      const dup = RETURNS.find((x) => x.clientRequestId === body.clientRequestId);
      if (dup) return send(201, dup), true;
      const o = ORDERS.find((x) => x.id === body.orderId);
      if (!o) return err(404, "ORDER_NOT_FOUND", "Không có đơn hàng");
      if (!Array.isArray(body.lines) || body.lines.length === 0) return invalid("lines: không được rỗng");
      if (!String(body.reason ?? "").trim()) return invalid("reason: không được để trống");
      if (late && !String(body.lateReason ?? "").trim()) return err(400, "LATE_REASON_REQUIRED", "Trả quá hạn bắt buộc có lý do");
      if (o.status !== "COMPLETED") return conflict("Đơn chưa hoàn tất");
      if (!["PAID", "PARTIALLY_REFUNDED"].includes(o.paymentStatus)) return err(409, "ORDER_NOT_PAID", "Đơn chưa thu tiền");
      const windowDays = getSettings().returnWindowDays;
      const daysSince = Math.floor((Date.now() - new Date(o.completedAt).getTime()) / 86400_000);
      const daysOverdue = Math.max(0, daysSince - windowDays);
      if (!late && daysOverdue > 0) return err(409, "RETURN_WINDOW_EXPIRED", "Quá hạn trả hàng", [`windowDays=${windowDays}`, `daysOverdue=${daysOverdue}`]);
      const done = returnedQty(o.id);
      const seen = new Set();
      const lines = [];
      for (const l of body.lines) {
        const ol = o.lines.find((x) => x.id === l.orderLineId);
        if (!ol || seen.has(l.orderLineId)) return invalid("lines: dòng không hợp lệ");
        seen.add(l.orderLineId);
        if (!(l.quantity >= 1) || !["RESTOCK", "WRITE_OFF"].includes(l.disposition)) return invalid("lines: số lượng hoặc tình trạng không hợp lệ");
        const remaining = ol.quantity - (done[ol.id] ?? 0);
        if (l.quantity > remaining) return err(409, "RETURN_QUANTITY_EXCEEDED", "Vượt số lượng còn trả được", [`orderLineId=${ol.id}`, `remaining=${remaining}`]);
        const last = l.quantity === remaining;
        const prior = Math.round(((done[ol.id] ?? 0) * ol.lineTotal) / ol.quantity);
        const refundAmount = last ? ol.lineTotal - prior : Math.round((ol.lineTotal * l.quantity) / ol.quantity);
        lines.push({ id: uuid(), orderLineId: ol.id, titleId: ol.titleId, quantity: l.quantity, disposition: l.disposition, refundAmount });
      }
      const rid = uuid();
      const refund = { id: uuid(), orderId: o.id, source: "RETURN", returnId: rid, amount: lines.reduce((a, l) => a + l.refundAmount, 0), status: "PENDING", method: null, reference: null, createdAt: now(), refundedBy: null, refundedAt: null, version: 0 };
      const ret = {
        id: rid, returnNo: `TH-${String(++retSeq).padStart(6, "0")}`, orderId: o.id, reason: body.reason.trim(), late, lateReason: late ? body.lateReason.trim() : null,
        daysOverdue: late ? daysOverdue : 0, refundTotal: refund.amount, refundId: refund.id, createdBy: USERS[caller]?.id ?? null, createdAt: now(), lines, clientRequestId: body.clientRequestId,
      };
      for (const l of lines) {
        const s = STOCK.get(l.titleId);
        s.onHand += l.quantity;
        s.ledger.push(entry(l.titleId, "RETURN", l.quantity, null, { refType: "RETURN", refId: rid }));
        if (l.disposition === "WRITE_OFF") {
          s.onHand -= l.quantity;
          s.ledger.push(entry(l.titleId, "WRITE_OFF", -l.quantity, "Trả hàng hỏng", { refType: "RETURN", refId: rid }));
        }
      }
      RETURNS.unshift(ret);
      REFUNDS.unshift(refund);
      audit(caller, "RETURN_CREATED", "RETURN", rid, { orderId: o.id, refundTotal: refund.amount });
      if (late) audit(caller, "RETURN_LATE_APPROVED", "RETURN", rid, { daysOverdue, lateReason: ret.lateReason });
      audit(caller, "REFUND_CREATED", "REFUND", refund.id, { orderId: o.id, amount: refund.amount });
      return send(201, ret), true;
    }
    if ((m = p.match(/^\/api\/sales\/returns\/([^/]+)$/)) && method === "GET") {
      if (!requireKey(K.RETURN_GET)) return true;
      const r = RETURNS.find((x) => x.id === m[1]);
      return r ? (send(200, r), true) : err(404, "RETURN_NOT_FOUND", "Không có phiếu trả");
    }
    if ((m = p.match(/^\/api\/sales\/orders\/([^/]+)\/returns$/)) && method === "GET") {
      if (!requireKey(K.RETURN_LIST)) return true;
      if (!ORDERS.some((x) => x.id === m[1])) return err(404, "ORDER_NOT_FOUND", "Không có đơn hàng");
      return send(200, RETURNS.filter((x) => x.orderId === m[1]).reverse()), true;
    }

    // ---- Hoàn tiền ----
    if (p === "/api/sales/refunds" && method === "GET") {
      if (!requireKey(K.REFUND_SEARCH)) return true;
      const st = sp.get("status");
      return send(200, page(REFUNDS.filter((r) => !st || r.status === st), sp)), true;
    }
    if ((m = p.match(/^\/api\/sales\/refunds\/([^/]+)\/completion$/)) && method === "POST") {
      if (!requireKey(K.REFUND_MARK)) return true;
      const r = REFUNDS.find((x) => x.id === m[1]);
      if (!r) return err(404, "REFUND_NOT_FOUND", "Không có khoản hoàn");
      if (!["BANK_TRANSFER", "CASH", "CARD", "COD"].includes(body.method)) return invalid("method: giá trị không hợp lệ");
      if (r.status !== "PENDING" || (body.version != null && body.version !== r.version)) return conflict("Khoản hoàn đã được xử lý");
      Object.assign(r, { status: "REFUNDED", method: body.method, reference: body.reference ?? null, refundedBy: USERS[caller]?.id ?? null, refundedAt: now(), version: r.version + 1 });
      const o = ORDERS.find((x) => x.id === r.orderId);
      if (o) {
        const total = REFUNDS.filter((x) => x.orderId === o.id && x.status === "REFUNDED").reduce((a, x) => a + x.amount, 0);
        o.paymentStatus = total >= o.grandTotal - o.shippingFee ? "REFUNDED" : "PARTIALLY_REFUNDED";
        touch(o);
      }
      audit(caller, "REFUND_COMPLETED", "REFUND", r.id, { orderId: r.orderId, amount: r.amount, method: r.method });
      return send(200, r), true;
    }

    // ---- Nhật ký ----
    if (p === "/api/sales/audit-log" && method === "GET") {
      if (!requireKey(K.AUDIT_SEARCH)) return true;
      const f = (k) => sp.get(k);
      const items = AUDIT.filter(
        (a) =>
          (!f("action") || a.action === f("action")) &&
          (!f("aggregateType") || a.aggregateType === f("aggregateType")) &&
          (!f("aggregateId") || a.aggregateId === f("aggregateId")) &&
          (!f("from") || a.occurredAt >= f("from")) &&
          (!f("to") || a.occurredAt < f("to")),
      );
      return send(200, page(items, sp)), true;
    }
    return false;
  };
}
