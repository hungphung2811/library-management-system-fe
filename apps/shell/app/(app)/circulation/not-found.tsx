import { Button, Result } from "@mfe/ui";

export default function NotFound() {
  return (
    <Result
      status="404"
      title="Không tìm thấy trang"
      extra={<Button href="/circulation">Về trang mượn trả</Button>}
    />
  );
}
