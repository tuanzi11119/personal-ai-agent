import { Suspense } from "react";
import { JobBoard } from "@/components/job-board";
import { Spinner } from "@/components/ui/card";

export default function CsJobsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center gap-2 text-muted-foreground">
          <Spinner /> 正在加载岗位…
        </div>
      }
    >
      <JobBoard zone="cs" />
    </Suspense>
  );
}
