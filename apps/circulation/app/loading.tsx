import { Skeleton } from "@mfe/ui";

export default function Loading() {
  return (
    <div className="max-w-[960px]">
      <Skeleton active paragraph={{ rows: 6 }} />
    </div>
  );
}
