import { useState } from "react";
import { Form, Input, InputNumber, Select, Tag } from "@/ui";
import type { BookFormat, TitleView } from "./types";

export const FORMAT_LABELS: Record<BookFormat, string> = { PAPERBACK: "Bìa mềm", HARDCOVER: "Bìa cứng", EBOOK: "Sách điện tử" };
export const LANGUAGE_LABELS: Record<string, string> = {
  vi: "Tiếng Việt",
  en: "Tiếng Anh",
  fr: "Tiếng Pháp",
  ja: "Tiếng Nhật",
  zh: "Tiếng Trung",
  ko: "Tiếng Hàn",
  de: "Tiếng Đức",
  ru: "Tiếng Nga",
  es: "Tiếng Tây Ban Nha",
};
export const MAX_TAGS = 10;
export const MAX_TAG_LENGTH = 50;

export const formatLabel = (f?: string | null) => (f ? (FORMAT_LABELS[f as BookFormat] ?? f) : null);
export const languageLabel = (l?: string | null) => (l ? (LANGUAGE_LABELS[l] ?? l) : null);
/** "Tên bộ - Tập N" (chỉ có tên bộ thì chỉ tên bộ; không có tên bộ thì null). */
export const seriesLabel = (b: Pick<TitleView, "series" | "seriesNumber">) =>
  b.series ? (b.seriesNumber != null ? `${b.series} - Tập ${b.seriesNumber}` : b.series) : null;

export type PublicationValues = {
  subtitle?: string;
  publicationYear?: number | null;
  edition?: string;
  language?: string;
  pageCount?: number | null;
  format?: BookFormat;
  translator?: string;
  series?: string;
  seriesNumber?: number | null;
  coverImageUrl?: string;
  tags?: string[];
};

export function publicationOf(b: TitleView): PublicationValues {
  return {
    subtitle: b.subtitle ?? undefined,
    publicationYear: b.publicationYear ?? undefined,
    edition: b.edition ?? undefined,
    language: b.language ?? undefined,
    pageCount: b.pageCount ?? undefined,
    format: (b.format as BookFormat | null | undefined) ?? undefined,
    translator: b.translator ?? undefined,
    series: b.series ?? undefined,
    seriesNumber: b.seriesNumber ?? undefined,
    coverImageUrl: b.coverImageUrl ?? undefined,
    tags: b.tags ?? [],
  };
}

const text = (s?: string) => {
  const t = s?.trim();
  return t ? t : null;
};

/** Thân JSON gửi BE: luôn đủ 11 trường (null/[] = xóa); số tập chỉ gửi khi có bộ sách. */
export function publicationBody(v: PublicationValues) {
  const series = text(v.series);
  return {
    subtitle: text(v.subtitle),
    publicationYear: v.publicationYear ?? null,
    edition: text(v.edition),
    language: v.language ?? null,
    pageCount: v.pageCount ?? null,
    format: v.format ?? null,
    translator: text(v.translator),
    series,
    seriesNumber: series ? (v.seriesNumber ?? null) : null,
    coverImageUrl: text(v.coverImageUrl),
    tags: (v.tags ?? []).map((t) => t.trim()).filter(Boolean),
  };
}

const maxLen = (n: number) => ({ max: n, message: `Tối đa ${n} ký tự` });

/** Khối "Thông tin xuất bản" (11 trường tùy chọn) cho form tạo/sửa sách. `book` là sách đang sửa (giữ ngôn ngữ lạ trong danh sách). */
export function PublicationFields({ book }: { book?: TitleView }) {
  const form = Form.useFormInstance();
  const series = Form.useWatch("series", form) as string | undefined;
  const [extraLang] = useState(() => (book?.language && !(book.language in LANGUAGE_LABELS) ? [book.language] : []));
  const languages = [
    ...Object.entries(LANGUAGE_LABELS).map(([value, name]) => ({ value, label: `${name} (${value})` })),
    ...extraLang.map((value) => ({ value, label: value })),
  ];
  return (
    <fieldset className="mt-2 border-0 p-0" aria-label="Thông tin xuất bản">
      <div className="mb-3 border-t border-gray-200 pt-3 font-medium">Thông tin xuất bản</div>
      <Form.Item name="subtitle" label="Phụ đề" rules={[maxLen(255)]}>
        <Input autoComplete="off" />
      </Form.Item>
      <div className="grid gap-x-4 sm:grid-cols-2">
        <Form.Item name="publicationYear" label="Năm xuất bản" rules={[{ type: "number", min: 1000, max: 2100, message: "Năm từ 1000 đến 2100" }]}>
          <InputNumber className="w-full" min={1000} max={2100} precision={0} />
        </Form.Item>
        <Form.Item name="edition" label="Lần tái bản" rules={[maxLen(50)]}>
          <Input autoComplete="off" placeholder="Ví dụ: Tái bản lần 2" />
        </Form.Item>
        <Form.Item name="language" label="Ngôn ngữ">
          <Select allowClear showSearch={{ optionFilterProp: "label" }} placeholder="Chọn ngôn ngữ" options={languages} />
        </Form.Item>
        <Form.Item name="pageCount" label="Số trang" rules={[{ type: "number", min: 1, max: 20000, message: "Số trang từ 1 đến 20000" }]}>
          <InputNumber className="w-full" min={1} max={20000} precision={0} />
        </Form.Item>
        <Form.Item name="format" label="Hình thức">
          <Select
            allowClear
            placeholder="Chọn hình thức"
            options={(Object.keys(FORMAT_LABELS) as BookFormat[]).map((value) => ({ value, label: FORMAT_LABELS[value] }))}
          />
        </Form.Item>
        <Form.Item name="translator" label="Dịch giả" rules={[maxLen(255)]}>
          <Input autoComplete="off" />
        </Form.Item>
        <Form.Item name="series" label="Bộ sách" rules={[maxLen(255)]}>
          <Input autoComplete="off" />
        </Form.Item>
        <Form.Item
          name="seriesNumber"
          label="Tập số"
          extra={series?.trim() ? undefined : "Nhập tên bộ sách trước."}
          rules={[{ type: "number", min: 1, max: 9999, message: "Tập từ 1 đến 9999" }]}
        >
          <InputNumber className="w-full" min={1} max={9999} precision={0} disabled={!series?.trim()} />
        </Form.Item>
      </div>
      <Form.Item
        name="coverImageUrl"
        label="Ảnh bìa (URL)"
        rules={[
          maxLen(500),
          { pattern: /^https?:\/\/\S+$/i, message: "Phải là địa chỉ http:// hoặc https://" },
        ]}
      >
        <Input autoComplete="off" placeholder="https://..." />
      </Form.Item>
      <Form.Item
        name="tags"
        label="Thẻ"
        extra={`Tối đa ${MAX_TAGS} thẻ, mỗi thẻ tối đa ${MAX_TAG_LENGTH} ký tự. Nhấn Enter để thêm.`}
        rules={[
          { type: "array", max: MAX_TAGS, message: `Tối đa ${MAX_TAGS} thẻ` },
          {
            validator: (_: unknown, v: string[] | undefined) =>
              (v ?? []).some((t) => t.trim().length > MAX_TAG_LENGTH)
                ? Promise.reject(new Error(`Mỗi thẻ tối đa ${MAX_TAG_LENGTH} ký tự`))
                : Promise.resolve(),
          },
        ]}
      >
        <Select mode="tags" tokenSeparators={[","]} open={false} placeholder="Nhập thẻ rồi Enter" />
      </Form.Item>
    </fieldset>
  );
}

/** Ảnh bìa có dự phòng khi URL null hoặc tải lỗi. */
export function CoverImage({ url, alt, className = "h-40 w-28" }: { url?: string | null; alt: string; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!url || failed === url) {
    return (
      <div
        role="img"
        aria-label="Chưa có ảnh bìa"
        data-testid="cover-fallback"
        className={`${className} flex shrink-0 items-center justify-center rounded border border-gray-200 bg-gray-50 px-1 text-center text-xs text-gray-400`}
      >
        Chưa có ảnh bìa
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(url)}
      className={`${className} shrink-0 rounded border border-gray-200 object-cover`}
    />
  );
}

export function TagList({ tags }: { tags?: string[] | null }) {
  if (!tags?.length) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {tags.map((t) => (
        <Tag key={t}>{t}</Tag>
      ))}
    </span>
  );
}
