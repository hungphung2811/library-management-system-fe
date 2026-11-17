import { useEffect, useRef, useState } from "react";
import { PERMISSIONS, apiFetch, can, useSession } from "@/api";
import { Form, Select } from "@/ui";
import type { TitleView } from "./types";

type Opt = { value: string; label: string };
type OptionRow = { id: string; name?: string; code?: string };

export const MAX_AUTHORS = 20;

/** Phần phân loại chuẩn của form sách (BE: publisherId, categoryId, authorIds). */
export type ClassificationValues = { publisherId?: string; categoryId?: string; authorIds?: string[] };

/** Giá trị ban đầu của form sửa từ sách hiện có (PUT thay toàn bộ phân loại nên luôn phải gửi lại đủ). */
export function classificationOf(b: TitleView): ClassificationValues {
  return {
    publisherId: b.publisherId ?? undefined,
    categoryId: b.categoryId ?? undefined,
    authorIds: (b.authors ?? []).map((a) => a.id),
  };
}

/** Thân JSON gửi BE: luôn đủ 3 trường (null/[] = gỡ). */
export function classificationBody(v: ClassificationValues) {
  return { publisherId: v.publisherId ?? null, categoryId: v.categoryId ?? null, authorIds: v.authorIds ?? [] };
}

/**
 * Select tải gợi ý từ `GET {path}/options?keyword=` (chỉ mục đang dùng, tối đa 200). `seed` là các mục đang gán sẵn
 * (có thể đã ngừng dùng nên không có trong gợi ý) để nhãn luôn hiển thị. Thiếu quyền `options` thì ô bị khóa, vẫn hiện giá trị hiện có.
 */
export function OptionSelect({
  path,
  seed,
  multiple,
  disabled,
  placeholder,
  value,
  onChange,
}: {
  path: `/api/${string}`;
  seed: Opt[];
  multiple?: boolean;
  disabled?: boolean;
  placeholder: string;
  value?: string | string[];
  onChange?: (v: string | string[] | undefined) => void;
}) {
  const [fetched, setFetched] = useState<Opt[]>([]);
  const [loading, setLoading] = useState(false);
  const asked = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const seq = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);

  const run = async (q: string) => {
    const n = ++seq.current;
    setLoading(true);
    try {
      const rows = await apiFetch<OptionRow[]>(`${path}/options${q ? `?keyword=${encodeURIComponent(q)}` : ""}`);
      if (n === seq.current) setFetched((Array.isArray(rows) ? rows : []).map((r) => ({ value: r.id, label: r.name ?? r.code ?? r.id })));
    } catch {
      if (n === seq.current) setFetched([]);
    } finally {
      if (n === seq.current) setLoading(false);
    }
  };

  const options = [...seed];
  for (const o of fetched) if (!options.some((x) => x.value === o.value)) options.push(o);

  return (
    <Select
      mode={multiple ? "multiple" : undefined}
      allowClear
      disabled={disabled}
      loading={loading}
      placeholder={placeholder}
      value={value}
      options={options}
      showSearch={{
        filterOption: false,
        onSearch: (q: string) => {
          clearTimeout(timer.current);
          timer.current = setTimeout(() => void run(q.trim()), 300);
        },
      }}
      onFocus={() => {
        if (!asked.current && !disabled) {
          asked.current = true;
          void run("");
        }
      }}
      onChange={(v) => onChange?.(v as string | string[] | undefined)}
      className="w-full"
    />
  );
}

/** Ba ô Nhà xuất bản, Thể loại, Tác giả (chuẩn) cho form tạo/sửa sách. `book` là sách đang sửa (để hiện nhãn có sẵn). */
export function ClassificationFields({ book }: { book?: TitleView }) {
  const s = useSession();
  const noPublisher = !can(s, PERMISSIONS.PUBLISHER_OPTIONS);
  const noCategory = !can(s, PERMISSIONS.CATEGORY_OPTIONS);
  const noAuthor = !can(s, PERMISSIONS.AUTHOR_OPTIONS);
  const lockedHint = "Bạn không có quyền xem danh sách để chọn; giá trị hiện có được giữ nguyên.";
  return (
    <>
      <Form.Item name="publisherId" label="Nhà xuất bản" extra={noPublisher ? lockedHint : undefined}>
        <OptionSelect
          path="/api/publishers"
          disabled={noPublisher}
          placeholder="Chọn nhà xuất bản (tùy chọn)"
          seed={book?.publisherId ? [{ value: book.publisherId, label: book.publisherName ?? book.publisherId }] : []}
        />
      </Form.Item>
      <Form.Item name="categoryId" label="Thể loại" extra={noCategory ? lockedHint : undefined}>
        <OptionSelect
          path="/api/categories"
          disabled={noCategory}
          placeholder="Chọn thể loại (tùy chọn)"
          seed={book?.categoryId ? [{ value: book.categoryId, label: book.categoryName ?? book.categoryId }] : []}
        />
      </Form.Item>
      <Form.Item
        name="authorIds"
        label="Tác giả (danh mục)"
        extra={noAuthor ? lockedHint : `Tùy chọn, tối đa ${MAX_AUTHORS} tác giả. Chuỗi «Tác giả» ở trên vẫn bắt buộc.`}
        rules={[{ type: "array", max: MAX_AUTHORS, message: `Tối đa ${MAX_AUTHORS} tác giả` }]}
      >
        <OptionSelect
          path="/api/authors"
          multiple
          disabled={noAuthor}
          placeholder="Chọn tác giả (tùy chọn)"
          seed={(book?.authors ?? []).map((a) => ({ value: a.id, label: a.name }))}
        />
      </Form.Item>
    </>
  );
}
