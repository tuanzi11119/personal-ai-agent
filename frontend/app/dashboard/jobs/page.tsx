import { Suspense } from "react";
import { JobBoard, JobListSkeleton } from "@/components/job-board";

export default function JobsPage() {
  return (
    <Suspense fallback={<JobListSkeleton />}>
      <JobBoard zone="all" />
    </Suspense>
  );
}
