"use client";

import { ApiOutlined, AuditOutlined, DatabaseOutlined, FileTextOutlined, GlobalOutlined, HomeOutlined, LogoutOutlined, MailOutlined, PictureOutlined, ShareAltOutlined, ShoppingOutlined, SettingOutlined, TransactionOutlined, UserOutlined } from "@ant-design/icons";
import { Button, Dropdown, Flex, Layout, Menu, Typography, theme } from "antd";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect } from "react";

import { UserStatusActions } from "@/components/layout/user-status-actions";
import { localeLabels, type Locale } from "@/i18n/messages";
import { adminLayoutStyle } from "@/lib/app-theme";
import { useLocaleStore } from "@/stores/use-locale-store";
import { useUserStore } from "@/stores/use-user-store";

const adminMenus = [
    { key: "/admin/users", icon: <UserOutlined />, label: "用户管理" },
    { key: "/admin/request-logs", icon: <TransactionOutlined />, label: "请求日志" },
    { key: "/admin/audit-logs", icon: <AuditOutlined />, label: "日志审计" },
    { key: "/admin/plans", icon: <ShoppingOutlined />, label: "套餐管理" },
    { key: "/admin/prompts", icon: <FileTextOutlined />, label: "提示词管理" },
    { key: "/admin/assets", icon: <PictureOutlined />, label: "素材库" },
    { key: "/admin/workflow-community", icon: <ShareAltOutlined />, label: "社区工作流" },
    { key: "/admin/ads", icon: <GlobalOutlined />, label: "谷歌广告" },
    { key: "/admin/database", icon: <DatabaseOutlined />, label: "数据库配置" },
    { key: "/admin/settings?tab=model", icon: <ApiOutlined />, label: "模型配置" },
    { key: "/admin/settings?tab=mail", icon: <MailOutlined />, label: "邮件设置" },
    { key: "/admin/settings", icon: <SettingOutlined />, label: "系统设置" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
    const { token: antToken } = theme.useToken();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const token = useUserStore((state) => state.token);
    const user = useUserStore((state) => state.user);
    const isReady = useUserStore((state) => state.isReady);
    const hydrateUser = useUserStore((state) => state.hydrateUser);
    const logout = useUserStore((state) => state.clearSession);
    const locale = useLocaleStore((state) => state.locale);
    const setLocale = useLocaleStore((state) => state.setLocale);
    const settingsTab = pathname.startsWith("/admin/settings") ? searchParams.get("tab") : "";
    const activeKey = settingsTab === "model" ? "/admin/settings?tab=model" : settingsTab === "mail" ? "/admin/settings?tab=mail" : adminMenus.find((item) => pathname.startsWith(item.key))?.key || "";
    const pageTitle = settingsTab === "model" ? "模型配置" : settingsTab === "mail" ? "邮件设置" : pathname.startsWith("/admin/settings") ? "系统设置" : pathname.startsWith("/admin/database") ? "数据库配置" : pathname.startsWith("/admin/ads") ? "谷歌广告" : pathname.startsWith("/admin/workflow-community") ? "社区工作流" : pathname.startsWith("/admin/assets") ? "素材库管理" : pathname.startsWith("/admin/prompts") ? "提示词管理" : pathname.startsWith("/admin/plans") ? "套餐管理" : pathname.startsWith("/admin/audit-logs") ? "日志审计" : pathname.startsWith("/admin/request-logs") || pathname.startsWith("/admin/credit-logs") ? "请求日志" : "用户管理";
    const languageItems = (Object.keys(localeLabels) as Locale[]).map((item) => ({ key: item, label: localeLabels[item] }));

    useEffect(() => {
        if (!isReady) return;
        if (!token) {
            router.replace("/login?redirect=/admin");
            return;
        }
        if (user?.role !== "admin") {
            router.replace("/");
        }
    }, [isReady, router, token, user?.role]);

    useEffect(() => {
        if (!isReady || !token) return;
        void hydrateUser();
    }, [hydrateUser, isReady, pathname, token]);

    useEffect(() => {
        if (!token) return;
        const refreshUser = () => {
            if (document.visibilityState === "visible") void hydrateUser();
        };
        window.addEventListener("focus", refreshUser);
        document.addEventListener("visibilitychange", refreshUser);
        return () => {
            window.removeEventListener("focus", refreshUser);
            document.removeEventListener("visibilitychange", refreshUser);
        };
    }, [hydrateUser, token]);

    if (!isReady || !token || user?.role !== "admin") {
        return (
            <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", background: antToken.colorBgLayout }}>
                <span />
            </div>
        );
    }

    return (
        <Layout hasSider style={{ height: "100vh", overflow: "hidden", background: antToken.colorBgLayout }}>
            <Layout.Sider width={adminLayoutStyle.siderWidth} style={{ height: "100vh", overflow: "hidden", background: antToken.colorBgContainer, borderRight: `1px solid ${antToken.colorBorder}` }}>
                <Flex align="center" justify="center" gap={12} style={{ height: adminLayoutStyle.brandHeight, padding: "0 20px", borderBottom: `1px solid ${antToken.colorBorderSecondary}` }}>
                    <span aria-hidden style={{ display: "inline-block", width: 30, height: 30, background: antToken.colorText, WebkitMask: "url(/logo.svg) center / contain no-repeat", mask: "url(/logo.svg) center / contain no-repeat" }} />
                    <Typography.Text strong style={{ fontSize: 18, letterSpacing: 0 }}>
                        Aivro
                    </Typography.Text>
                </Flex>
                <Menu
                    mode="inline"
                    selectedKeys={[activeKey]}
                    style={adminLayoutStyle.menu}
                    items={adminMenus.map((item) => ({
                        ...item,
                        label: (
                            <Link href={item.key} style={{ color: "inherit" }}>
                                {item.label}
                            </Link>
                        ),
                        style: adminLayoutStyle.menuItem,
                    }))}
                />
                <Flex vertical gap={8} style={{ position: "absolute", bottom: 0, insetInline: 0, padding: 12, borderTop: `1px solid ${antToken.colorBorder}`, background: antToken.colorBgContainer }}>
                    <Button block icon={<HomeOutlined />} href="/" target="_blank" rel="noreferrer">
                        前往站点首页
                    </Button>
                    <Button block icon={<LogoutOutlined />} onClick={logout}>
                        退出登录
                    </Button>
                </Flex>
            </Layout.Sider>
            <Layout style={{ background: antToken.colorBgLayout }}>
                <Layout.Header
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: adminLayoutStyle.headerHeight, padding: "0 24px", background: antToken.colorBgContainer, borderBottom: `1px solid ${antToken.colorBorder}` }}
                >
                    <Typography.Title level={5} style={{ margin: 0 }}>
                        {pageTitle}
                    </Typography.Title>
                    <Flex align="center" gap={4}>
                        <Dropdown menu={{ items: languageItems, selectable: true, selectedKeys: [locale], onClick: ({ key }) => setLocale(key as Locale) }} trigger={["click"]}>
                            <Button icon={<GlobalOutlined />}>{localeLabels[locale]}</Button>
                        </Dropdown>
                        <UserStatusActions />
                    </Flex>
                </Layout.Header>
                <Layout.Content style={{ minHeight: 0, overflow: "auto" }}>
                    {children}
                    <div style={{ padding: "12px 24px", textAlign: "center", color: antToken.colorTextTertiary, fontSize: 12 }}>Copyright © 2026 Maishan Inc. All rights reserved Aivro</div>
                </Layout.Content>
            </Layout>
        </Layout>
    );
}
