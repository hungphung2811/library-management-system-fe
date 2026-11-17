import type { ReactNode } from "react";
import { Descriptions } from "./antd";

export type KeyValueItem = { label: string; value: ReactNode; mono?: boolean };

/** Bọc Descriptions để server component không phải truyền `children`. Giá trị null/rỗng hiện "—". */
export function KeyValueList({ items, columns = 1 }: { items: KeyValueItem[]; columns?: 1 | 2 }) {
  return (
    <Descriptions
      column={{ xs: 1, sm: columns }}
      items={items.map((it, i) => {
        const empty = it.value === null || it.value === undefined || it.value === "" || it.value === false;
        return {
          key: String(i),
          label: it.label,
          children: empty ? "—" : it.mono ? <span className="font-mono">{it.value}</span> : it.value,
        };
      })}
    />
  );
}
