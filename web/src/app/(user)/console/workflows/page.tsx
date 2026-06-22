"use client";

import { WorkflowLibraryView } from "@/app/(user)/canvas/components/workflow-library-view";

export default function ConsoleWorkflowsPage() {
    return <WorkflowLibraryView initialTab="workflows" lockTab redirectPath="/console/workflows" embedded />;
}
