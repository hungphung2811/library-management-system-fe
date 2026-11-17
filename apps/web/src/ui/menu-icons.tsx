import type { ReactNode } from "react";
import {
  ArrowLeftRight,
  BookOpen,
  Building2,
  Globe,
  Inbox,
  KeyRound,
  LayoutDashboard,
  LayoutGrid,
  Menu,
  Network,
  ScrollText,
  ShieldCheck,
  ShoppingCart,
  Users,
} from "lucide-react";

const P = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;

// Tên icon do tenant admin nhập ở trang Menu (không phân biệt hoa thường). Tên ngoài danh sách dùng icon mặc định của sidebar.
const BY_NAME: Record<string, () => ReactNode> = {
  home: () => <LayoutDashboard {...P} />,
  dashboard: () => <LayoutDashboard {...P} />,
  book: () => <BookOpen {...P} />,
  books: () => <BookOpen {...P} />,
  catalog: () => <BookOpen {...P} />,
  swap: () => <ArrowLeftRight {...P} />,
  circulation: () => <ArrowLeftRight {...P} />,
  loan: () => <ArrowLeftRight {...P} />,
  shield: () => <ShieldCheck {...P} />,
  admin: () => <ShieldCheck {...P} />,
  user: () => <Users {...P} />,
  users: () => <Users {...P} />,
  role: () => <KeyRound {...P} />,
  key: () => <KeyRound {...P} />,
  department: () => <Network {...P} />,
  org: () => <Network {...P} />,
  building: () => <Building2 {...P} />,
  audit: () => <ScrollText {...P} />,
  log: () => <ScrollText {...P} />,
  inbox: () => <Inbox {...P} />,
  globe: () => <Globe {...P} />,
  cart: () => <ShoppingCart {...P} />,
  sales: () => <ShoppingCart {...P} />,
  menu: () => <Menu {...P} />,
  grid: () => <LayoutGrid {...P} />,
};

/** Icon theo tên; không có hoặc tên lạ thì undefined (nơi gọi dùng icon mặc định). */
export function menuIcon(name?: string | null): ReactNode | undefined {
  const k = name?.trim().toLowerCase();
  return k ? BY_NAME[k]?.() : undefined;
}
