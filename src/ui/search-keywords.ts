/**
 * Từ khóa phụ (tiếng Anh và đồng nghĩa tiếng Việt) cho ô tìm nhanh, khớp theo đường dẫn đích để dùng được cho cả menu mặc định
 * lẫn menu động từ BE. Ngoài bảng này, ô tìm còn tự dùng chính đường dẫn ("/admin/users" thành "admin users") nên phần lớn
 * từ tiếng Anh đã khớp sẵn; ở đây chỉ khai báo từ đồng nghĩa và cách gọi khác. Thêm trang mới: thêm một dòng vào đây (có hay
 * không đều không làm hỏng ô tìm). So khớp bỏ dấu và hoa thường nên không cần viết biến thể có dấu.
 */
const KEYWORDS: Record<string, string> = {
  "/": "home dashboard overview tong quan trang chu",
  "/catalog": "books book catalog library title sach danh muc kho sach tim sach",
  "/catalog/barcode": "barcode scan scanner copy lookup ma vach quet bar code ban sao",
  "/circulation": "circulation lending loan borrow muon tra",
  "/circulation/borrow": "borrow lend checkout issue loan lap phieu muon cho muon",
  "/circulation/return": "return checkin check in receive lost nhan tra tra sach mat sach",
  "/circulation/mine": "my loans mine my borrowings phieu cua toi sach toi muon",
  "/circulation/borrowings": "borrowings loans history search lookup tra cuu phieu lich su muon",
  "/circulation/reservations": "reservations reserve hold queue dat truoc giu cho hang doi",
  "/circulation/fines": "fines fine penalty overdue late fee phat qua han tien phat",
  "/sales": "sales shop store ban hang cua hang",
  "/sales/pos": "pos point of sale counter cashier checkout ban tai quay thu ngan",
  "/sales/orders": "orders order purchase invoice don hang hoa don",
  "/sales/contacts": "contacts customer enquiry message lien he khach hang tin nhan",
  "/sales/refunds": "refunds refund return money back hoan tien tra hang",
  "/sales/audit": "audit log history activity sales nhat ky ban hang lich su",
  "/sales/stock": "stock inventory warehouse items ton kho hang hoa kiem kho",
  "/sales/receipts": "receipts goods receipt import purchase inbound nhap kho nhap hang phieu nhap",
  "/sales/suppliers": "suppliers supplier vendor provider nha cung cap nha phan phoi",
  "/sales/settings": "settings config configuration sales cau hinh thiet lap ban hang",
  "/admin": "admin administration management quan tri",
  "/admin/users": "users user accounts account people staff member readers nguoi dung tai khoan nhan vien doc gia thanh vien",
  "/admin/roles": "roles role permissions permission access rights authorization vai tro quyen phan quyen",
  "/admin/departments": "departments department team organization unit phong ban bo phan don vi",
  "/admin/audit-logs": "audit logs log activity history trail nhat ky hoat dong lich su thao tac",
  "/admin/menus": "menus menu navigation sidebar links danh muc dieu huong",
  "/admin/contract": "contract subscription plan license billing hop dong goi dich vu",
  "/admin/storefront-origins": "website storefront origin domain cors shop online trang web ten mien",
  "/platform": "platform saas operator nen tang van hanh",
  "/platform/onboarding": "onboarding new customer deploy setup wizard provision trien khai khach moi tao khach",
  "/platform/tenants": "tenants tenant customers clients organizations units don vi khach thue",
  "/platform/contracts": "contracts expiring renewal subscription hop dong sap het han gia han",
  "/platform/organizations": "organizations organization group company to chuc nhom",
  "/platform/cms-pages": "cms pages website content landing trang website noi dung",
  "/platform/contact-requests": "contact requests leads enquiries inbox yeu cau lien he khach",
  "/profile": "profile me account my info ho so ca nhan",
  "/notifications": "notifications alerts messages inbox thong bao",
};

/** Bỏ dấu tiếng Việt và chữ hoa để so khớp "users" lẫn "tra phieu" với "Tra phiếu mượn". */
export const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase();

/** Chuỗi phụ dùng để tìm một trang: từ khóa khai báo và đường dẫn tách chữ (không phần query/hash). Đã bỏ dấu. */
export function searchText(href: string): string {
  const path = href.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  const words = path.replace(/[/_-]+/g, " ");
  return fold(`${KEYWORDS[path] ?? ""} ${words}`);
}
