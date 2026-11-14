"use client";
// Re-export antd dưới dạng client module để server component của các zone dùng được.
// Lưu ý: props truyền từ server component sang đây phải serialize được (không truyền hàm,
// ví dụ Table dùng `dataIndex` thay vì `render`; cần render tuỳ biến thì viết client component riêng).
import { Typography } from "antd";

export {
  Alert,
  Button,
  Card,
  Descriptions,
  Empty,
  Form,
  Input,
  Result,
  Space,
  Table,
  Tag,
} from "antd";
export {
  ReadOutlined,
  SettingOutlined,
  SwapOutlined,
  LockOutlined,
  UserOutlined,
} from "@ant-design/icons";

export const Title = Typography.Title;
export const Text = Typography.Text;
export const Paragraph = Typography.Paragraph;
