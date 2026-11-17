import { lazy, Suspense, useEffect } from "react";
import { createBrowserRouter, Navigate, Outlet, useMatches } from "react-router";
import { ProtectedRoute } from "@/auth/ProtectedRoute";
import { AppShell } from "@/ui/AppShell";
import { PageSkeleton } from "@/ui/PageSkeleton";
import ChangePassword from "@/pages/ChangePassword";
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import NotFound from "@/pages/NotFound";
import Notifications from "@/pages/Notifications";
import Profile from "@/pages/Profile";
import RouteError from "@/pages/RouteError";

// Mỗi nhóm nghiệp vụ là một chunk riêng (vite.config.ts gom theo thư mục pages/<nhóm>), chỉ tải khi vào nhóm đó.
const CatalogList = lazy(() => import("@/pages/catalog/CatalogList"));
const BookNew = lazy(() => import("@/pages/catalog/BookNew"));
const BookDetail = lazy(() => import("@/pages/catalog/BookDetail"));
const Barcode = lazy(() => import("@/pages/catalog/Barcode"));

const CirculationHome = lazy(() => import("@/pages/circulation/CirculationHome"));
const Borrow = lazy(() => import("@/pages/circulation/Borrow"));
const Return = lazy(() => import("@/pages/circulation/Return"));
const Borrowings = lazy(() => import("@/pages/circulation/Borrowings"));
const BorrowingDetail = lazy(() => import("@/pages/circulation/BorrowingDetail"));
const Reservations = lazy(() => import("@/pages/circulation/Reservations"));
const Fines = lazy(() => import("@/pages/circulation/Fines"));
const MyBorrowings = lazy(() => import("@/pages/circulation/Mine"));

const AdminHome = lazy(() => import("@/pages/admin/AdminHome"));
const Users = lazy(() => import("@/pages/admin/Users"));
const UserDetail = lazy(() => import("@/pages/admin/UserDetail"));
const Roles = lazy(() => import("@/pages/admin/Roles"));
const RoleDetail = lazy(() => import("@/pages/admin/RoleDetail"));
const Departments = lazy(() => import("@/pages/admin/Departments"));
const AuditLogs = lazy(() => import("@/pages/admin/AuditLogs"));
const Menus = lazy(() => import("@/pages/admin/Menus"));
const MyContract = lazy(() => import("@/pages/admin/MyContract"));
const StorefrontOrigins = lazy(() => import("@/pages/admin/StorefrontOrigins"));

// Bán hàng (module SALES): mỗi trang tự kiểm module và khóa quyền (SalesGate), BE là nơi quyết định cuối.
const SalesHome = lazy(() => import("@/pages/sales/SalesHome"));
const SalesPos = lazy(() => import("@/pages/sales/Pos"));
const SalesOrders = lazy(() => import("@/pages/sales/Orders"));
const SalesOrderDetail = lazy(() => import("@/pages/sales/OrderDetail"));
const SalesStock = lazy(() => import("@/pages/sales/Stock"));
const SalesSuppliers = lazy(() => import("@/pages/sales/Suppliers"));
const SalesReceipts = lazy(() => import("@/pages/sales/Receipts"));
const SalesSettings = lazy(() => import("@/pages/sales/Settings"));
const SalesRefunds = lazy(() => import("@/pages/sales/Refunds"));
const SalesAudit = lazy(() => import("@/pages/sales/Audit"));

// Quản trị nền tảng SaaS: chỉ platform admin (trang tự chặn bằng PlatformGate, BE trả 403 là quyết định cuối).
const CmsPages = lazy(() => import("@/pages/platform/CmsPages"));
const CmsPageDetail = lazy(() => import("@/pages/platform/CmsPageDetail"));
const ContactRequests = lazy(() => import("@/pages/platform/ContactRequests"));
const ContactRequestDetail = lazy(() => import("@/pages/platform/ContactRequestDetail"));
const Tenants = lazy(() => import("@/pages/platform/tenants/Tenants"));
const TenantDetailPage = lazy(() => import("@/pages/platform/tenants/TenantDetail"));
const Organizations = lazy(() => import("@/pages/platform/organizations/Organizations"));
const ExpiringContracts = lazy(() => import("@/pages/platform/contracts/ExpiringContracts"));
const ContractDetailPage = lazy(() => import("@/pages/platform/contracts/ContractDetail"));

/** Tiêu đề tab: `handle.title` của route khớp sâu nhất, ghép với "Quản lý thư viện" (như template của Next cũ). */
function RootLayout() {
  const matches = useMatches();
  const title = [...matches].reverse().map((m) => (m.handle as { title?: string } | undefined)?.title).find(Boolean);
  useEffect(() => {
    document.title = title ? `${title} - Quản lý thư viện` : "Quản lý thư viện";
  }, [title]);
  return <Outlet />;
}

/** Vùng nội dung của nhóm lazy: khung (sidebar, header) giữ nguyên, chỉ phần này hiện skeleton lúc tải chunk. */
function LazyOutlet() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Outlet />
    </Suspense>
  );
}

/** data-print-scope: để index.css chỉ ẩn khung ứng dụng khi in các trang Mượn trả. */
function CirculationLayout() {
  return (
    <div data-print-scope="circulation">
      <Outlet />
    </div>
  );
}

/** data-print-scope: ẩn khung ứng dụng khi in phiếu bán hàng (phần còn lại của trang dùng print:hidden). */
function SalesLayout() {
  return (
    <div data-print-scope="sales">
      <Suspense fallback={<PageSkeleton />}>
        <Outlet />
      </Suspense>
    </div>
  );
}

/**
 * Khai báo MỌI đường dẫn của app. Trang của pha sau chỉ sửa file trong src/pages/<nhóm>/, không sửa file này
 * (trừ khi thêm route mới). `handle.title` đặt tiêu đề tab.
 */
export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <RouteError />,
    children: [
      { path: "login", element: <Login />, handle: { title: "Đăng nhập" } },
      {
        // Đổi mật khẩu: đã đăng nhập (kể cả tài khoản mustChangePassword), nằm ngoài khung ứng dụng.
        element: <ProtectedRoute allowMustChange />,
        children: [{ path: "change-password", element: <ChangePassword />, handle: { title: "Đổi mật khẩu" } }],
      },
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <AppShell />,
            children: [
              {
                // Lỗi của một trang chỉ thay phần nội dung, giữ nguyên khung (như error.tsx của Next cũ).
                errorElement: <RouteError inline />,
                children: [
                  { index: true, element: <Home />, handle: { title: "Tổng quan" } },
                  { path: "profile", element: <Profile />, handle: { title: "Hồ sơ" } },
                  { path: "notifications", element: <Notifications />, handle: { title: "Thông báo" } },
                  {
                    path: "catalog",
                    element: <LazyOutlet />,
                    handle: { title: "Sách" },
                    children: [
                      { index: true, element: <CatalogList /> },
                      { path: "books/new", element: <BookNew /> },
                      { path: "books/:id", element: <BookDetail /> },
                      { path: "barcode", element: <Barcode /> },
                    ],
                  },
                  {
                    path: "circulation",
                    element: (
                      <CirculationLayout />
                    ),
                    handle: { title: "Mượn trả" },
                    children: [
                      {
                        element: <LazyOutlet />,
                        children: [
                          { index: true, element: <CirculationHome /> },
                          { path: "borrow", element: <Borrow /> },
                          { path: "return", element: <Return /> },
                          { path: "borrowings", element: <Borrowings /> },
                          { path: "borrowings/:id", element: <BorrowingDetail /> },
                          { path: "reservations", element: <Reservations /> },
                          { path: "fines", element: <Fines /> },
                          { path: "mine", element: <MyBorrowings /> },
                          { path: "*", element: <NotFound /> },
                        ],
                      },
                    ],
                  },
                  {
                    path: "admin",
                    element: <LazyOutlet />,
                    handle: { title: "Quản trị" },
                    children: [
                      { index: true, element: <AdminHome /> },
                      { path: "users", element: <Users /> },
                      { path: "users/:id", element: <UserDetail /> },
                      { path: "roles", element: <Roles /> },
                      { path: "roles/:id", element: <RoleDetail /> },
                      { path: "departments", element: <Departments /> },
                      { path: "audit-logs", element: <AuditLogs /> },
                      { path: "menus", element: <Menus />, handle: { title: "Menu" } },
                      { path: "contract", element: <MyContract />, handle: { title: "Hợp đồng dịch vụ" } },
                      { path: "storefront-origins", element: <StorefrontOrigins />, handle: { title: "Website" } },
                      { path: "*", element: <NotFound /> },
                    ],
                  },
                  {
                    path: "sales",
                    element: <SalesLayout />,
                    handle: { title: "Bán hàng" },
                    children: [
                      { index: true, element: <SalesHome /> },
                      { path: "pos", element: <SalesPos />, handle: { title: "Bán tại quầy" } },
                      { path: "orders", element: <SalesOrders />, handle: { title: "Đơn hàng" } },
                      { path: "orders/:id", element: <SalesOrderDetail />, handle: { title: "Chi tiết đơn hàng" } },
                      { path: "stock", element: <SalesStock />, handle: { title: "Tồn kho" } },
                      { path: "suppliers", element: <SalesSuppliers />, handle: { title: "Nhà cung cấp" } },
                      { path: "receipts", element: <SalesReceipts />, handle: { title: "Phiếu nhập kho" } },
                      { path: "settings", element: <SalesSettings />, handle: { title: "Cấu hình bán hàng" } },
                      { path: "refunds", element: <SalesRefunds />, handle: { title: "Hoàn tiền" } },
                      { path: "audit", element: <SalesAudit />, handle: { title: "Nhật ký bán hàng" } },
                      { path: "*", element: <NotFound /> },
                    ],
                  },
                  {
                    path: "platform",
                    element: <LazyOutlet />,
                    handle: { title: "Nền tảng SaaS" },
                    children: [
                      { index: true, element: <Navigate to="/platform/cms-pages" replace /> },
                      { path: "tenants", element: <Tenants />, handle: { title: "Đơn vị (tenant)" } },
                      { path: "tenants/:id", element: <TenantDetailPage />, handle: { title: "Chi tiết đơn vị" } },
                      { path: "tenants/:id/contracts/:contractId", element: <ContractDetailPage />, handle: { title: "Chi tiết hợp đồng" } },
                      { path: "contracts", element: <ExpiringContracts />, handle: { title: "Hợp đồng sắp hết hạn" } },
                      { path: "organizations", element: <Organizations />, handle: { title: "Tổ chức" } },
                      { path: "cms-pages", element: <CmsPages />, handle: { title: "Trang website" } },
                      { path: "cms-pages/:id", element: <CmsPageDetail />, handle: { title: "Sửa trang website" } },
                      { path: "contact-requests", element: <ContactRequests />, handle: { title: "Yêu cầu liên hệ" } },
                      { path: "contact-requests/:id", element: <ContactRequestDetail />, handle: { title: "Chi tiết yêu cầu liên hệ" } },
                      { path: "*", element: <NotFound /> },
                    ],
                  },
                  { path: "*", element: <NotFound />, handle: { title: "Không tìm thấy" } },
        ],
              },
            ],
          },
        ],
      },
    ],
  },
]);
