"use client";

import { useState } from "react";
import { ImageIcon } from "lucide-react";
import { promptImageUrl } from "@/lib/prompt-image-url";
import type { Prompt } from "@/services/api/prompts";
import { cn } from "@/lib/utils";

export function PromptLibraryImage({ prompt, className }: { prompt?: Prompt; className?: string }) {
    const [failedUrl, setFailedUrl] = useState("");
    const src = prompt?.coverUrl ? promptImageUrl(prompt.coverUrl) : "";
    return <div className={cn("relative isolate overflow-hidden bg-muted", className)}>
        {src && src !== failedUrl ? <img src={src} alt={prompt?.title || "提示词图库作品"} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" onError={() => setFailedUrl(src)} /> : <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground"><ImageIcon size={28} strokeWidth={1} /><span className="text-xs">{failedUrl === src && src ? "图片暂时无法加载" : "灵感图库"}</span></div>}
    </div>;
}
