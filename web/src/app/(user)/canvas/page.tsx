"use client";

import { ConsoleShell } from "@/components/console-shell";
import { WorkflowLibraryView } from "@/app/(user)/canvas/components/workflow-library-view";

export default function CanvasPage() {
    return (
        <ConsoleShell>
            <WorkflowLibraryView initialTab="workflows" lockTab embedded redirectPath="/canvas" />
        </ConsoleShell>
    );
}
