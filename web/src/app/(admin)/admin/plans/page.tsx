"use client";

import { useCallback, useEffect, useState } from "react";
import { App, Button, Card, Col, Form, Input, InputNumber, Row, Switch, Tag } from "antd";

import { fetchAdminPlans, saveAdminPlan } from "@/services/api/admin";
import type { Plan } from "@/services/api/billing";
import { useUserStore } from "@/stores/use-user-store";

export default function AdminPlansPage() {
    const token = useUserStore((state) => state.token);
    const { message } = App.useApp();
    const [plans, setPlans] = useState<Plan[]>([]);
    const [savingId, setSavingId] = useState("");

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

    const save = async (plan: Plan, values: Partial<Plan>) => {
        if (!token) return;
        setSavingId(plan.id);
        try {
            await saveAdminPlan(token, { ...plan, ...values });
            message.success("已保存");
            await load();
        } catch (error) {
            message.error(error instanceof Error ? error.message : "保存失败");
        } finally {
            setSavingId("");
        }
    };

    return (
        <div className="p-6">
            <Row gutter={[16, 16]}>
                {plans.map((plan) => (
                    <Col key={plan.id} xs={24} xl={12}>
                        <Card title={<span>{plan.name} {plan.recommended ? <Tag color="gold">推荐</Tag> : null}</span>}>
                            <Form layout="vertical" initialValues={plan} onFinish={(values) => void save(plan, values)}>
                                <Row gutter={12}>
                                    <Col span={12}><Form.Item name="name" label="套餐名称"><Input /></Form.Item></Col>
                                    <Col span={12}><Form.Item name="currency" label="币种"><Input /></Form.Item></Col>
                                    <Col span={24}><Form.Item name="description" label="描述"><Input.TextArea rows={2} /></Form.Item></Col>
                                    <Col span={12}><Form.Item name="priceCents" label="价格（分）"><InputNumber min={0} className="w-full" /></Form.Item></Col>
                                    <Col span={12}><Form.Item name="credits" label="算力点额度"><InputNumber min={0} className="w-full" /></Form.Item></Col>
                                    <Col span={12}><Form.Item name="workflowCreateCredits" label="工作流创建次数"><InputNumber min={0} className="w-full" /></Form.Item></Col>
                                    <Col span={12}><Form.Item name="sort" label="排序"><InputNumber className="w-full" /></Form.Item></Col>
                                    <Col span={12}><Form.Item name="enabled" label="启用" valuePropName="checked"><Switch /></Form.Item></Col>
                                    <Col span={12}><Form.Item name="recommended" label="推荐" valuePropName="checked"><Switch /></Form.Item></Col>
                                </Row>
                                <Button type="primary" htmlType="submit" loading={savingId === plan.id}>保存套餐</Button>
                            </Form>
                        </Card>
                    </Col>
                ))}
            </Row>
        </div>
    );
}
