import type { TitleView } from "./types";

export const PAGE_SIZES = [10, 20, 50] as const;
export const DEFAULT_PAGE_SIZE = 20;

export const SORTS = [
  { value: "name", label: "Tên sách A → Z" },
  { value: "name-desc", label: "Tên sách Z → A" },
  { value: "author", label: "Tác giả A → Z" },
  { value: "available-desc", label: "Còn nhiều bản nhất" },
  { value: "available", label: "Còn ít bản nhất" },
] as const;
export type SortKey = (typeof SORTS)[number]["value"];

export const parseSort = (v: string | null): SortKey => (SORTS.some((s) => s.value === v) ? (v as SortKey) : "name");
export const parseSize = (v: string | null): number => {
  const n = Number(v);
  return (PAGE_SIZES as readonly number[]).includes(n) ? n : DEFAULT_PAGE_SIZE;
};
export const parsePage = (v: string | null): number => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= 1 ? n : 1;
};

const collator = new Intl.Collator("vi", { sensitivity: "base", numeric: true });

/** Lọc ISBN phía client (BE chưa có tham số isbn): bỏ dấu gạch/khoảng trắng khi so khớp. */
export function filterByIsbn(books: TitleView[], isbn: string): TitleView[] {
  const norm = (s: string) => s.replace(/[\s-]/g, "").toLowerCase();
  const k = norm(isbn);
  return k ? books.filter((b) => norm(b.isbn ?? "").includes(k)) : books;
}

export function sortBooks(books: TitleView[], sort: SortKey): TitleView[] {
  const by: Record<SortKey, (a: TitleView, b: TitleView) => number> = {
    name: (a, b) => collator.compare(a.name, b.name),
    "name-desc": (a, b) => collator.compare(b.name, a.name),
    author: (a, b) => collator.compare(a.author, b.author) || collator.compare(a.name, b.name),
    "available-desc": (a, b) => b.availableCopies - a.availableCopies || collator.compare(a.name, b.name),
    available: (a, b) => a.availableCopies - b.availableCopies || collator.compare(a.name, b.name),
  };
  return [...books].sort(by[sort]);
}
