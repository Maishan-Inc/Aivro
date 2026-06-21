"use client";

import { App, Input } from "antd";

import type { CloudWorkflow } from "@/services/api/workflows";

export const workflowNamePattern = /^[a-z0-9]+$/;

export function workflowConfirmName(workflow: Pick<CloudWorkflow, "slug" | "title">) {
    return workflow.slug || workflow.title;
}

export function useWorkflowModals() {
    const { message, modal } = App.useApp();

    const requestWorkflowName = (options: { title: string; username?: string; okText: string; placeholder?: string; defaultValue?: string }) =>
        new Promise<string>((resolve) => {
            let value = options.defaultValue || "";
            modal.confirm({
                title: options.title,
                width: 520,
                content: (
                    <div className="space-y-3 py-2">
                        <p className="text-sm text-stone-500">工作流名称仅限小写字母与数字。当前系统暂不支持随意修改公开 URL 名称。</p>
                        <Input
                            autoFocus
                            addonBefore={options.username ? `${options.username}/` : undefined}
                            defaultValue={value}
                            placeholder={options.placeholder || "例如 imageflow1"}
                            onChange={(event) => {
                                value = event.target.value.trim();
                            }}
                            onPressEnter={() => undefined}
                        />
                    </div>
                ),
                okText: options.okText,
                cancelText: "取消",
                onOk: () => {
                    if (!value) {
                        message.error("请填写工作流名称");
                        return Promise.reject();
                    }
                    if (!workflowNamePattern.test(value)) {
                        message.error("工作流名称仅限小写字母与数字");
                        return Promise.reject();
                    }
                    resolve(value);
                },
                onCancel: () => resolve(""),
            });
        });

    const confirmWorkflowDelete = async (workflow: Pick<CloudWorkflow, "slug" | "title">) => {
        const name = workflowConfirmName(workflow);
        const typed = await new Promise<string>((resolve) => {
            let value = "";
            modal.confirm({
                title: "删除工作流",
                width: 520,
                content: (
                    <div className="space-y-3 py-2">
                        <p className="text-sm text-stone-500">请输入工作流名称确认删除：{name}</p>
                        <Input
                            autoFocus
                            placeholder="输入工作流名称"
                            onChange={(event) => {
                                value = event.target.value.trim();
                            }}
                        />
                    </div>
                ),
                okText: "删除",
                okButtonProps: { danger: true },
                cancelText: "取消",
                onOk: () => {
                    if (value !== name && value !== workflow.title) {
                        message.error("工作流名称不匹配");
                        return Promise.reject();
                    }
                    resolve(name);
                },
                onCancel: () => resolve(""),
            });
        });
        if (!typed) return "";
        const second = await confirmStep(modal, {
            title: "再次确认删除",
            content: `确定删除「${workflow.title}」吗？`,
            okText: "确认删除",
        });
        if (!second) return "";
        const third = await confirmStep(modal, {
            title: "最后确认",
            content: "删除工作流不会返还新建工作流次数，是否删除？",
            okText: "删除",
        });
        return third ? typed : "";
    };

    return { requestWorkflowName, confirmWorkflowDelete };
}

function confirmStep(modal: ReturnType<typeof App.useApp>["modal"], options: { title: string; content: string; okText: string }) {
    return new Promise<boolean>((resolve) => {
        modal.confirm({
            title: options.title,
            content: options.content,
            okText: options.okText,
            okButtonProps: { danger: true },
            cancelText: "取消",
            onOk: () => resolve(true),
            onCancel: () => resolve(false),
        });
    });
}
