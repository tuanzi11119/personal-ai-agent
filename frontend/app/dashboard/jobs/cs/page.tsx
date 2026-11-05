import { Suspense } from "react";
import { JobBoard, JobListSkeleton } from "@/components/job-board";

export default function CsJobsPage() {
  return (
    <Suspense fallback={<JobListSkeleton />}>
      <JobBoard zone="cs" />
    </Suspense>
  );
}
