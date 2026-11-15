/** Hình dạng dữ liệu BE (lms-api) mà zone catalog dùng. */
export type TitleView = {
  id: string;
  name: string;
  author: string;
  isbn?: string | null;
  coverPrice: number;
  availableCopies: number;
};

export type CopyStatus = "AVAILABLE" | "LOANED" | "RESERVED" | "DAMAGED" | "LOST";

export type CopyView = { id: string; titleId: string; barcode: string; status: CopyStatus | string };

export type CopyDetailsView = CopyView & { titleName?: string; coverPrice?: number };
