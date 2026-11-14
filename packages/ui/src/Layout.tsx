import type { ReactNode } from "react";
import { Paragraph, Title } from "./antd";

export function Page({ children }: { children: ReactNode }) {
  return <main className="mx-auto w-full max-w-6xl px-6 pt-8 pb-16">{children}</main>;
}

export function PageHeader({ title, description }: { title: string; description?: ReactNode }) {
  return (
    <header className="mb-6">
      <Title level={2} className="mb-1">
        {title}
      </Title>
      {description && (
        <Paragraph type="secondary" className="mb-0">
          {description}
        </Paragraph>
      )}
    </header>
  );
}
