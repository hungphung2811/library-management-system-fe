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
  const r = { id: uuid(), [k.field]: label, description: null, parentId: null, parentName: null, active: true, tenantId: TENANT, ...(kind === "shelf-locations" ? { floor: null, zone: null, capacity: null } : {}), ...extra };
  STORE[kind].push(r);
  return r;
};
const fiction = make("categories", "Văn học");
make("categories", "Tiểu thuyết", { parentId: fiction.id, parentName: fiction.name });
make("authors", "Nguyễn Du", { birthYear: 1765, deathYear: 1820, nationality: "Việt Nam", website: "https://example.org/nguyen-du" });
make("authors", "Tác giả chưa nhập thêm");
make("publishers", "Nhà xuất bản Kim Đồng", { country: "Việt Nam", foundedYear: 1957, website: "https://nxbkimdong.com.vn", address: "55 Quang Trung, Hà Nội" });
make("shelf-locations", "A1-01", { floor: "Tầng 1", zone: "Khu Văn học", capacity: 50 });

// Field bổ sung (hợp đồng docs/api/catalog-copy-reference-extra-fields.md): PUT/POST thay toàn bộ;
// tác giả/NXB chỉ trả field có giá trị, vị trí kệ trả null khi chưa nhập.
const EXTRA = {
  authors: ["birthYear", "deathYear", "nationality", "photoUrl", "website"],
  publishers: ["country", "foundedYear", "website", "address"],
  "shelf-locations": ["floor", "zone", "capacity"],
};
const THIS_YEAR = new Date().getFullYear();
const URL_RE = /^https?:\/\/\S+$/i;
const clean = (v) => (v === "" || v == null ? null : typeof v === "string" ? v.trim() || null : v);
const extras = (kind, body) => Object.fromEntries((EXTRA[kind] ?? []).map((f) => [f, clean(body[f])]));
/** Trả null nếu hợp lệ; ngược lại { status, body }. */
const checkExtras = (kind, e) => {
  const bad = [];
  const maxLen = { nationality: 100, country: 100, photoUrl: 500, website: 500, address: 500, floor: 20, zone: 50 };
  for (const [f, max] of Object.entries(maxLen)) if (e[f] != null && String(e[f]).length > max) bad.push(`${f}: tối đa ${max} ký tự`);
  for (const f of ["photoUrl", "website"]) if (e[f] != null && !URL_RE.test(e[f])) bad.push(`${f}: phải là địa chỉ http/https`);
  const yr = (f, lo) => e[f] != null && !(Number.isInteger(e[f]) && e[f] >= lo && e[f] <= THIS_YEAR) && bad.push(`${f}: năm từ ${lo} đến ${THIS_YEAR}`);
  yr("birthYear", 1);
  yr("deathYear", 1);
  yr("foundedYear", 1400);
  if (e.capacity != null && !(Number.isInteger(e.capacity) && e.capacity >= 1 && e.capacity <= 100000)) bad.push("capacity: từ 1 đến 100000");
  if (bad.length) return { status: 400, body: { code: "VALIDATION_FAILED", message: "Dữ liệu không hợp lệ", details: bad } };
  if (kind === "authors" && e.birthYear != null && e.deathYear != null && e.deathYear < e.birthYear) {
    return { status: 422, body: { code: "INVALID_AUTHOR", message: "Năm mất không được nhỏ hơn năm sinh" } };
  }
  return null;
};

const view = (kind, r) => {
  if (kind === "authors" || kind === "publishers") {
    const out = { ...r };
    for (const f of EXTRA[kind]) if (out[f] == null) delete out[f];
    return out;
  }
  return r;
};

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
    return r ? send(200, view(kind, r)) : send(404, { code: k.nf, message: "Không tìm thấy" }), true;
  }
  if (method === "POST" && !id) {
    if (!key("create")) return true;
    const label = String(body[k.field] ?? "").trim();
    if (!label) return send(400, { code: "VALIDATION_FAILED", message: "Dữ liệu không hợp lệ", details: [`${k.field}: không được để trống`] }), true;
    if (rows.some((r) => norm(r[k.field]) === norm(label))) return send(409, { code: k.dup, message: "Trùng" }), true;
    const parent = kind === "categories" && body.parentId ? rows.find((r) => r.id === body.parentId) : null;
    if (parent?.parentId) return send(422, { code: "CATEGORY_TOO_DEEP", message: "Quá 2 cấp" }), true;
    const ex = extras(kind, body);
    const bad = checkExtras(kind, ex);
    if (bad) return send(bad.status, bad.body), true;
    return send(201, view(kind, make(kind, label, { description: body.description ?? null, parentId: parent?.id ?? null, parentName: parent?.name ?? null, ...ex }))), true;
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
    const ex = extras(kind, body);
    const bad = checkExtras(kind, ex);
    if (bad) return send(bad.status, bad.body), true;
    Object.assign(r, { [k.field]: label, description: body.description ?? null, ...ex, ...(kind === "categories" ? { parentId: parent?.id ?? null, parentName: parent?.name ?? null } : {}) });
    return send(200, view(kind, r)), true;
  }
  return false;
}
