"use client";

import { Form, InputNumber } from "antd";
import { generationSections } from "@/services/api/generation-retention";

export function GenerationRetentionFields({ inherit = false }: { inherit?: boolean }) {
    return <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
        {generationSections.map((section) => <Form.Item key={section.key} name={["days", section.key]} label={section.label} rules={[{ required: true, message: "请输入保存天数" }]}>
            <InputNumber min={inherit ? 0 : 1} max={3650} precision={0} style={{ width: "100%" }} />
        </Form.Item>)}
    </div>;
}
