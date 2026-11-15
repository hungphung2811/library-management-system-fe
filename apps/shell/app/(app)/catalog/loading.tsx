import { Skeleton } from "@mfe/ui";

export default function Loading() {
  return (
    <div className="max-w-[1200px]" aria-busy="true">
      <Skeleton active paragraph={{ rows: 5 }} />
    </div>
  );
}
