import { Suspense } from "react";
import { JobBoard, JobListSkeleton } from "@/components/job-board";

export default function TeachingJobsPage() {
  return (
    <Suspense fallback={<JobListSkeleton />}>
      <JobBoard zone="teaching" />
    </Suspense>
  );
}
