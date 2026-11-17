export { Providers } from "./Providers";
export { AppShell } from "./Nav";
export { Logo, LogoMark } from "./Logo";
export { AuthShell, PageHeader } from "./Layout";
export * from "./antd";
export * from "./icons";
export { PageSkeleton } from "./PageSkeleton";
export { theme, brand } from "./theme";
export { DEFAULT_NAV_LINKS, getNavLinks, canSeeLink, visibleNav, type NavChild, type NavLink, type VisibleNavLink } from "./nav-links";

// Thành phần dùng chung cho các zone (xem docs/design/2026-11-15-shared-design.md)
export { StatusTag } from "./StatusTag";
export { STATUS_LABELS, type StatusDomain, type StatusMeta } from "./status-labels";
export { DataTable, type DataColumn, type DataTableProps, type DataTablePagination } from "./DataTable";
export { ErrorPanel } from "./ErrorPanel";
export { NoPermission } from "./NoPermission";
export { FormModal } from "./FormModal";
export { ConfirmAction } from "./ConfirmAction";
export { SearchBar } from "./SearchBar";
export { ScanInput } from "./ScanInput";
export { KeyValueList, type KeyValueItem } from "./KeyValueList";
export { describeError, ERROR_MESSAGES, FORBIDDEN_TEXT, type DescribedError } from "./error-messages";
export { formatDate, formatDateTime, formatMoney, formatRelativeTime } from "./format";
