import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { apiFetch, toErrorInfo, useApiMutation } from "@/api";
import {
  App,
  Button,
  Empty,
  Form,
  FormModal,
  Input,
  PlusOutlined,
  Pencil,
  Plus,
  Power,
  RotateCcw,
  RowActions,
  StatusTag,
  Switch,
  Tree,
  TreeSelect,
  describeError,
  useFormModal,
} from "@/ui";
import type { DepartmentNode } from "../_lib/types";

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

/** Giữ nút khớp (tên hoặc mã) và mọi tổ tiên của nút khớp; nút khớp giữ nguyên cây con. */
function filterTree(nodes: TNode[], needle: string): TNode[] {
  return nodes.flatMap((n) => {
    if (n.dept.name.toLowerCase().includes(needle) || n.dept.code.toLowerCase().includes(needle)) return [n];
    const kids = filterTree(n.children, needle);
    return kids.length ? [{ ...n, children: kids }] : [];
  });
}

const keysOf = (nodes: TNode[]): string[] => nodes.flatMap((n) => [n.key, ...keysOf(n.children)]);

/** Nút con của nút khớp nhưng tự nó không khớp: chỉ nằm lại để làm ngữ cảnh, được làm mờ nhẹ. Khớp và tổ tiên giữ chữ đậm bình thường. */
function contextKeys(nodes: TNode[], needle: string, underMatch = false): string[] {
  return nodes.flatMap((n) => {
    const match = n.dept.name.toLowerCase().includes(needle) || n.dept.code.toLowerCase().includes(needle);
    return [...(underMatch && !match ? [n.key] : []), ...contextKeys(n.children, needle, underMatch || match)];
  });
}

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
  const [sp, setSp] = useSearchParams();
  const q = (sp.get("q") ?? "").trim();
  const { message, modal } = App.useApp();
  const fullTree = useMemo(() => toTree(nodes), [nodes]);
  const treeData = useMemo(() => (q ? filterTree(fullTree, q.toLowerCase()) : fullTree), [fullTree, q]);
  const allKeys = useMemo(() => keysOf(treeData), [treeData]);
  const contextOnly = useMemo(() => new Set(q ? contextKeys(treeData, q.toLowerCase()) : []), [treeData, q]);
  const totalCount = useMemo(() => keysOf(fullTree).length, [fullTree]);
  const [expanded, setExpanded] = useState<string[]>(allKeys);

  const save = useFormModal<{ code?: string; name: string; parentId?: string }, unknown, Target>({
    title: (t) => (t?.mode === "edit" ? `Sửa phòng ban «${t.dept.name}»` : "Thêm phòng ban"),
    okText: (t) => (t?.mode === "edit" ? "Lưu" : "Tạo"),
        invalidate: ["/api/departments"],
    initialValues: (t) =>
      t?.mode === "edit"
        ? { name: t.dept.name, parentId: t.dept.parentId ?? undefined }
        : { parentId: t?.mode === "create" ? t.parentId : undefined },
    request: (v, t) =>
      t?.mode === "edit"
        ? apiFetch(`/api/departments/${encodeURIComponent(t.dept.id)}`, {
            method: "PUT",
            json: { name: v.name.trim(), parentId: v.parentId || undefined },
          })
        : apiFetch("/api/departments", {
            method: "POST",
            json: { code: v.code?.trim(), name: v.name.trim(), parentId: v.parentId || undefined },
          }),
  });
  const setStatus = useApiMutation(
    (v: { id: string; status: "ACTIVE" | "INACTIVE" }) =>
      apiFetch(`/api/departments/${encodeURIComponent(v.id)}/status`, { method: "PUT", json: { status: v.status } }),
    { invalidate: ["/api/departments"] },
  );

  // Sau khi thêm/đổi phòng ban, mở rộng lại để nút mới luôn thấy được.
  const keySig = allKeys.join("|");
  useEffect(() => setExpanded(allKeys), [keySig]); // eslint-disable-line react-hooks/exhaustive-deps

  const setParam = (name: string, v?: string) => {
    const n = new URLSearchParams(sp);
    if (v) n.set(name, v);
    else n.delete(name);
    setSp(n, { replace: true });
  };
  const toggleInactive = (on: boolean) => setParam("inactive", on ? "1" : undefined);

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
          await setStatus.mutateAsync({ id: d.id, status: deactivate ? "INACTIVE" : "ACTIVE" });
          message.success(deactivate ? "Đã ngừng dùng phòng ban." : "Đã dùng lại phòng ban.");
        } catch (e) {
          message.error(describeError(toErrorInfo(e)).text);
        }
      },
    });
  };

  const actionsFor = (d: Flat) => [
    { key: "add", label: "Thêm phòng ban con", icon: <Plus size={16} />, hidden: !canCreate, onClick: () => save.openModal({ mode: "create", parentId: d.id }) },
    { key: "edit", label: "Sửa", icon: <Pencil size={16} />, hidden: !canUpdate, onClick: () => save.openModal({ mode: "edit", dept: d }) },
    {
      key: "status",
      label: d.status === "ACTIVE" ? "Ngừng dùng" : "Dùng lại",
      icon: d.status === "ACTIVE" ? <Power size={16} /> : <RotateCcw size={16} />,
      danger: d.status === "ACTIVE",
      hidden: !canStatus,
      onClick: () => changeStatus(d),
    },
  ];

  const edit = save.open && save.target?.mode === "edit" ? save.target.dept : null;
  const excludeId = edit?.id;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          allowClear
          aria-label="Tìm phòng ban"
          placeholder="Tìm theo tên hoặc mã phòng ban"
          className="max-w-72"
          value={sp.get("q") ?? ""}
          onChange={(e) => setParam("q", e.target.value || undefined)}
        />
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
          <Button type="primary" icon={<PlusOutlined />} className="ml-auto" onClick={() => save.openModal({ mode: "create" })}>
            Thêm phòng ban
          </Button>
        )}
      </div>

      <div className="text-sm text-muted" role="status" data-testid="result-count">
        {q ? `${keysOf(treeData).length} / ${totalCount} phòng ban khớp «${q}»` : `${totalCount} phòng ban`}
      </div>

      {treeData.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={q ? "Không có phòng ban khớp." : "Chưa có phòng ban nào."}>
          {canCreate && !q && (
            <Button type="primary" onClick={() => save.openModal({ mode: "create" })}>
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
            return (
              <span className={`flex flex-wrap items-center gap-2 py-0.5 ${contextOnly.has(d.id) ? "text-muted" : "text-ink"}`}>
                <span>{d.name}</span>
                <span className="font-mono text-xs text-muted">{d.code}</span>
                <StatusTag domain="department" value={d.status} />
                {(canCreate || canUpdate || canStatus) && <RowActions actions={actionsFor(d)} />}
              </span>
            );
          }}
        />
      )}

      <FormModal<{ code?: string; name: string; parentId?: string }>
        {...save.modalProps}
        key={save.open && save.target ? (edit ? `edit-${edit.id}` : `create-${save.target.mode === "create" ? (save.target.parentId ?? "root") : ""}`) : "none"}
        successMessage={edit ? "Đã cập nhật phòng ban." : "Đã tạo phòng ban."}
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
            treeData={parentOptions(fullTree, excludeId)}
          />
        </Form.Item>
      </FormModal>
    </div>
  );
}
