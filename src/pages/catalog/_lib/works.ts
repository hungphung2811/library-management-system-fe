/** Hình dạng dữ liệu `/api/works` (hợp đồng docs/api/catalog-works-series.md của BE). */
export type WorkKind = "SINGLE" | "COLLECTION";

export const WORK_KIND_LABELS: Record<WorkKind, string> = { SINGLE: "Tác phẩm đơn", COLLECTION: "Bộ nhiều phần" };

export type WorkSummary = {
  id: string;
  title: string;
  originalTitle?: string | null;
  author?: string | null;
  seriesId?: string | null;
  seriesName?: string | null;
  seriesNumber?: number | null;
  kind: WorkKind;
  editionCount: number;
  availableCopies: number;
  coverImageUrl?: string | null;
};

export type WorkEdition = {
  titleId: string;
  isbn?: string | null;
  name: string;
  format?: string | null;
  language?: string | null;
  translator?: string | null;
  edition?: string | null;
  publicationYear?: number | null;
  partNumber?: number | null;
  partLabel?: string | null;
  availableCopies: number;
};

export type WorkDetail = {
  id: string;
  title: string;
  originalTitle?: string | null;
  originalLanguage?: string | null;
  author?: string | null;
  authors?: { id: string; name: string }[] | null;
  description?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  seriesId?: string | null;
  seriesName?: string | null;
  seriesNumber?: number | null;
  seriesLabel?: string | null;
  kind: WorkKind;
  editions: WorkEdition[];
};

export type WorkPage = { items: WorkSummary[]; total: number; page: number; size: number };

export type WorkFormValues = {
  title: string;
  originalTitle?: string;
  originalLanguage?: string;
  author?: string;
  categoryId?: string;
  seriesId?: string;
  seriesNumber?: number | null;
  seriesLabel?: string;
  description?: string;
  kind: WorkKind;
};

const str = (v?: string | null) => (v && v.trim() ? v.trim() : null);

/** PUT thay toàn bộ (nên truyền lại `authorIds` hiện có, nếu không tác giả chuẩn bị xóa): ô trống gửi null; `seriesNumber` chỉ hợp lệ khi có bộ sách. */
export function workPayload(v: WorkFormValues, authorIds: string[] = []): Record<string, unknown> {
  const seriesId = v.seriesId ?? null;
  return {
    title: v.title.trim(),
    originalTitle: str(v.originalTitle),
    originalLanguage: str(v.originalLanguage)?.toLowerCase() ?? null,
    author: str(v.author),
    authorIds,
    categoryId: v.categoryId ?? null,
    seriesId,
    seriesNumber: seriesId ? (v.seriesNumber ?? null) : null,
    seriesLabel: seriesId ? str(v.seriesLabel) : null,
    description: str(v.description),
    kind: v.kind,
  };
}

export function workInitial(w?: WorkDetail | WorkSummary): Partial<WorkFormValues> {
  if (!w) return { kind: "SINGLE" };
  const d = w as WorkDetail;
  return {
    title: w.title,
    originalTitle: w.originalTitle ?? undefined,
    originalLanguage: d.originalLanguage ?? undefined,
    author: w.author ?? undefined,
    categoryId: d.categoryId ?? undefined,
    seriesId: w.seriesId ?? undefined,
    seriesNumber: w.seriesNumber ?? undefined,
    seriesLabel: d.seriesLabel ?? undefined,
    description: d.description ?? undefined,
    kind: w.kind,
  };
}
