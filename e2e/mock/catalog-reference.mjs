// Mock danh mục chuẩn của catalog: /api/authors, /api/publishers, /api/categories, /api/shelf-locations
// (hợp đồng ở docs/api/catalog-reference.md của repo BE). Trạng thái trong bộ nhớ; chưa có spec dùng. Khóa: <Controller>/<method>.
const KINDS = {
  authors: { ctl: "AuthorController", field: "name", dup: "DUPLICATE_AUTHOR_NAME", nf: "AUTHOR_NOT_FOUND" },
  publishers: { ctl: "PublisherController", field: "name", dup: "DUPLICATE_PUBLISHER_NAME", nf: "PUBLISHER_NOT_FOUND" },
  categories: { ctl: "CategoryController", field: "name", dup: "DUPLICATE_CATEGORY_NAME", nf: "CATEGORY_NOT_FOUND" },
  "shelf-locations": { ctl: "ShelfLocationController", field: "code", dup: "DUPLICATE_SHELF_LOCATION_CODE", nf: "SHELF_LOCATION_NOT_FOUND" },
};

const uuid = () => crypto.randomUUID();
const TENANT = "00000000-0000-0000-0000-0000000000d1";
/** @type {Record<string, Array<Record<string, any>>>} */
const STORE = { authors: [], publishers: [], categories: [], "shelf-locations": [] };
const make = (kind, label, extra = {}) => {
  const k = KINDS[kind];
  const r = { id: uuid(), [k.field]: label, description: null, parentId: null, parentName: null, active: true, tenantId: TENANT, ...extra };
  STORE[kind].push(r);
  return r;
};
const fiction = make("categories", "Văn học");
make("categories", "Tiểu thuyết", { parentId: fiction.id, parentName: fiction.name });
make("authors", "Nguyễn Du");
make("publishers", "Nhà xuất bản Kim Đồng");
make("shelf-locations", "A1-01");

const view = (_kind, r) => r;

export function handle({ method, url, body, send, requireKey }) {
  const m = url.pathname.match(/^\/api\/(authors|publishers|categories|shelf-locations)(?:\/([^/]+))?(?:\/(options|status))?$/);
  if (!m) return false;
  const kind = m[1];
  const k = KINDS[kind];
  const rows = STORE[kind];
  const [, , id, sub] = m;
  const key = (name) => requireKey(`${k.ctl}/${name}`);
  const norm = (s) => String(s ?? "").trim().toLowerCase();

  if (method === "GET" && !id) {
    if (!key("search")) return true;
    const kw = norm(url.searchParams.get("keyword"));
    const act = url.searchParams.get("active");
    const list = rows.filter((r) => (!kw || norm(r[k.field]).includes(kw)) && (act == null || String(r.active) === act));
    const page = Math.max(0, Number(url.searchParams.get("page") ?? 0) || 0);
    const size = Math.min(100, Math.max(1, Number(url.searchParams.get("size") ?? 20) || 20));
    return send(200, { items: list.slice(page * size, page * size + size).map((r) => view(kind, r)), total: list.length, page, size }), true;
  }
  if (method === "GET" && id === "options") {
    if (!key("options")) return true;
    const kw = norm(url.searchParams.get("keyword"));
    const out = rows.filter((r) => r.active && (!kw || norm(r[k.field]).includes(kw))).map((r) => ({ id: r.id, [k.field]: r[k.field], ...(kind === "categories" ? { parentId: r.parentId } : {}) }));
    return send(200, out), true;
  }
  if (method === "GET" && id) {
    if (!key("get")) return true;
    const r = rows.find((x) => x.id === id);
    return r ? send(200, r) : send(404, { code: k.nf, message: "Không tìm thấy" }), true;
  }
  if (method === "POST" && !id) {
    if (!key("create")) return true;
    const label = String(body[k.field] ?? "").trim();
    if (!label) return send(400, { code: "VALIDATION_FAILED", message: "Dữ liệu không hợp lệ", details: [`${k.field}: không được để trống`] }), true;
    if (rows.some((r) => norm(r[k.field]) === norm(label))) return send(409, { code: k.dup, message: "Trùng" }), true;
    const parent = kind === "categories" && body.parentId ? rows.find((r) => r.id === body.parentId) : null;
    if (parent?.parentId) return send(422, { code: "CATEGORY_TOO_DEEP", message: "Quá 2 cấp" }), true;
    return send(201, make(kind, label, { description: body.description ?? null, parentId: parent?.id ?? null, parentName: parent?.name ?? null })), true;
  }
  const r = id ? rows.find((x) => x.id === id) : null;
  if (method === "PUT" && id && sub === "status") {
    if (!key("setStatus")) return true;
    if (!r) return send(404, { code: k.nf, message: "Không tìm thấy" }), true;
    r.active = body.active === true;
    return send(200, r), true;
  }
  if (method === "PUT" && id && !sub) {
    if (!key("update")) return true;
    if (!r) return send(404, { code: k.nf, message: "Không tìm thấy" }), true;
    const label = String(body[k.field] ?? "").trim();
    if (!label) return send(400, { code: "VALIDATION_FAILED", message: "Dữ liệu không hợp lệ", details: [`${k.field}: không được để trống`] }), true;
    if (rows.some((x) => x.id !== id && norm(x[k.field]) === norm(label))) return send(409, { code: k.dup, message: "Trùng" }), true;
    if (kind === "categories" && body.parentId === id) return send(422, { code: "CATEGORY_CYCLE", message: "Vòng cha-con" }), true;
    const parent = kind === "categories" && body.parentId ? rows.find((x) => x.id === body.parentId) : null;
    Object.assign(r, { [k.field]: label, description: body.description ?? null, ...(kind === "categories" ? { parentId: parent?.id ?? null, parentName: parent?.name ?? null } : {}) });
    return send(200, r), true;
  }
  return false;
}
