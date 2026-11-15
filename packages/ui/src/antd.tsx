"use client";
// Re-export antd dưới dạng client module để server component của các zone dùng được.
// Lưu ý: props truyền từ server component sang đây phải serialize được (không truyền hàm,
// ví dụ Table dùng `dataIndex` thay vì `render`; cần render tuỳ biến thì viết client component riêng).
// QUY TẮC: zone chỉ import antd qua @mfe/ui (kể cả trong client component) để cả hệ thống dùng một bản antd
// và một ConfigProvider/App context. Cần thêm component thì xin điều phối viên, đừng thêm antd vào package.json của zone.
import { Typography } from "antd";

export {
  Alert,
  App,
  Badge,
  Breadcrumb,
  Button,
  Card,
  Checkbox,
  Col,
  Collapse,
  DatePicker,
  Descriptions,
  Divider,
  Drawer,
  Dropdown,
  Empty,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  Pagination,
  Popconfirm,
  Popover,
  Radio,
  Result,
  Row,
  Segmented,
  Select,
  Skeleton,
  Space,
  Spin,
  Statistic,
  Steps,
  Switch,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Tree,
  TreeSelect,
} from "antd";
export {
  BellOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  LinkOutlined,
  LockOutlined,
  LogoutOutlined,
  PlusOutlined,
  ReadOutlined,
  ReloadOutlined,
  ScanOutlined,
  SearchOutlined,
  SettingOutlined,
  SwapOutlined,
  UserOutlined,
} from "@ant-design/icons";
export { default as dayjs } from "dayjs";

export const Title = Typography.Title;
export const Text = Typography.Text;
export const Paragraph = Typography.Paragraph;
