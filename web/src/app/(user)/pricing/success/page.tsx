"use client";

import { Button, Card } from "antd";
import Link from "next/link";

import { useLocalizedPath } from "@/hooks/use-localized-path";
import { useUserStore } from "@/stores/use-user-store";

export default function PricingSuccessPage() {
    const hydrateUser = useUserStore((state) => state.hydrateUser);
    const user = useUserStore((state) => state.user);
    const localizedPath = useLocalizedPath();

    return (
        <main className="grid min-h-screen place-items-center bg-background px-6">
            <Card className="w-full max-w-md text-center">
                <h1 className="text-2xl font-semibold">支付处理中</h1>
                <p className="mt-3 text-sm text-stone-500">额度会在 Stripe webhook 确认后到账。若已支付成功，可以刷新用户信息查看最新余额。</p>
                <div className="mt-5 rounded-lg bg-stone-50 p-3 text-sm dark:bg-stone-900">
                    算力点：{user?.credits ?? 0} · 工作流创建次数：{user?.workflowCreateCredits ?? 0}
                </div>
                <div className="mt-6 flex justify-center gap-3">
                    <Button onClick={() => void hydrateUser()}>刷新用户信息</Button>
                    <Link href={localizedPath("/canvas")}><Button type="primary">返回工作流</Button></Link>
                </div>
            </Card>
        </main>
    );
}
