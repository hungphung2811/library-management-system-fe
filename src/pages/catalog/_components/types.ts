/** Hình dạng dữ liệu BE (lms-api) mà trang Sách dùng. */
export type BookFormat = "PAPERBACK" | "HARDCOVER" | "EBOOK";

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
  subtitle?: string | null;
  publicationYear?: number | null;
  edition?: string | null;
  language?: string | null;
  pageCount?: number | null;
  format?: BookFormat | null;
  translator?: string | null;
  workId?: string | null;
  workTitle?: string | null;
  series?: string | null;
  seriesNumber?: number | null;
  coverImageUrl?: string | null;
  tags?: string[] | null;
};

export type CopyStatus = "AVAILABLE" | "LOANED" | "RESERVED" | "DAMAGED" | "LOST";

export type AcquisitionSource = "PURCHASE" | "DONATION" | "EXCHANGE" | "OTHER";
export type ConditionGrade = "NEW" | "GOOD" | "FAIR" | "WORN";

/** 6 field nhập kho/tình trạng của bản sao (tùy chọn; null = chưa nhập). */
export type CopyAcquisition = {
  acquiredDate?: string | null;
  acquisitionSource?: AcquisitionSource | null;
  purchasePrice?: number | null;
  conditionGrade?: ConditionGrade | null;
  conditionNote?: string | null;
  lastInventoryDate?: string | null;
};

export type CopyView = CopyAcquisition & {
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
