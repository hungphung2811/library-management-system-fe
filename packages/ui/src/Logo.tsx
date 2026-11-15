/**
 * Biểu tượng thương hiệu: chữ "L" (Library) dựng từ sách. Một cuốn đứng làm nét dọc, hai cuốn nằm xếp chồng làm chân chữ,
 * một cuốn hổ phách nghiêng dựa vào góc. Nền xanh brand-500 (#1b84ff), điểm nhấn amber (#f5a524) trong tailwind.css.
 * Favicon (app/icon.svg của từng app) vẽ cùng hình này; sửa ở đây thì sửa cả bốn file icon.svg.
 */
export function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden className={className}>
      <rect width="40" height="40" rx="11" fill="#1b84ff" />
      {/* cuốn đứng + hai gân gáy */}
      <rect x="9.5" y="5.5" width="8.5" height="18" rx="2.2" fill="#fff" />
      <rect x="9.5" y="9.6" width="8.5" height="1.5" fill="#1b84ff" fillOpacity=".3" />
      <rect x="9.5" y="12.6" width="8.5" height="1.5" fill="#1b84ff" fillOpacity=".3" />
      {/* hai cuốn nằm làm chân chữ L */}
      <rect x="9.5" y="25" width="21.5" height="4.4" rx="1.8" fill="#fff" />
      <rect x="9.5" y="30.4" width="17" height="4.4" rx="1.8" fill="#fff" fillOpacity=".6" />
      {/* cuốn hổ phách nghiêng dựa vào góc */}
      <rect x="20" y="9.6" width="5.6" height="14.4" rx="1.6" fill="#f5a524" transform="rotate(11 20 24)" />
    </svg>
  );
}

/** Biểu tượng kèm tên; dùng ở đầu sidebar và panel đăng nhập. */
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <span className="flex items-center gap-3">
      <LogoMark size={size} />
      <span className="leading-none">
        <span className="block text-[19px] font-bold tracking-tight text-ink">
          Thư <span className="text-brand-500">viện</span>
        </span>
        <span className="mt-1 block text-[11px] font-medium tracking-wide text-muted">Quản lý mượn trả</span>
      </span>
    </span>
  );
}
