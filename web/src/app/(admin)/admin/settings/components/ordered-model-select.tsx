"use client";

import type { ReactNode } from "react";
import { Button, Select, Tag } from "antd";
import { ChevronLeft, ChevronRight } from "lucide-react";

type OrderedModelSelectProps = {
    value?: string[];
    onChange?: (value: string[]) => void;
    options: { label: ReactNode; value: string }[];
    placeholder?: string;
};

export function OrderedModelSelect({ value = [], onChange, options, placeholder }: OrderedModelSelectProps) {
    const move = (model: string, offset: number) => {
        const index = value.indexOf(model);
        const target = index + offset;
        if (index < 0 || target < 0 || target >= value.length) return;
        const next = [...value];
        [next[index], next[target]] = [next[target], next[index]];
        onChange?.(next);
    };

    return <Select mode="multiple" value={value} onChange={onChange} options={options} placeholder={placeholder} tagRender={({ label, value: model, closable, onClose }) => {
        const index = value.indexOf(model);
        return <Tag closable={closable} onClose={onClose} className="my-0.5" style={{ display: "inline-flex", alignItems: "center", gap: 4, maxWidth: "100%" }} onMouseDown={(event) => { event.preventDefault(); event.stopPropagation(); }}>
            <Button type="text" size="small" disabled={index === 0} aria-label="前移模型" title="前移模型" className="!h-5 !w-5 !min-w-0" icon={<ChevronLeft className="size-3" />} onClick={(event) => { event.stopPropagation(); move(model, -1); }} />
            <span className="min-w-0 truncate">{label}</span>
            {index === 0 ? <span className="text-xs text-muted-foreground">默认</span> : null}
            <Button type="text" size="small" disabled={index === value.length - 1} aria-label="后移模型" title="后移模型" className="!h-5 !w-5 !min-w-0" icon={<ChevronRight className="size-3" />} onClick={(event) => { event.stopPropagation(); move(model, 1); }} />
        </Tag>;
    }} />;
}
