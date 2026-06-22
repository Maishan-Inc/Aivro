"use client";

import { WorkflowLibraryView } from "@/app/(user)/canvas/components/workflow-library-view";

export default function ConsoleCommunityPage() {
    return <WorkflowLibraryView initialTab="community" lockTab redirectPath="/console/community" embedded />;
}
