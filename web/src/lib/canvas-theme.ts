export type CanvasColorTheme = "light" | "dark";
export type CanvasBackgroundMode = "dots" | "lines" | "blank";

export const canvasThemes = {
    light: {
        canvas: {
            background: "#fafafa",
            dot: "rgba(0,0,0,.18)",
            line: "rgba(0,0,0,.07)",
            selectionStroke: "#171717",
            selectionFill: "rgba(0,0,0,.05)",
        },
        node: {
            label: "#666666",
            fill: "#f0f0f0",
            panel: "#ffffff",
            stroke: "#e2e2e2",
            activeStroke: "#171717",
            placeholder: "#a3a3a3",
            text: "#202020",
            muted: "#737373",
            faint: "#a3a3a3",
        },
        toolbar: {
            panel: "rgba(255,255,255,.96)",
            border: "#e2e2e2",
            item: "#666666",
            itemHover: "#f0f0f0",
            activeBg: "#f0f0f0",
            activeText: "#202020",
        },
    },
    dark: {
        canvas: {
            background: "#090909",
            dot: "rgba(255,255,255,.17)",
            line: "rgba(255,255,255,.07)",
            selectionStroke: "#fafafa",
            selectionFill: "rgba(255,255,255,.08)",
        },
        node: {
            label: "#c4c4c4",
            fill: "#202020",
            panel: "#111111",
            stroke: "#303030",
            activeStroke: "#fafafa",
            placeholder: "#a3a3a3",
            text: "#ededed",
            muted: "#c4c4c4",
            faint: "#737373",
        },
        toolbar: {
            panel: "rgba(17,17,17,.96)",
            border: "#303030",
            item: "#c4c4c4",
            itemHover: "#202020",
            activeBg: "#292929",
            activeText: "#ededed",
        },
    },
} as const;

export type CanvasTheme = (typeof canvasThemes)[CanvasColorTheme];
