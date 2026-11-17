// Mock của nhóm nền tảng SaaS: /api/cms/pages*, /api/cms/contact-requests* (chỉ platform admin) và
// GET|PUT /api/books/{id}/preview (khóa TitleController/preview, TitleController/updatePreview).
// Hợp đồng theo docs/api/cms.md, customer-api-contact-saas.md mục 7, catalog-preview.md của BE. Trạng thái nằm trong bộ nhớ,
// dùng chung cho 2 worker: test tạo dữ liệu riêng (slug/đơn vị có hậu tố ngẫu nhiên) và không giả định số lượng bản ghi.
import { BOOKS, KEYS, USERS } from "./data.mjs";

const err = (send, status, code, message) => send(status, { code, message });
const cp = (s) => [...String(s ?? "").normalize("NFC")].length;
const norm = (s) => {
  const t = String(s ?? "").replace(/\r\n?/g, "\n").trim();
  return t === "" ? null : t;
};

// ---------- CMS ----------
const PAGES = new Map();
let seq = 0;
const now = () => new Date().toISOString();
const statusOf = (p) =>
  p.published == null ? "DRAFT" : p.published.title === p.title && p.published.bodyMarkdown === p.bodyMarkdown ? "PUBLISHED" : "PUBLISHED_WITH_CHANGES";
const summary = (p) => ({
  id: p.id, slug: p.slug, title: p.title, status: statusOf(p), sortOrder: p.sortOrder,
  publishedAt: p.publishedAt, version: p.version, updatedAt: p.updatedAt,
});
const full = (p) => ({
  ...summary(p), bodyMarkdown: p.bodyMarkdown,
  publishedTitle: p.published?.title ?? null, publishedBodyMarkdown: p.published?.bodyMarkdown ?? null,
  createdAt: p.createdAt, updatedBy: p.updatedBy,
});
const touch = (p) => ((p.version += 1), (p.updatedAt = now()));

// ---------- Yêu cầu liên hệ ----------
const CONTACTS = new Map();
const TRANSITIONS = { NEW: ["IN_PROGRESS", "HANDLED", "SPAM"], IN_PROGRESS: ["NEW", "HANDLED", "SPAM"], HANDLED: ["IN_PROGRESS"], SPAM: ["NEW"] };
const addContact = (o) => {
  const id = `f0000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
  const c = {
    id, fullName: "Nguyễn An", email: "an@example.vn", phone: "0912345678", organization: "Thư viện X", businessType: "LIBRARY",
    message: "Muốn dùng thử", consentAt: "2026-11-01T00:00:00Z", status: "NEW", version: 0, createdAt: "2026-11-01T00:00:00Z",
    handledBy: null, handledAt: null, anonymizedAt: null, ...o,
  };
  CONTACTS.set(id, c);
  return c;
};
const cSummary = (c) => ({
  id: c.id, fullName: c.fullName, email: c.email, organization: c.organization, businessType: c.businessType,
  status: c.status, createdAt: c.createdAt, anonymizedAt: c.anonymizedAt,
});
// Seed cố định (test đọc theo tên đơn vị) + 25 bản ghi để kiểm phân trang (20/trang) khi lọc status=SPAM.
const SEED_CONTACT = addContact({
  organization: "Hiệu sách Seed", businessType: "BOOKSTORE", message: "Dòng 1 <b>đậm</b>\nDòng 2 <script>alert(1)</script>",
  createdAt: "2026-10-01T00:00:00Z",
});
for (let i = 1; i <= 25; i++) {
  addContact({ organization: `Spam số ${String(i).padStart(2, "0")}`, status: "SPAM", createdAt: `2026-09-${String((i % 28) + 1).padStart(2, "0")}T00:00:00Z` });
}

// ---------- Preview đầu sách ----------
const PREVIEWS = new Map(); // titleId -> { description, previewText }

export function handle({ method, url, body, caller, send, requireKey }) {
  const p = url.pathname;
  let m;

  if ((m = p.match(/^\/api\/books\/([^/]+)\/preview$/))) {
    if (method === "GET") {
      if (!requireKey(KEYS.PREVIEW_VIEW)) return true;
    } else if (method === "PUT") {
      if (!requireKey(KEYS.PREVIEW_UPDATE)) return true;
    } else return false;
    const b = BOOKS.find((x) => x.id === m[1]);
    if (!b) return err(send, 404, "TITLE_NOT_FOUND", "Không tìm thấy đầu sách"), true;
    if (method === "PUT") {
      const description = norm(body.description);
      const previewText = norm(body.previewText);
      if (cp(description) > 500 || cp(previewText) > 2000) {
        return err(send, 400, "TITLE_PREVIEW_TOO_LONG", "Mô tả hoặc đoạn đọc thử quá dài"), true;
      }
      PREVIEWS.set(b.id, { description, previewText });
    }
    const v = PREVIEWS.get(b.id) ?? { description: null, previewText: null };
    return send(200, { id: b.id, name: b.name, ...v }), true;
  }

  // Chỉ có trong mock (BE thật không có): tạo yêu cầu liên hệ riêng cho từng test, tránh đua giữa 2 worker.
  if (method === "POST" && p === "/api/__test/contact-requests") return send(201, addContact(body)), true;
  if (method === "GET" && p === "/api/__test/last-contact-query") return send(200, LAST_QUERY), true;

  if (!p.startsWith("/api/cms/")) return false;
  // Chỉ platform admin: token không có tenantId và claim platformAdmin (system-service tự kiểm; không có khóa động).
  if (!caller) return err(send, 401, "UNAUTHENTICATED", "Chưa đăng nhập"), true;
  if (!USERS[caller].platformAdmin) return err(send, 403, "FORBIDDEN", "Chỉ platform admin"), true;

  // ----- trang CMS -----
  if (p === "/api/cms/pages" && method === "GET") {
    return send(200, [...PAGES.values()].map(summary)), true;
  }
  if (p === "/api/cms/pages" && method === "POST") {
    const d = [];
    if (typeof body.slug !== "string" || !/^[a-z0-9-]+$/.test(body.slug) || body.slug.length > 80) d.push("slug: sai định dạng");
    if (!body.title || String(body.title).length > 200) d.push("title: bắt buộc, tối đa 200 ký tự");
    if (typeof body.bodyMarkdown !== "string" || body.bodyMarkdown.length > 50000) d.push("bodyMarkdown: bắt buộc, tối đa 50000 ký tự");
    if (d.length) return send(400, { code: "VALIDATION_ERROR", message: "Dữ liệu không hợp lệ", details: d }), true;
    if ([...PAGES.values()].some((x) => x.slug === body.slug)) return err(send, 409, "CMS_SLUG_DUPLICATED", "Slug đã có"), true;
    const id = `e0000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
    const t = now();
    const page = {
      id, slug: body.slug, title: body.title, bodyMarkdown: body.bodyMarkdown, sortOrder: body.sortOrder ?? null,
      published: null, publishedAt: null, version: 0, createdAt: t, updatedAt: t, updatedBy: null,
    };
    PAGES.set(id, page);
    return send(201, full(page)), true;
  }
  if ((m = p.match(/^\/api\/cms\/pages\/([^/]+)(\/publication)?$/))) {
    const page = PAGES.get(m[1]);
    if (!page) return err(send, 404, "CMS_PAGE_NOT_FOUND", "Không có trang"), true;
    if (!m[2]) {
      if (method === "GET") return send(200, full(page)), true;
      if (method === "DELETE") return PAGES.delete(page.id), send(204), true;
      if (method === "PUT") {
        if (typeof body.version !== "number" || body.title == null || body.bodyMarkdown == null || body.sortOrder == null) {
          return send(400, { code: "VALIDATION_FAILED", message: "Thiếu trường", details: ["version: bắt buộc"] }), true;
        }
        if (body.version !== page.version) return err(send, 409, "CMS_VERSION_CONFLICT", "Phiên bản lệch"), true;
        Object.assign(page, { title: body.title, bodyMarkdown: body.bodyMarkdown, sortOrder: body.sortOrder });
        touch(page);
        return send(200, full(page)), true;
      }
    } else {
      if (method === "POST") {
        if (typeof body.version !== "number") return send(400, { code: "VALIDATION_FAILED", message: "Thiếu version", details: ["version: bắt buộc"] }), true;
        if (body.version !== page.version) return err(send, 409, "CMS_VERSION_CONFLICT", "Phiên bản lệch"), true;
        page.published = { title: page.title, bodyMarkdown: page.bodyMarkdown };
        page.publishedAt = now();
        touch(page);
        return send(200, full(page)), true;
      }
      if (method === "DELETE") {
        page.published = null;
        page.publishedAt = null;
        touch(page);
        return send(200, full(page)), true;
      }
    }
    return false;
  }

  // ----- yêu cầu liên hệ -----
  if (p === "/api/cms/contact-requests" && method === "GET") {
    const sp = url.searchParams;
    const status = sp.get("status");
    const from = sp.get("from");
    const to = sp.get("to");
    const page = Math.max(0, Number(sp.get("page") ?? 0) || 0);
    const size = Math.min(100, Math.max(1, Number(sp.get("size") ?? 20) || 20));
    // Lưu lại để test kiểm FE gửi ISO instant (from gồm, to không gồm).
    LAST_QUERY.query = url.search;
    const all = [...CONTACTS.values()]
      .filter((c) => (!status || c.status === status) && (!from || c.createdAt >= from) && (!to || c.createdAt < to))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return send(200, { items: all.slice(page * size, page * size + size).map(cSummary), total: all.length, page, size }), true;
  }
  if ((m = p.match(/^\/api\/cms\/contact-requests\/([^/]+)(\/status|\/anonymization)?$/))) {
    const c = CONTACTS.get(m[1]);
    if (!c) return err(send, 404, "CONTACT_REQUEST_NOT_FOUND", "Không có yêu cầu"), true;
    if (!m[2] && method === "GET") return send(200, c), true;
    if (m[2] === "/status" && method === "PUT") {
      if (c.anonymizedAt) return err(send, 409, "CONTACT_REQUEST_ANONYMIZED", "Đã ẩn danh"), true;
      if (typeof body.version !== "number" || !body.status) return send(400, { code: "VALIDATION_FAILED", message: "Thiếu trường" }), true;
      if (body.version !== c.version) return err(send, 409, "CONTACT_REQUEST_VERSION_CONFLICT", "Phiên bản lệch"), true;
      if (!TRANSITIONS[c.status].includes(body.status)) return err(send, 409, "CONTACT_STATUS_TRANSITION_INVALID", "Chuyển trạng thái không hợp lệ"), true;
      Object.assign(c, { status: body.status, handledBy: "platform", handledAt: now() });
      c.version += 1;
      return send(200, c), true;
    }
    if (m[2] === "/anonymization" && method === "POST") {
      if (!c.anonymizedAt) {
        Object.assign(c, { fullName: null, email: null, phone: null, message: null, anonymizedAt: now() });
        c.version += 1;
      }
      return send(200, c), true;
    }
  }
  return false;
}

/** Query string của lần GET danh sách yêu cầu liên hệ gần nhất (test đọc qua /api/__test/last-contact-query). */
const LAST_QUERY = { query: "" };
