/** Đọc một tham số query dạng chuỗi đã cắt khoảng trắng. */
export function qp(sp: URLSearchParams, name: string): string {
  return sp.get(name)?.trim() ?? "";
}

/** `page` trên URL đánh số từ 1; giá trị sai thì về trang 1. */
export function pageNo(sp: URLSearchParams): number {
  const n = Number.parseInt(qp(sp, "page"), 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

/** Giữ dữ liệu trang trước khi đổi bộ lọc/trang, để ô tìm kiếm không bị dựng lại và không nháy skeleton. */
export { keepPreviousData } from "@tanstack/react-query";
