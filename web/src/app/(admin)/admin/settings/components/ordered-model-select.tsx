"use client";

import { useRef, type ReactNode } from "react";
import { Button, Select, Tag } from "antd";
import { ChevronLeft, ChevronRight, GripVertical } from "lucide-react";
import { useI18n } from "@/hooks/use-i18n";

type OrderedModelSelectProps = {
    value?: string[];
    onChange?: (value: string[]) => void;
    options: { label: ReactNode; value: string; disabled?: boolean }[];
    placeholder?: string;
};

export function OrderedModelSelect({ value = [], onChange, options, placeholder }: OrderedModelSelectProps) {
    const { tr } = useI18n();
    const dragged = useRef<string | null>(null);
    const move = (model: string, offset: number) => {
        const index = value.indexOf(model);
        const target = index + offset;
        if (index < 0 || target < 0 || target >= value.length) return;
        const next = [...value];
        [next[index], next[target]] = [next[target], next[index]];
        onChange?.(next);
    };

    return <Select mode="multiple" listHeight={192} value={value} onChange={onChange} options={options} placeholder={placeholder} tagRender={({ label, value: model, closable, onClose }) => {
        const index = value.indexOf(model);
        return <Tag closable={closable} onClose={onClose} draggable className="my-0.5 cursor-grab active:cursor-grabbing" style={{ display: "inline-flex", alignItems: "center", gap: 4, maxWidth: "100%" }} onMouseDown={(event) => event.stopPropagation()} onDragStart={(event) => { dragged.current = model; event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", model); event.stopPropagation(); }} onDragOver={(event) => { if (dragged.current) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; } }} onDrop={(event) => {
            event.preventDefault(); event.stopPropagation();
            const source = dragged.current;
            dragged.current = null;
            if (!source || source === model) return;
            const next = value.filter((item) => item !== source);
            next.splice(index, 0, source);
            onChange?.(next);
        }} onDragEnd={() => { dragged.current = null; }}>
            <GripVertical className="size-3 text-muted-foreground" aria-label={tr("拖拽排序")} />
            <Button type="text" size="small" disabled={index === 0} aria-label="前移模型" title="前移模型" className="!h-5 !w-5 !min-w-0" icon={<ChevronLeft className="size-3" />} onClick={(event) => { event.stopPropagation(); move(model, -1); }} />
            <span className="min-w-0 truncate">{label}</span>
            {index === 0 ? <span className="text-xs text-muted-foreground">默认</span> : null}
            <Button type="text" size="small" disabled={index === value.length - 1} aria-label="后移模型" title="后移模型" className="!h-5 !w-5 !min-w-0" icon={<ChevronRight className="size-3" />} onClick={(event) => { event.stopPropagation(); move(model, 1); }} />
        </Tag>;
    }} />;
}
