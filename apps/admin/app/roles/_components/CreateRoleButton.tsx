"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { bffFetch } from "@mfe/api/client";
import { App, Button, Form, FormModal, Input, PlusOutlined, Switch, Text } from "@mfe/ui";
import type { RoleView } from "../../types";

type Values = { name: string; description: string; isAdmin?: boolean };

/** Nút + hộp thoại "Thêm vai trò". Công tắc vai trò quản trị viên chỉ hiện với quản trị viên và đòi xác nhận lần hai. */
export function CreateRoleButton({ sessionAdmin }: { sessionAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { modal } = App.useApp();

  const confirmAdmin = () =>
    new Promise<void>((resolve, reject) =>
      modal.confirm({
        title: "Tạo vai trò quản trị viên?",
        content: "Người có vai trò này được bỏ qua mọi kiểm tra quyền.",
        okText: "Tạo vai trò quản trị viên",
        cancelText: "Không",
        okButtonProps: { danger: true },
        onOk: () => resolve(),
        onCancel: () => reject(new Error("Đã hủy tạo vai trò quản trị viên.")),
      }),
    );

  return (
    <>
      <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
        Thêm vai trò
      </Button>
      <FormModal<Values>
        open={open}
        title="Thêm vai trò"
        okText="Tạo"
        successMessage="Đã tạo vai trò."
        onCancel={() => setOpen(false)}
        onSubmit={async (v) => {
          const isAdmin = sessionAdmin && v.isAdmin === true;
          if (isAdmin) await confirmAdmin();
          const created = await bffFetch<RoleView>("/api/roles", {
            method: "POST",
            json: { name: v.name.trim(), description: v.description.trim(), isAdmin },
          });
          if (created?.id) router.push(`/roles/${encodeURIComponent(created.id)}`);
          else router.refresh();
        }}
      >
        <Form.Item name="name" label="Tên vai trò" rules={[{ required: true, whitespace: true, message: "Nhập tên vai trò" }]}>
          <Input autoComplete="off" />
        </Form.Item>
        <Form.Item name="description" label="Mô tả" rules={[{ required: true, whitespace: true, message: "Nhập mô tả" }]}>
          <Input autoComplete="off" />
        </Form.Item>
        {sessionAdmin && (
          <Form.Item
            name="isAdmin"
            label="Vai trò quản trị viên"
            valuePropName="checked"
            extra={<Text type="warning">Người có vai trò này được bỏ qua mọi kiểm tra quyền.</Text>}
          >
            <Switch />
          </Form.Item>
        )}
      </FormModal>
    </>
  );
}
