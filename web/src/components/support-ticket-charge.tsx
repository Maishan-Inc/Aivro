"use client";

import { Descriptions } from "antd";

import { useI18n } from "@/hooks/use-i18n";
import { formatDateTime, formatNumber } from "@/lib/datetime";
import { creditLogTypeLabels } from "@/lib/support-tickets";
import type { TicketCharge } from "@/services/api/support-tickets";

export function SupportTicketCharge({ charge }: { charge: TicketCharge }) {
    const { tr } = useI18n();
    return <section className="rounded-lg border border-border bg-muted/30 p-4">
        <h3 className="mb-3 text-sm font-medium">{tr("关联扣费信息")}</h3>
        <Descriptions size="small" column={1} items={[
            { key: "id", label: tr("流水编号"), children: <code className="break-all" data-i18n-skip>{charge.id}</code> },
            { key: "time", label: tr("扣费时间"), children: formatDateTime(charge.createdAt) },
            { key: "type", label: tr("类型"), children: tr(creditLogTypeLabels[charge.type] || charge.type) },
            { key: "model", label: tr("模型"), children: <span data-i18n-skip>{charge.model || "—"}</span> },
            { key: "amount", label: tr("扣费点数"), children: formatNumber(Math.abs(charge.amount)) },
            { key: "balance", label: tr("扣费后余额"), children: formatNumber(charge.balance) },
            { key: "path", label: tr("请求路径"), children: <code className="break-all" data-i18n-skip>{charge.path || "—"}</code> },
            { key: "related", label: tr("关联业务编号"), children: <code className="break-all" data-i18n-skip>{charge.relatedId || "—"}</code> },
            { key: "remark", label: tr("说明"), children: <span data-i18n-skip>{charge.type === "admin_adjust" && charge.remark !== "后台手动调整" ? charge.remark : tr(charge.remark)}</span> },
        ]} />
    </section>;
}
