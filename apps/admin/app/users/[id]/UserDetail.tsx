"use client";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { bffFetch } from "@mfe/api/client";
import { App, Button, Card, ConfirmAction, EditOutlined, Form, FormModal, Input, KeyValueList, Select, StatusTag, Tabs, Text } from "@mfe/ui";
import type { ReaderProfileView, RoleView, UserAccessView, UserView } from "../../types";
import { AccessTab } from "./AccessTab";
import { ReaderTab } from "./ReaderTab";
import type { ErrorInfo } from "@mfe/api/client";

export type AccessProps = {
  canView: boolean;
  data: UserAccessView | null;
  error: ErrorInfo | null;
  roles: RoleView[] | null;
  canAssign: boolean;
  canRevoke: boolean;
};

export type ReaderProps = {
  canView: boolean;
  data: ReaderProfileView | null;
  error: ErrorInfo | null;
  canIssue: boolean;
  canRenew: boolean;
  canStatus: boolean;
};

type Option = { value: string; label: string };

export function UserDetail({
  user,
  initialTab,
  departments,
  isSelf,
  sessionAdmin,
  canEdit,
  canStatus,
  access,
  reader,
}: {
  user: UserView;
  initialTab: "info" | "roles" | "reader";
  departments: Option[] | null;
  isSelf: boolean;
  sessionAdmin: boolean;
  canEdit: boolean;
  canStatus: boolean;
  access: AccessProps;
  reader: ReaderProps;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [tab, setTab] = useState(initialTab);

  const changeTab = (k: string) => {
    setTab(k as typeof tab);
    router.replace(`${pathname}?tab=${k}`, { scroll: false });
  };

  return (
    <Card>
      <Tabs
        activeKey={tab}
        onChange={changeTab}
        items={[
          {
            key: "info",
            label: "Thông tin",
            children: <InfoTab user={user} departments={departments} isSelf={isSelf} canEdit={canEdit} canStatus={canStatus} />,
          },
          {
            key: "roles",
            label: "Vai trò và quyền",
            children: <AccessTab userId={user.id} sessionAdmin={sessionAdmin} {...access} />,
          },
          {
            key: "reader",
            label: "Hồ sơ độc giả",
            children: <ReaderTab user={user} {...reader} />,
          },
        ]}
      />
    </Card>
  );
}

function InfoTab({
  user,
  departments,
  isSelf,
  canEdit,
  canStatus,
}: {
  user: UserView;
  departments: Option[] | null;
  isSelf: boolean;
  canEdit: boolean;
  canStatus: boolean;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [editing, setEditing] = useState(false);
  const active = user.status === "ACTIVE";
  const deptName = departments?.find((d) => d.value === user.departmentId)?.label;

  const setStatus = async () => {
    await bffFetch(`/api/users/${encodeURIComponent(user.id)}/status`, {
      method: "PUT",
      json: { status: active ? "DISABLED" : "ACTIVE" },
    });
    message.success(active ? "Đã vô hiệu hóa người dùng." : "Đã kích hoạt lại người dùng.");
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-4">
      <KeyValueList
        columns={2}
        items={[
          { label: "Họ tên", value: user.fullName },
          { label: "Tên đăng nhập", value: user.username, mono: true },
          { label: "Email", value: user.email },
          { label: "Phòng ban", value: deptName },
          { label: "Trạng thái", value: <StatusTag domain="user" value={user.status} /> },
        ]}
      />
      <div className="flex flex-wrap items-center gap-2">
        {canEdit && (
          <Button icon={<EditOutlined />} onClick={() => setEditing(true)}>
            Sửa
          </Button>
        )}
        {canStatus && !isSelf && (
          <ConfirmAction
            danger={active}
            title={active ? `Vô hiệu hóa «${user.fullName}»?` : `Kích hoạt lại «${user.fullName}»?`}
            description={active ? "Người này sẽ không đăng nhập được." : undefined}
            okText={active ? "Vô hiệu hóa" : "Kích hoạt lại"}
            onConfirm={setStatus}
          >
            <Button danger={active}>{active ? "Vô hiệu hóa" : "Kích hoạt lại"}</Button>
          </ConfirmAction>
        )}
        {canStatus && isSelf && <Text type="secondary">Bạn không thể vô hiệu hóa chính mình.</Text>}
      </div>

      <FormModal<{ fullName: string; email: string; departmentId?: string }>
        open={editing}
        title="Sửa thông tin người dùng"
        okText="Lưu"
        successMessage="Đã cập nhật thông tin."
        onCancel={() => setEditing(false)}
        initialValues={{ fullName: user.fullName, email: user.email, departmentId: user.departmentId ?? undefined }}
        onSubmit={async (v) => {
          await bffFetch(`/api/users/${encodeURIComponent(user.id)}`, {
            method: "PUT",
            json: { fullName: v.fullName, email: v.email, departmentId: v.departmentId || undefined },
          });
          router.refresh();
        }}
      >
        <Form.Item
          name="fullName"
          label="Họ tên"
          rules={[{ required: true, message: "Nhập họ tên" }, { max: 255, message: "Tối đa 255 ký tự" }]}
        >
          <Input autoComplete="off" />
        </Form.Item>
        <Form.Item
          name="email"
          label="Email"
          rules={[{ required: true, message: "Nhập email" }, { type: "email", message: "Email chưa đúng định dạng" }]}
        >
          <Input autoComplete="off" />
        </Form.Item>
        {departments && (
          <Form.Item name="departmentId" label="Phòng ban">
            <Select allowClear showSearch={{ optionFilterProp: "label" }} options={departments} placeholder="Không chọn" />
          </Form.Item>
        )}
      </FormModal>
    </div>
  );
}
