export type CmsStatus = "DRAFT" | "PUBLISHED" | "PUBLISHED_WITH_CHANGES";

/** Phần tử của GET /api/cms/pages (không có nội dung). */
export type CmsPageSummary = {
  id: string;
  slug: string;
  title: string;
  status: CmsStatus;
  sortOrder: number | null;
  publishedAt: string | null;
  version: number;
  updatedAt: string;
};

/** GET /api/cms/pages/{id}. */
export type CmsPage = CmsPageSummary & {
  bodyMarkdown: string;
  publishedTitle: string | null;
  publishedBodyMarkdown: string | null;
  createdAt: string;
  updatedBy: string | null;
};

export type ContactStatus = "NEW" | "IN_PROGRESS" | "HANDLED" | "SPAM";
export type BusinessType = "LIBRARY" | "BOOKSTORE" | "OTHER";

/** Dữ liệu cá nhân: các trường này là null sau khi ẩn danh. */
export type ContactRequestSummary = {
  id: string;
  fullName: string | null;
  email: string | null;
  organization: string | null;
  businessType: BusinessType;
  status: ContactStatus;
  createdAt: string;
  anonymizedAt: string | null;
};

export type ContactRequest = ContactRequestSummary & {
  phone: string | null;
  message: string | null;
  consentAt: string | null;
  version: number;
  handledBy: string | null;
  handledAt: string | null;
};

export type ContactRequestPage = { items: ContactRequestSummary[]; total: number; page: number; size: number };
