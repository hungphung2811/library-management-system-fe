"use client";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { bffFetch } from "@mfe/api/client";
import {
  App,
  Button,
  Dropdown,
  Empty,
  Form,
  FormModal,
  Input,
  PlusOutlined,
  StatusTag,
  Switch,
  Tree,
  TreeSelect,
} from "@mfe/ui";
import type { DepartmentNode } from "../types";

type Flat = { id: string; code: string; name: string; status: string; parentId: string | null };
type TNode = { key: string; title: string; children: TNode[]; dept: Flat };

function toTree(nodes: DepartmentNode[], parentId: string | null = null): TNode[] {
  return nodes.map((n) => ({
    key: n.id,
    title: n.name,
    dept: { id: n.id, code: n.code, name: n.name, status: n.status, parentId },
    children: toTree(n.children ?? [], n.id),
  }));
}

const keysOf = (nodes: TNode[]): string[] => nodes.flatMap((n) => [n.key, ...keysOf(n.children)]);

/** TreeSelect chọn phòng ban cha; khi sửa thì bỏ chính nó và các con để tránh vòng (BE vẫn là nơi chặn thật). */
function parentOptions(nodes: TNode[], excludeId?: string): { value: string; title: string; children: ReturnType<typeof parentOptions> }[] {
  return nodes
    .filter((n) => n.key !== excludeId)
    .map((n) => ({ value: n.key, title: n.title, children: parentOptions(n.children, excludeId) }));
}

type Target = { mode: "create"; parentId?: string } | { mode: "edit"; dept: Flat };

export function DepartmentsView({
  nodes,
  includeInactive,
  canCreate,
  canUpdate,
  canStatus,
}: {
  nodes: DepartmentNode[];
  includeInactive: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canStatus: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { message, modal } = App.useApp();
  const treeData = useMemo(() => toTree(nodes), [nodes]);
  const allKeys = useMemo(() => keysOf(treeData), [treeData]);
  const [expanded, setExpanded] = useState<string[]>(allKeys);
  const [target, setTarget] = useState<Target | null>(null);

  // Sau khi thêm/đổi phòng ban, mở rộng lại để nút mới luôn thấy được.
  const keySig = allKeys.join("|");
  useEffect(() => setExpanded(allKeys), [keySig]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleInactive = (on: boolean) => router.replace(on ? `${pathname}?inactive=1` : pathname);

  const changeStatus = (d: Flat) => {
    const deactivate = d.status === "ACTIVE";
    modal.confirm({
      title: deactivate ? `Ngừng dùng «${d.name}»?` : `Dùng lại «${d.name}»?`,
      content: deactivate ? "Người dùng thuộc phòng ban này vẫn giữ nguyên." : undefined,
      okText: deactivate ? "Ngừng dùng" : "Dùng lại",
      cancelText: "Không",
      okButtonProps: { danger: deactivate },
      onOk: async () => {
        try {
          await bffFetch(`/api/departments/${encodeURIComponent(d.id)}/status`, {
            method: "PUT",
            json: { status: deactivate ? "INACTIVE" : "ACTIVE" },
          });
          message.success(deactivate ? "Đã ngừng dùng phòng ban." : "Đã dùng lại phòng ban.");
          router.refresh();
        } catch (e) {
          message.error((e as Error).message);
        }
      },
    });
  };

  const menuFor = (d: Flat) => {
    const items = [
      ...(canCreate ? [{ key: "add", label: "Thêm phòng ban con" }] : []),
      ...(canUpdate ? [{ key: "edit", label: "Sửa" }] : []),
      ...(canStatus ? [{ key: "status", label: d.status === "ACTIVE" ? "Ngừng dùng" : "Dùng lại" }] : []),
    ];
    return {
      items,
      onClick: ({ key }: { key: string }) => {
        if (key === "add") setTarget({ mode: "create", parentId: d.id });
        else if (key === "edit") setTarget({ mode: "edit", dept: d });
        else changeStatus(d);
      },
    };
  };

  const edit = target?.mode === "edit" ? target.dept : null;
  const excludeId = edit?.id;
  const initial =
    target?.mode === "edit"
      ? { name: target.dept.name, parentId: target.dept.parentId ?? undefined }
      : { parentId: target?.mode === "create" ? target.parentId : undefined };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={includeInactive} onChange={toggleInactive} aria-label="Hiện cả phòng ban ngừng dùng" />
          Hiện cả phòng ban ngừng dùng
        </label>
        {treeData.length > 0 && (
          <>
            <Button size="small" onClick={() => setExpanded(allKeys)}>
              Mở rộng tất cả
            </Button>
            <Button size="small" onClick={() => setExpanded([])}>
              Thu gọn
            </Button>
          </>
        )}
        {canCreate && (
          <Button type="primary" icon={<PlusOutlined />} className="ml-auto" onClick={() => setTarget({ mode: "create" })}>
            Thêm phòng ban
          </Button>
        )}
      </div>

      {treeData.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có phòng ban nào.">
          {canCreate && (
            <Button type="primary" onClick={() => setTarget({ mode: "create" })}>
              Thêm phòng ban gốc
            </Button>
          )}
        </Empty>
      ) : (
        <Tree
          blockNode
          selectable={false}
          treeData={treeData}
          expandedKeys={expanded}
          onExpand={(k) => setExpanded(k.map(String))}
          titleRender={(n) => {
            const d = (n as unknown as TNode).dept;
            const items = menuFor(d).items;
            return (
              <span className="flex flex-wrap items-center gap-2 py-0.5">
                <span>{d.name}</span>
                <span className="font-mono text-xs text-muted">{d.code}</span>
                <StatusTag domain="department" value={d.status} />
                {items.length > 0 && (
                  <Dropdown trigger={["click"]} menu={menuFor(d)}>
                    <Button size="small" type="text" aria-label={`Thao tác với «${d.name}»`}>
                      …
                    </Button>
                  </Dropdown>
                )}
              </span>
            );
          }}
        />
      )}

      <FormModal<{ code?: string; name: string; parentId?: string }>
        key={target ? (edit ? `edit-${edit.id}` : `create-${target.mode === "create" ? (target.parentId ?? "root") : ""}`) : "none"}
        open={target !== null}
        title={edit ? `Sửa phòng ban «${edit.name}»` : "Thêm phòng ban"}
        okText={edit ? "Lưu" : "Tạo"}
        successMessage={edit ? "Đã cập nhật phòng ban." : "Đã tạo phòng ban."}
        onCancel={() => setTarget(null)}
        initialValues={initial}
        onSubmit={async (v) => {
          if (edit) {
            await bffFetch(`/api/departments/${encodeURIComponent(edit.id)}`, {
              method: "PUT",
              json: { name: v.name.trim(), parentId: v.parentId || undefined },
            });
          } else {
            await bffFetch("/api/departments", {
              method: "POST",
              json: { code: v.code?.trim(), name: v.name.trim(), parentId: v.parentId || undefined },
            });
          }
          router.refresh();
        }}
      >
        {edit ? (
          <Form.Item label="Mã">
            <span className="font-mono">{edit.code}</span>
          </Form.Item>
        ) : (
          <Form.Item
            name="code"
            label="Mã"
            rules={[{ required: true, whitespace: true, message: "Nhập mã phòng ban" }, { max: 50, message: "Tối đa 50 ký tự" }]}
          >
            <Input autoComplete="off" className="font-mono" />
          </Form.Item>
        )}
        <Form.Item
          name="name"
          label="Tên"
          rules={[{ required: true, whitespace: true, message: "Nhập tên phòng ban" }, { max: 255, message: "Tối đa 255 ký tự" }]}
        >
          <Input autoComplete="off" />
        </Form.Item>
        <Form.Item name="parentId" label="Phòng ban cha">
          <TreeSelect
            allowClear
            showSearch={{ treeNodeFilterProp: "title" }}
            treeDefaultExpandAll
            placeholder="Phòng ban gốc (không có cha)"
            treeData={parentOptions(treeData, excludeId)}
          />
        </Form.Item>
      </FormModal>
    </div>
  );
}
