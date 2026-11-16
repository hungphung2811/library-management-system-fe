// Bộ sinh dữ liệu giống thật cho E2E (tên người Việt, đầu sách đang lưu hành, mã thẻ và mã vạch đúng dạng...).
// Dùng được ở cả mock (.mjs) lẫn test (.ts). Mock gateway dùng chung cho 2 worker nên dữ liệu test tạo ra phải DUY NHẤT:
// mỗi lần gọi lấy một số thứ tự khác nhau (xen kẽ theo worker), không dùng Date.now() hay chuỗi ngẫu nhiên lộ ra ngoài.
// Giữ danh sách này KHÔNG chứa chuỗi con của dữ liệu seed mà test tìm bằng getByText/getByRole({ name }) (ví dụ
// "Lập trình Java", "Cấu trúc dữ liệu", "Khoa Công nghệ thông tin", "MEMBER", "CATALOGER", họ "Lê"/"Phạm" của độc giả seed).

// Hỗ trợ tối đa 4 worker chạy song song (playwright.config.ts đang dùng 2).
const WORKERS = 4;
const counters = {};
const workerIndex = () => Number(process.env.TEST_PARALLEL_INDEX ?? 0) % WORKERS;
/**
 * Số thứ tự duy nhất theo từng loại dữ liệu (xen kẽ theo worker nên hai worker không bao giờ trùng nhau), giữ nhỏ để
 * dữ liệu trông thật ("tái bản lần 2", "Cơ sở 3"). Mỗi tiến trình bắt đầu ở một chỗ hơi khác nhau để worker phải khởi
 * động lại giữa chừng ít khi lặp lại dữ liệu đã tạo.
 */
const nextSeq = (kind) => {
  counters[kind] ??= Math.floor(Math.random() * 4);
  return ++counters[kind] * WORKERS + workerIndex();
};
/** Hoán vị đơn giản: seq khác nhau cho chỉ số khác nhau (nguyên tố cùng nhau với kích thước không gian). */
const spread = (seq, size) => (seq * 37) % size;

const deaccent = (s) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

const HO = ["Nguyễn", "Trần", "Mai", "Trịnh", "Hoàng", "Huỳnh", "Phan", "Vũ", "Võ", "Đặng", "Bùi", "Đỗ", "Hồ", "Ngô", "Dương", "Lý"];
const NAM = { dem: ["Văn", "Hữu", "Minh", "Quốc", "Đức", "Gia", "Thanh"], ten: ["An", "Bình", "Dũng", "Hiếu", "Hùng", "Khoa", "Nam", "Phúc", "Quân", "Tuấn", "Thịnh", "Long"] };
const NU = { dem: ["Thị", "Ngọc", "Thu", "Hoài", "Mai", "Khánh"], ten: ["Anh", "Châu", "Giang", "Hà", "Hương", "Lan", "Linh", "Trang", "Thảo", "Vy", "Yến", "Ngân"] };

/** Người dùng/độc giả: tên đầy đủ, tên đăng nhập kiểu `an.nguyenvan` và email. */
export function person() {
  const seq = nextSeq("person");
  const g = seq % 2 === 0 ? NAM : NU;
  const i = spread(seq, HO.length * g.ten.length * g.dem.length);
  const ho = HO[i % HO.length];
  const ten = g.ten[Math.floor(i / HO.length) % g.ten.length];
  const dem = g.dem[Math.floor(i / (HO.length * g.ten.length)) % g.dem.length];
  const username = `${deaccent(ten)}.${deaccent(ho)}${deaccent(dem)}`;
  return { fullName: `${ho} ${dem} ${ten}`, username, email: `${username}@gmail.com` };
}

const BOOKS = [
  ["Dế Mèn phiêu lưu ký", "Tô Hoài", 52000],
  ["Số đỏ", "Vũ Trọng Phụng", 68000],
  ["Tắt đèn", "Ngô Tất Tố", 45000],
  ["Mắt biếc", "Nguyễn Nhật Ánh", 110000],
  ["Cho tôi xin một vé đi tuổi thơ", "Nguyễn Nhật Ánh", 95000],
  ["Nhà giả kim", "Paulo Coelho", 79000],
  ["Đắc nhân tâm", "Dale Carnegie", 86000],
  ["Sapiens: Lược sử loài người", "Yuval Noah Harari", 189000],
  ["Clean Code", "Robert C. Martin", 285000],
  ["Truyện Kiều", "Nguyễn Du", 60000],
  ["Lão Hạc", "Nam Cao", 38000],
  ["Vợ nhặt", "Kim Lân", 42000],
  ["Hoàng tử bé", "Antoine de Saint-Exupéry", 62000],
  ["Tuổi trẻ đáng giá bao nhiêu", "Rosie Nguyễn", 80000],
  ["Bố già", "Mario Puzo", 135000],
];

/** ISBN-13 hợp lệ (đầu 978-604 là mã nhóm xuất bản Việt Nam), chữ số kiểm tra tính đúng. */
function isbn13(n) {
  const body = `978604${String(n % 1_000_000).padStart(6, "0")}`;
  const sum = [...body].reduce((s, d, i) => s + Number(d) * (i % 2 === 0 ? 1 : 3), 0);
  return `${body}${(10 - (sum % 10)) % 10}`;
}

/**
 * Đầu sách: tên có thông tin lần tái bản (duy nhất theo số thứ tự: mỗi cặp lần/năm chỉ dùng một lần), tác giả,
 * ISBN-13 hợp lệ và giá bìa tròn nghìn.
 */
export function book() {
  const seq = nextSeq("book");
  const [title, author, price] = BOOKS[seq % BOOKS.length];
  const year = 2010 + (seq % 15);
  const lan = 1 + Math.floor(seq / 15);
  return { name: `${title}, tái bản lần ${lan} (${year})`, author, isbn: isbn13(seq * 7919 + 123457), coverPrice: price };
}

const ROLES = [
  ["THU_KHO_SACH", "Quản lý kho sách, nhập và kiểm kê định kỳ"],
  ["BIEN_MUC_VIEN", "Biên mục và cập nhật thông tin đầu sách"],
  ["QUAN_LY_DOC_GIA", "Cấp thẻ, gia hạn và khóa thẻ độc giả"],
  ["THU_THU_QUAY_MUON", "Lập phiếu mượn và nhận trả sách tại quầy"],
  ["SO_HOA_TAI_LIEU", "Số hóa và quản lý tài liệu điện tử"],
];

/** Vai trò: tên dạng mã viết hoa kèm cơ sở (duy nhất) và mô tả nghiệp vụ. */
export function roleSpec() {
  const seq = nextSeq("role");
  const [name, description] = ROLES[seq % ROLES.length];
  const cs = 1 + Math.floor(seq / ROLES.length);
  return { name: `${name}_CS${cs}`, description: `${description} (cơ sở ${cs})` };
}

const DEPARTMENTS = [
  ["PDTH", "Phòng Đọc tổng hợp"],
  ["PMVN", "Phòng Mượn về nhà"],
  ["KSNV", "Kho Sách Ngoại văn"],
  ["PSHTL", "Phòng Số hóa tài liệu"],
  ["PBM", "Phòng Biên mục"],
  ["PTLDP", "Phòng Tư liệu địa phương"],
];

/** Phòng ban của thư viện, kèm cơ sở để không trùng tên và không chứa tên phòng ban seed. */
export function departmentSpec() {
  const seq = nextSeq("department");
  const [code, name] = DEPARTMENTS[seq % DEPARTMENTS.length];
  const cs = 1 + Math.floor(seq / DEPARTMENTS.length);
  return { code: `${code}-CS${cs}`, name: `${name} (Cơ sở ${cs})` };
}

/** Số thẻ độc giả dạng TV{năm}-{6 chữ số}. */
export function readerCardNo() {
  const seq = nextSeq("card");
  return `TV26-${String(10000 + seq * 7).padStart(6, "0")}`;
}

/** Mã vạch bản sao: tiền tố TV và 8 chữ số, như nhãn dán sách thật. */
export function copyBarcode() {
  const seq = nextSeq("barcode");
  return `TV${String(200000 + seq * 13).padStart(8, "0")}`;
}
