import { createContext, useContext, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";
import { Modal } from "./antd";

const DetailModalContext = createContext<{ close: () => void } | null>(null);

/** Trang chi tiết đang hiển thị trong modal (để ẩn breadcrumb, nút "Về danh sách"...). `close()` đóng modal. */
export function useDetailModal() {
  return useContext(DetailModalContext);
}

/**
 * Route chi tiết dạng modal GIỮ URL: hiển thị trang danh sách (`list`) ở nền và chi tiết trong modal bên trên.
 * F5 hoặc mở link trực tiếp vẫn ra đúng modal trên nền danh sách. Đóng modal (X, Esc, bấm nền) thì quay lại trang trước
 * trong ứng dụng (giữ bộ lọc của danh sách); mở thẳng từ link ngoài thì về `backTo`.
 *
 * ```tsx
 * { path: "users/:id", element: <DetailModalRoute list={<Users />} backTo="/admin/users"><UserDetail /></DetailModalRoute> }
 * ```
 */
export function DetailModalRoute({
  list,
  backTo,
  width = 960,
  children,
}: {
  list: ReactNode;
  backTo: string;
  width?: number;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const close = () => {
    if (location.key !== "default") void navigate(-1);
    else void navigate(backTo, { replace: true });
  };
  return (
    <>
      {list}
      <Modal
        open
        centered
        width={width}
        footer={null}
        onCancel={close}
        destroyOnHidden
        // Không đặt overflow/max-height ở body: thanh cuộn sẽ nằm sát nút đóng (X). Để lớp ngoài của antd cuộn khi nội dung dài.
        styles={{ body: { paddingTop: 8 } }}
      >
        <DetailModalContext.Provider value={{ close }}>{children}</DetailModalContext.Provider>
      </Modal>
    </>
  );
}
