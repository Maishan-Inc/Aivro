"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { App, Button, Card, Form, Input, InputNumber, Modal, Segmented, Switch, Tabs, Tag } from "antd";
import { Pencil, Plus, Sparkles, Trash2 } from "lucide-react";

import { fetchAdminPlans, saveAdminPlan } from "@/services/api/admin";
import type { Plan, PlanTranslation } from "@/services/api/billing";
import { localeLabels, type Locale } from "@/i18n/messages";
import { useUserStore } from "@/stores/use-user-store";

const localeKeys = Object.keys(localeLabels) as Locale[];

const emptyTranslation: PlanTranslation = {
    name: "",
    description: "",
    features: [],
    priceCents: 0,
    currency: "",
    credits: 0,
    workflowCreateCredits: 0,
};

function blankPlan(): Plan {
    return {
        id: "",
        code: "go",
        name: "",
        description: "",
        features: [],
        priceCents: 0,
        currency: "USD",
        credits: 0,
        workflowCreateCredits: 0,
        enabled: true,
        recommended: false,
        sort: 0,
        translations: {},
    };
}

export default function AdminPlansPage() {
    const token = useUserStore((state) => state.token);
    const { message } = App.useApp();
    const [plans, setPlans] = useState<Plan[]>([]);
    const [editing, setEditing] = useState<Plan | null>(null);
    const [saving, setSaving] = useState(false);
    const [form] = Form.useForm();

    const load = useCallback(async () => {
        if (!token) return;
        try {
            setPlans(await fetchAdminPlans(token));
        } catch (error) {
            message.error(error instanceof Error ? error.message : "读取套餐失败");
        }
    }, [message, token]);

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => {
        const refreshPlans = () => {
            if (document.visibilityState === "visible") void load();
        };
        window.addEventListener("focus", refreshPlans);
        document.addEventListener("visibilitychange", refreshPlans);
        return () => {
            window.removeEventListener("focus", refreshPlans);
            document.removeEventListener("visibilitychange", refreshPlans);
        };
    }, [load]);

    const openEditor = (plan: Plan) => {
        const translations = { ...(plan.translations || {}) } as Record<string, PlanTranslation>;
        for (const key of localeKeys) {
            translations[key] = { ...emptyTranslation, ...(translations[key] || {}) };
        }
        const next = { ...plan, features: plan.features || [], translations };
        setEditing(next);
        form.setFieldsValue(next);
    };

    const closeEditor = () => {
        setEditing(null);
        form.resetFields();
    };

    const submit = async () => {
        if (!token || !editing) return;
        const values = await form.validateFields();
        values.features = cleanFeatureInputs(values.features);
        // Drop fully-empty translation entries so the backend only stores real overrides.
        const translations: Record<string, PlanTranslation> = {};
        for (const key of localeKeys) {
            const tr = { ...((values.translations?.[key] || {}) as PlanTranslation), features: cleanFeatureInputs(values.translations?.[key]?.features) };
            const hasOverride = tr.name || tr.description || tr.features?.length || tr.currency || tr.priceCents || tr.credits || tr.workflowCreateCredits;
            if (hasOverride) translations[key] = { ...emptyTranslation, ...tr };
        }
        setSaving(true);
        try {
            await saveAdminPlan(token, { ...editing, ...values, translations });
            message.success("已保存");
            closeEditor();
            await load();
        } catch (error) {
            message.error(error instanceof Error ? error.message : "保存失败");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-3 sm:p-4 lg:p-6">
            <PlanGrid plans={plans} onEdit={openEditor} onCreate={() => openEditor(blankPlan())} />
            <PlanEditorModal open={!!editing} editing={editing} form={form} saving={saving} onCancel={closeEditor} onSubmit={submit} />
        </div>
    );
}

function PlanGrid({ plans, onEdit, onCreate }: { plans: Plan[]; onEdit: (plan: Plan) => void; onCreate: () => void }) {
    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {plans.map((plan) => (
                <PlanCard key={plan.id} plan={plan} onEdit={() => onEdit(plan)} />
            ))}
            <button
                type="button"
                onClick={onCreate}
                className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-stone-300 bg-stone-50/60 text-stone-500 transition hover:border-stone-400 hover:bg-stone-100 hover:text-stone-700 dark:border-stone-700 dark:bg-stone-900/40 dark:text-stone-400 dark:hover:border-stone-600 dark:hover:bg-stone-900"
            >
                <span className="flex size-12 items-center justify-center rounded-full bg-stone-200/70 dark:bg-stone-800">
                    <Plus className="size-6" />
                </span>
                <span className="text-sm font-medium">新增套餐</span>
            </button>
        </div>
    );
}

function PlanCard({ plan, onEdit }: { plan: Plan; onEdit: () => void }) {
    const localeCount = Object.keys(plan.translations || {}).length;
    return (
        <Card
            hoverable
            onClick={onEdit}
            className="group relative overflow-hidden"
            styles={{ body: { padding: 20 } }}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="truncate text-lg font-semibold">{plan.name || plan.code.toUpperCase()}</span>
                        <Tag className="m-0 uppercase">{plan.code}</Tag>
                    </div>
                    <p className="mt-1 line-clamp-2 min-h-[40px] text-sm text-stone-500 dark:text-stone-400">{plan.description || "—"}</p>
                </div>
                <Pencil className="size-4 shrink-0 text-stone-400 opacity-0 transition group-hover:opacity-100" />
            </div>
            <div className="mt-4 flex items-end gap-1">
                <span className="text-2xl font-semibold">{formatPrice(plan)}</span>
                <span className="pb-1 text-xs font-medium uppercase text-stone-400">{plan.currency}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <Tag color="blue" className="m-0 flex items-center gap-1">
                    <Sparkles className="size-3" />
                    {plan.credits} 算力点
                </Tag>
                <Tag className="m-0">{plan.workflowCreateCredits} 次工作流</Tag>
                <Tag className="m-0">排序 {plan.sort}</Tag>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
                {plan.enabled ? <Tag color="green" className="m-0">已启用</Tag> : <Tag className="m-0">未启用</Tag>}
                {plan.recommended ? <Tag color="gold" className="m-0">推荐</Tag> : null}
                {localeCount ? <Tag color="purple" className="m-0">{localeCount} 个语言覆盖</Tag> : null}
            </div>
        </Card>
    );
}

function formatPrice(plan: Plan) {
    if (plan.priceCents <= 0) return "0";
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(plan.priceCents / 100);
}

function cleanFeatureInputs(items: unknown) {
    if (!Array.isArray(items)) return [];
    return items.map((item) => String(item || "").trim()).filter(Boolean);
}

type PlanFormInstance = ReturnType<typeof Form.useForm>[0];

function PlanEditorModal({
    open,
    editing,
    form,
    saving,
    onCancel,
    onSubmit,
}: {
    open: boolean;
    editing: Plan | null;
    form: PlanFormInstance;
    saving: boolean;
    onCancel: () => void;
    onSubmit: () => void;
}) {
    const isNew = !editing?.id;
    const tabItems = useMemo(
        () => [
            { key: "base", label: "基础设置", children: <PlanBaseFields /> },
            ...localeKeys.map((key) => ({
                key,
                label: localeLabels[key],
                children: <PlanTranslationFields locale={key} />,
            })),
        ],
        [],
    );

    return (
        <Modal
            title={isNew ? "新增套餐" : `编辑套餐 · ${editing?.name || editing?.code.toUpperCase()}`}
            open={open}
            onCancel={onCancel}
            onOk={onSubmit}
            confirmLoading={saving}
            okText="保存套餐"
            cancelText="取消"
            width={680}
            centered
            destroyOnClose
        >
            <Form form={form} layout="vertical" preserve={false}>
                <Tabs items={tabItems} />
            </Form>
        </Modal>
    );
}

function PlanBaseFields() {
    return (
        <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
            <Form.Item name="name" label="套餐名称" className="md:col-span-1">
                <Input placeholder="GO / Plus / Pro / Max" />
            </Form.Item>
            <Form.Item name="code" label="套餐代码" className="md:col-span-1">
                <Segmented options={["go", "plus", "pro", "max"]} block />
            </Form.Item>
            <Form.Item name="description" label="描述" className="md:col-span-2">
                <Input.TextArea rows={2} placeholder="适合 AI 创作的灵活额度。" />
            </Form.Item>
            <PlanFeatureFields name="features" label="卡片功能点" className="md:col-span-2" />
            <Form.Item name="priceCents" label="价格（分）" className="md:col-span-1">
                <InputNumber min={0} className="w-full" />
            </Form.Item>
            <Form.Item name="currency" label="币种" className="md:col-span-1">
                <Input placeholder="USD" />
            </Form.Item>
            <Form.Item name="credits" label="算力点额度" className="md:col-span-1">
                <InputNumber min={0} className="w-full" />
            </Form.Item>
            <Form.Item name="workflowCreateCredits" label="工作流创建次数" className="md:col-span-1">
                <InputNumber min={0} className="w-full" />
            </Form.Item>
            <Form.Item name="sort" label="排序" className="md:col-span-1">
                <InputNumber className="w-full" />
            </Form.Item>
            <div className="flex items-end gap-6 pb-6 md:col-span-1">
                <Form.Item name="enabled" label="启用" valuePropName="checked" className="mb-0">
                    <Switch />
                </Form.Item>
                <Form.Item name="recommended" label="推荐" valuePropName="checked" className="mb-0">
                    <Switch />
                </Form.Item>
            </div>
        </div>
    );
}

function PlanTranslationFields({ locale }: { locale: Locale }) {
    return (
        <div>
            <p className="mb-4 text-xs leading-5 text-stone-500 dark:text-stone-400">该语言下的独立设置；留空的字段会沿用基础设置。算力点和次数仅在大于 0 时覆盖。</p>
            <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
                <Form.Item name={["translations", locale, "name"]} label="套餐名称" className="md:col-span-1">
                    <Input placeholder="沿用基础设置" />
                </Form.Item>
                <Form.Item name={["translations", locale, "currency"]} label="币种" className="md:col-span-1">
                    <Input placeholder="沿用基础设置" />
                </Form.Item>
                <Form.Item name={["translations", locale, "description"]} label="描述" className="md:col-span-2">
                    <Input.TextArea rows={2} placeholder="沿用基础设置" />
                </Form.Item>
                <PlanFeatureFields name={["translations", locale, "features"]} label="卡片功能点" className="md:col-span-2" />
                <Form.Item name={["translations", locale, "priceCents"]} label="价格（分）" className="md:col-span-1">
                    <InputNumber min={0} className="w-full" placeholder="沿用基础设置" />
                </Form.Item>
                <Form.Item name={["translations", locale, "credits"]} label="算力点额度" className="md:col-span-1">
                    <InputNumber min={0} className="w-full" placeholder="沿用基础设置" />
                </Form.Item>
                <Form.Item name={["translations", locale, "workflowCreateCredits"]} label="工作流创建次数" className="md:col-span-2">
                    <InputNumber min={0} className="w-full" placeholder="沿用基础设置" />
                </Form.Item>
            </div>
        </div>
    );
}

function PlanFeatureFields({ name, label, className }: { name: string | (string | number)[]; label: string; className?: string }) {
    return (
        <Form.Item label={label} className={className}>
            <Form.List name={name}>
                {(fields, { add, remove }) => (
                    <div className="flex flex-col gap-2">
                        {fields.map((field) => (
                            <div key={field.key} className="flex gap-2">
                                <Form.Item {...field} className="mb-0 flex-1">
                                    <Input placeholder="例如：300 算力点" />
                                </Form.Item>
                                <Button aria-label="删除功能点" icon={<Trash2 className="size-4" />} onClick={() => remove(field.name)} />
                            </div>
                        ))}
                        <Button type="dashed" icon={<Plus className="size-4" />} onClick={() => add("")}>
                            新增功能点
                        </Button>
                    </div>
                )}
            </Form.List>
        </Form.Item>
    );
}
