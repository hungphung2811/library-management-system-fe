// Điểm vào chung của UI: trang chỉ import từ "@/ui" (antd, icon lucide, thành phần dùng chung).
export { Providers } from "./Providers";
export { AppShell } from "./AppShell";
export { Logo, LogoMark } from "./Logo";
export { AuthShell, PageHeader } from "./Layout";
export * from "./antd";
export * from "./icons";
export { PageSkeleton } from "./PageSkeleton";
export { QueryBoundary } from "./QueryBoundary";
export { LinkButton } from "./LinkButton";
export { antdTheme, color, size, font } from "@/theme";
export { DEFAULT_NAV_LINKS, canSeeLink, visibleNav, type NavChild, type NavLink, type VisibleNavLink } from "./nav-links";

export { StatusTag } from "./StatusTag";
export { STATUS_LABELS, type StatusDomain, type StatusMeta } from "./status-labels";
export { DEFAULT_PAGE_SIZES, DataTable, type DataColumn, type DataTableProps, type DataTablePagination } from "./DataTable";
export { ErrorPanel } from "./ErrorPanel";
export { ShortId } from "./ShortId";
export { DetailModalRoute, useDetailModal } from "./DetailModal";
export { NoPermission } from "./NoPermission";
export { FormModal } from "./FormModal";
export { useFormModal, type FormModalConfig } from "./useFormModal";
export { ConfirmAction } from "./ConfirmAction";
export { usePageSize } from "./usePageSize";
export { RowActions, actionsColumn, type RowAction } from "./RowActions";
export { SearchBar } from "./SearchBar";
export { FilterBar, type FilterBarProps } from "./FilterBar";
export {
  useFilterParams,
  type FilterField,
  type FilterParams,
  type FilterValue,
  type FilterValues,
  type DateRangeValue,
  type UseFilterParamsOptions,
} from "./useFilterParams";
export { ScanInput } from "./ScanInput";
export { RemoteSelect, type Opt } from "./RemoteSelect";
export { KeyValueList, type KeyValueItem } from "./KeyValueList";
export * from "./personal";
export { describeError, ERROR_MESSAGES, FORBIDDEN_TEXT, type DescribedError } from "./error-messages";
export { formatDate, formatDateTime, formatMoney, formatRelativeTime } from "./format";
