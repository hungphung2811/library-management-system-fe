// Kiểu và hàm dựng cây cho trang quản trị menu (GET /api/admin/menus trả danh sách PHẲNG có parentId).
export type MenuModule = "LENDING" | "SALES";

export type AdminMenuItem = {
  id: string;
  code: string;
  label: string;
  path?: string | null;
  icon?: string | null;
  parentId?: string | null;
  sortOrder: number;
  enabled: boolean;
  permissionKey?: string | null;
  version: number;
  module?: MenuModule | null;
};

export type AdminMenuList = { usingDefaults: boolean; items: AdminMenuItem[] };

export type MenuTreeNode = AdminMenuItem & { depth: number; children: MenuTreeNode[] };

/** Độ sâu tối đa của menu (BE từ chối sâu hơn bằng MENU_TOO_DEEP): gốc là cấp 1. */
export const MAX_MENU_DEPTH = 3;

/** Dựng cây theo parentId rồi sắp theo sortOrder, mã. Mục có parentId không tồn tại được coi là gốc (không để mất mục). */
export function buildMenuTree(items: AdminMenuItem[]): MenuTreeNode[] {
  const byId = new Map<string, MenuTreeNode>();
  for (const it of items) byId.set(it.id, { ...it, depth: 1, children: [] });
  const roots: MenuTreeNode[] = [];
  for (const n of byId.values()) {
    const parent = n.parentId ? byId.get(n.parentId) : undefined;
    if (parent && parent !== n) parent.children.push(n);
    else roots.push(n);
  }
  const cmp = (a: MenuTreeNode, b: MenuTreeNode) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code);
  const walk = (list: MenuTreeNode[], depth: number, seen: Set<string>) => {
    list.sort(cmp);
    for (const n of list) {
      n.depth = depth;
      if (seen.has(n.id)) {
        n.children = []; // chống vòng lặp dữ liệu hỏng
        continue;
      }
      seen.add(n.id);
      walk(n.children, depth + 1, seen);
    }
  };
  walk(roots, 1, new Set());
  return roots;
}

/** Duyệt tiền thứ tự thành danh sách phẳng (để hiển thị thụt lề). */
export function flattenTree(nodes: MenuTreeNode[]): MenuTreeNode[] {
  return nodes.flatMap((n) => [n, ...flattenTree(n.children)]);
}

/** Chiều cao của cây con gốc n (1 = chỉ có n). */
export function subtreeHeight(n: MenuTreeNode): number {
  return 1 + Math.max(0, ...n.children.map(subtreeHeight));
}

/** Id của n và mọi hậu duệ (không được chọn làm cha mới của n: MENU_CYCLE). */
export function descendantIds(n: MenuTreeNode): Set<string> {
  return new Set(flattenTree([n]).map((x) => x.id));
}
