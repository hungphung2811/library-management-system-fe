/** Hình dạng dữ liệu BE (lms-api) mà trang Sách dùng. */
export type TitleView = {
  id: string;
  name: string;
  author: string;
  isbn?: string | null;
  coverPrice: number;
  availableCopies: number;
  publisherId?: string | null;
  publisherName?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  authors?: { id: string; name: string }[] | null;
};

export type CopyStatus = "AVAILABLE" | "LOANED" | "RESERVED" | "DAMAGED" | "LOST";

export type CopyView = {
  id: string;
  titleId: string;
  barcode: string;
  status: CopyStatus | string;
  shelfLocationId?: string | null;
  shelfLocationCode?: string | null;
};

export type CopyDetailsView = CopyView & { titleName?: string; coverPrice?: number };

/** GET|PUT /api/books/{id}/preview: văn bản thuần, null = chưa nhập. */
export type TitlePreviewView = { id: string; name: string; description: string | null; previewText: string | null };
