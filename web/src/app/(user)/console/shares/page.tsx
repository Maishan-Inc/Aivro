"use client";

import { WorkflowLibraryView } from "@/app/(user)/canvas/components/workflow-library-view";

export default function ConsoleSharesPage() {
    return <WorkflowLibraryView initialTab="shares" lockTab redirectPath="/console/shares" embedded />;
}
