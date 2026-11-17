import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Search, CornerDownLeft } from "lucide-react";
import { Input, Modal } from "./antd";
import type { VisibleNavLink } from "./nav-links";

type Entry = { href: string; label: string; section?: string };

/** Bỏ dấu tiếng Việt và chữ hoa để so khớp "tra phieu" với "Tra phiếu mượn". */
const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase();

/** Danh sách phẳng các trang đích: mục lá của sidebar (đã lọc theo quyền), nhóm không có con thì chính nó. */
function flatten(items: VisibleNavLink[]): Entry[] {
  return items.flatMap((l): Entry[] =>
    l.children ? l.children.map((c) => ({ href: c.href, label: c.label, section: l.label })) : [{ href: l.href, label: l.label }],
  );
}

const isMac = typeof navigator !== "undefined" && /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);

/**
 * Ô tìm nhanh ở thanh trên (Ctrl+K / ⌘K): bảng lệnh phía client, chỉ tìm trong các trang người dùng đang thấy ở sidebar
 * (đã lọc theo quyền), không gọi API. Chọn một dòng (Enter hoặc bấm) thì điều hướng bằng router.
 */
export function QuickSearch({ items }: { items: VisibleNavLink[] }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const entries = useMemo(() => flatten(items), [items]);
  const results = useMemo(() => {
    const k = fold(q.trim());
    return k ? entries.filter((e) => fold(`${e.label} ${e.section ?? ""}`).includes(k)) : entries;
  }, [entries, q]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [cursor, results]);

  const close = () => {
    setOpen(false);
    setQ("");
    setCursor(0);
  };
  const go = (e: Entry) => {
    close();
    void navigate(e.href);
  };

  return (
    <>
      <button
        type="button"
        aria-label="Tìm nhanh trang"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="flex h-8 cursor-pointer items-center gap-2 rounded-control border border-line bg-canvas px-2.5 text-body text-faint transition-colors hover:border-line-strong hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary motion-reduce:transition-none sm:w-56 lg:w-64"
      >
        <Search size={15} strokeWidth={1.75} aria-hidden className="shrink-0" />
        <span className="hidden flex-1 truncate text-left sm:block">Tìm nhanh trang…</span>
        <kbd className="hidden rounded-[5px] border border-line bg-surface px-1.5 font-sans text-[11px] leading-4 text-muted sm:block">
          {isMac ? "⌘K" : "Ctrl K"}
        </kbd>
      </button>

      <Modal
        open={open}
        onCancel={close}
        footer={null}
        closable={false}
        width={480}
        destroyOnHidden
        styles={{ body: { padding: 0 }, container: { padding: 0, overflow: "hidden" } }}
        style={{ top: 96 }}
        aria-label="Tìm nhanh trang"
        afterOpenChange={(o) => {
          if (o) document.getElementById("quick-search-input")?.focus();
        }}
      >
        <div className="border-b border-line p-3">
          <Input
            id="quick-search-input"
            variant="borderless"
            prefix={<Search size={16} strokeWidth={1.75} aria-hidden className="text-faint" />}
            placeholder="Nhập tên trang cần mở"
            aria-label="Nhập tên trang cần mở"
            autoComplete="off"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setCursor(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setCursor((c) => Math.min(c + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setCursor((c) => Math.max(c - 1, 0));
              } else if (e.key === "Enter" && results[cursor]) {
                e.preventDefault();
                go(results[cursor]);
              }
            }}
          />
        </div>
        {results.length === 0 ? (
          <p className="m-0 px-4 py-8 text-center text-body text-muted">Không có trang nào khớp.</p>
        ) : (
          <ul ref={listRef} className="m-0 max-h-80 list-none overflow-y-auto p-2">
            {results.map((e, i) => (
              <li key={e.href}>
                <button
                  type="button"
                  data-active={i === cursor}
                  onMouseMove={() => setCursor(i)}
                  onClick={() => go(e)}
                  className={`flex min-h-9 w-full cursor-pointer items-center gap-2 rounded-control border-0 px-3 py-1.5 text-left text-body ${
                    i === cursor ? "bg-primary-soft text-primary" : "bg-transparent text-ink"
                  }`}
                >
                  <span className="flex-1 truncate font-medium">{e.label}</span>
                  {e.section && <span className="text-caption text-muted">{e.section}</span>}
                  {i === cursor && <CornerDownLeft size={13} aria-hidden className="shrink-0" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </>
  );
}
