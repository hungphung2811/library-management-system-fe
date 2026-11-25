import { PERMISSIONS as P } from "@/api/permissions";
import type { ExcelImportConfig } from "./types";

const REF_HINT = "Nhập danh mục tham chiếu (tác giả, nhà xuất bản, thể loại, vị trí kệ) trước, rồi mới nhập sách. Dòng trùng dữ liệu đã có sẽ bị bỏ qua.";

/** Cấu hình từng loại nhập Excel (docs/api/{identity,catalog,sales}-import.md của BE). Khóa quyền khớp tên controller BE. */
export const EXCEL_IMPORTS = {
  users: {
    basePath: "/api/identity/imports/users",
    title: "Nhập người dùng từ Excel",
    description:
      "Tải file mẫu, điền sheet NguoiDung. Mật khẩu tạm do hệ thống tự sinh (mỗi người phải đổi ở lần đăng nhập đầu) và chỉ tải được MỘT lần ngay sau khi nhập xong. Vai trò và phòng ban gán sau.",
    uploadKey: P.USER_IMPORT_UPLOAD,
    confirmKey: P.USER_IMPORT_CONFIRM,
    credentialsKey: P.USER_IMPORT_CREDENTIALS,
    invalidate: ["/api/users"],
    noun: "người dùng",
  },
  titles: {
    basePath: "/api/catalog/imports/titles",
    title: "Nhập đầu sách và bản sao từ Excel",
    description: `${REF_HINT} Tệp có hai sheet: DauSach (ấn bản) và BanSao (bản sao, cần module Mượn trả).`,
    uploadKey: P.TITLE_IMPORT_UPLOAD,
    confirmKey: P.TITLE_IMPORT_CONFIRM,
    invalidate: ["/api/books", "/api/book-copies"],
    noun: "đầu sách và bản sao",
  },
  authors: {
    basePath: "/api/catalog/imports/authors",
    title: "Nhập tác giả từ Excel",
    description: "Tên tác giả trùng (không phân biệt hoa thường) với dữ liệu đã có sẽ bị bỏ qua.",
    uploadKey: P.AUTHOR_IMPORT_UPLOAD,
    confirmKey: P.AUTHOR_IMPORT_CONFIRM,
    invalidate: ["/api/authors"],
    noun: "tác giả",
  },
  publishers: {
    basePath: "/api/catalog/imports/publishers",
    title: "Nhập nhà xuất bản từ Excel",
    description: "Tên nhà xuất bản trùng với dữ liệu đã có sẽ bị bỏ qua.",
    uploadKey: P.PUBLISHER_IMPORT_UPLOAD,
    confirmKey: P.PUBLISHER_IMPORT_CONFIRM,
    invalidate: ["/api/publishers"],
    noun: "nhà xuất bản",
  },
  categories: {
    basePath: "/api/catalog/imports/categories",
    title: "Nhập thể loại từ Excel",
    description: "Thể loại cha có thể khai ngay trong tệp (tối đa 2 cấp). Tên trùng với dữ liệu đã có sẽ bị bỏ qua.",
    uploadKey: P.CATEGORY_IMPORT_UPLOAD,
    confirmKey: P.CATEGORY_IMPORT_CONFIRM,
    invalidate: ["/api/categories"],
    noun: "thể loại",
  },
  "shelf-locations": {
    basePath: "/api/catalog/imports/shelf-locations",
    title: "Nhập vị trí kệ từ Excel",
    description: "Mã vị trí kệ trùng với dữ liệu đã có sẽ bị bỏ qua.",
    uploadKey: P.SHELF_LOCATION_IMPORT_UPLOAD,
    confirmKey: P.SHELF_LOCATION_IMPORT_CONFIRM,
    invalidate: ["/api/shelf-locations"],
    noun: "vị trí kệ",
  },
  "stock-items": {
    basePath: "/api/sales/imports/stock-items",
    title: "Nhập mặt hàng và tồn đầu kỳ từ Excel",
    description:
      "Đầu sách phải có sẵn trong danh mục (nhập sách trước, khớp theo ISBN). Tồn đầu kỳ lớn hơn 0 được ghi thành một biến động điều chỉnh trong sổ tồn kho.",
    uploadKey: P.STOCK_IMPORT_UPLOAD,
    confirmKey: P.STOCK_IMPORT_CONFIRM,
    invalidate: ["/api/sales/stock-items"],
    noun: "mặt hàng",
  },
  suppliers: {
    basePath: "/api/sales/imports/suppliers",
    title: "Nhập nhà cung cấp từ Excel",
    description: "Tên nhà cung cấp trùng với dữ liệu đã có sẽ bị bỏ qua.",
    uploadKey: P.SUPPLIER_IMPORT_UPLOAD,
    confirmKey: P.SUPPLIER_IMPORT_CONFIRM,
    invalidate: ["/api/sales/suppliers"],
    noun: "nhà cung cấp",
  },
} as const satisfies Record<string, ExcelImportConfig>;
