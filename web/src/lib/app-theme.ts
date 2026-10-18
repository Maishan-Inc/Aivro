import type { CSSProperties } from "react";
import type { ThemeConfig } from "antd";
import { theme as antdTheme } from "antd";

const neutral = {
    light: {
        primary: "#171717",
        primaryHover: "#000000",
        primaryText: "#ffffff",
        menuBg: "#f5f5f5",
        menuText: "#171717",
        selectActiveBg: "#f5f5f5",
        selectSelectedBg: "#f0f0f0",
        selectText: "#171717",
        tableSelectedBg: "rgba(17, 17, 17, 0.05)",
        tableSelectedHoverBg: "rgba(17, 17, 17, 0.08)",
    },
    dark: {
        primary: "#fafafa",
        primaryHover: "#ffffff",
        primaryText: "#171717",
        menuBg: "#262626",
        menuText: "#fafafa",
        selectActiveBg: "#262626",
        selectSelectedBg: "#333333",
        selectText: "#fafafa",
        tableSelectedBg: "rgba(255, 255, 255, 0.08)",
        tableSelectedHoverBg: "rgba(255, 255, 255, 0.12)",
    },
};

export const adminLayoutStyle = {
    siderWidth: 232,
    headerHeight: 64,
    brandHeight: 64,
    menu: { borderInlineEnd: 0, padding: "18px 12px", fontSize: 15 } satisfies CSSProperties,
    menuItem: { height: 44, lineHeight: "44px", marginBlock: 4, borderRadius: 8 } satisfies CSSProperties,
};

export function getAntThemeConfig(dark: boolean): ThemeConfig {
    const color = dark ? neutral.dark : neutral.light;

    return {
        algorithm: dark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        cssVar: { key: dark ? "aivro-dark" : "aivro-light" },
        token: {
            borderRadius: 6,
            colorBgBase: dark ? "#090909" : "#ffffff",
            colorBgContainer: dark ? "#0d0d0d" : "#ffffff",
            colorBgElevated: dark ? "#141414" : "#ffffff",
            colorBgLayout: dark ? "#090909" : "#fafafa",
            colorBorder: dark ? "#2a2a2a" : "#e5e5e5",
            colorBorderSecondary: dark ? "#222222" : "#ebebeb",
            colorText: dark ? "#ededed" : "#171717",
            colorTextSecondary: dark ? "#a1a1a1" : "#666666",
            fontFamily: '"SF Pro Display", "PingFang SC", "Microsoft YaHei", sans-serif',
            controlHeight: 36,
            colorPrimary: color.primary,
            colorInfo: color.primary,
            colorLink: color.primary,
            colorLinkHover: color.primaryHover,
            colorLinkActive: color.primary,
            colorTextLightSolid: color.primaryText,
        },
        components: {
            Button: {
                primaryShadow: "none",
                defaultShadow: "none",
            },
            Card: { boxShadowTertiary: "none" },
            Input: { activeShadow: "0 0 0 2px rgba(128,128,128,.12)" },
            Menu: {
                itemActiveBg: color.menuBg,
                itemHoverBg: color.menuBg,
                itemSelectedBg: color.menuBg,
                itemSelectedColor: color.menuText,
                darkItemHoverBg: neutral.dark.menuBg,
                darkItemSelectedBg: neutral.dark.menuBg,
                darkItemSelectedColor: neutral.dark.menuText,
            },
            Select: {
                optionActiveBg: color.selectActiveBg,
                optionSelectedBg: color.selectSelectedBg,
                optionSelectedColor: color.selectText,
            },
            Table: {
                rowSelectedBg: color.tableSelectedBg,
                rowSelectedHoverBg: color.tableSelectedHoverBg,
            },
        },
    };
}
