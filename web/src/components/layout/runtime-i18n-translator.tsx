"use client";

import { useEffect } from "react";

import { runtimeEnglishTranslations } from "@/i18n/runtime-translations";
import { useLocaleStore } from "@/stores/use-locale-store";

const textOriginals = new WeakMap<Text, string>();
const textTranslations = new WeakMap<Text, string>();
const attrOriginals = new WeakMap<Element, Map<string, string>>();
const attrTranslations = new WeakMap<Element, Map<string, string>>();
const translatableAttrs = ["placeholder", "title", "aria-label", "alt"];
const textSkipSelector = "script,style,textarea,input,pre,code,kbd,samp,[contenteditable='true'],[data-i18n-skip]";
const attrSkipSelector = "script,style,pre,code,kbd,samp,[data-i18n-skip]";
const hasChinese = /[\u3400-\u9fff]/;
const sortedTranslations = Object.entries(runtimeEnglishTranslations).sort((a, b) => b[0].length - a[0].length);

export function RuntimeI18nTranslator() {
    const locale = useLocaleStore((state) => state.locale);

    useEffect(() => {
        const translateRoot = () => translateNode(document.body, locale);
        translateRoot();
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === "characterData") {
                    translateNode(mutation.target, locale);
                    continue;
                }
                if (mutation.type === "attributes") {
                    translateNode(mutation.target, locale);
                    continue;
                }
                mutation.addedNodes.forEach((node) => translateNode(node, locale));
            }
        });
        observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: translatableAttrs });
        return () => observer.disconnect();
    }, [locale]);

    return null;
}

function translateNode(node: Node, locale: string) {
    if (node.nodeType === Node.TEXT_NODE) {
        translateTextNode(node as Text, locale);
        return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as Element;
    translateElementAttrs(element, locale);
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    for (let current = walker.nextNode(); current; current = walker.nextNode()) {
        translateTextNode(current as Text, locale);
    }
    element.querySelectorAll<HTMLElement>(translatableAttrs.map((attr) => `[${attr}]`).join(",")).forEach((item) => translateElementAttrs(item, locale));
}

function translateTextNode(node: Text, locale: string) {
    const parent = node.parentElement;
    if (!parent || parent.closest(textSkipSelector)) return;
    const current = node.nodeValue || "";
    if (locale !== "en-US") {
        if (hasChinese.test(current)) {
            textOriginals.set(node, current);
            return;
        }
        const original = textOriginals.get(node);
        if (original && textTranslations.get(node) === current && current !== original) node.nodeValue = original;
        return;
    }
    const source = hasChinese.test(current) ? current : textTranslations.get(node) === current ? textOriginals.get(node) : "";
    if (!source || !hasChinese.test(source)) return;
    textOriginals.set(node, source);
    const translated = translateUIText(source);
    textTranslations.set(node, translated);
    if (translated !== current) node.nodeValue = translated;
}

function translateElementAttrs(element: Element, locale: string) {
    if (element.closest(attrSkipSelector)) return;
    for (const attr of translatableAttrs) {
        const current = element.getAttribute(attr);
        if (!current) continue;
        const originals = attrOriginals.get(element) || new Map<string, string>();
        if (!attrOriginals.has(element)) attrOriginals.set(element, originals);
        const translations = attrTranslations.get(element) || new Map<string, string>();
        if (!attrTranslations.has(element)) attrTranslations.set(element, translations);
        if (locale !== "en-US") {
            if (hasChinese.test(current)) {
                originals.set(attr, current);
                continue;
            }
            const original = originals.get(attr);
            if (original && translations.get(attr) === current && current !== original) element.setAttribute(attr, original);
            continue;
        }
        const source = hasChinese.test(current) ? current : translations.get(attr) === current ? originals.get(attr) : "";
        if (!source || !hasChinese.test(source)) continue;
        originals.set(attr, source);
        const translated = translateUIText(source);
        translations.set(attr, translated);
        if (translated !== current) element.setAttribute(attr, translated);
    }
}

function translateUIText(value: string) {
    if (!hasChinese.test(value)) return value;
    const leading = value.match(/^\s*/)?.[0] || "";
    const trailing = value.match(/\s*$/)?.[0] || "";
    const body = value.trim();
    const exact = runtimeEnglishTranslations[body];
    if (exact) return `${leading}${exact}${trailing}`;

    let output = body
        .replace(/(\d+)\s*张/g, "$1 images")
        .replace(/(\d+)\s*个节点/g, "$1 nodes")
        .replace(/(\d+)\s*条连线/g, "$1 connections")
        .replace(/(\d+)\s*个素材/g, "$1 assets")
        .replace(/(\d+)\s*个模型/g, "$1 models")
        .replace(/(\d+)\s*个云端工作流/g, "$1 cloud workflows")
        .replace(/(\d+)\s*次创建/g, "$1 creations")
        .replace(/(\d+)\s*个会话/g, "$1 sessions")
        .replace(/(\d+)\s*条记录/g, "$1 records")
        .replace(/(\d+)\s*次工作流创建次数/g, "$1 workflow creations")
        .replace(/生成了\s*(\d+)\s*张图片/g, "Generated $1 images")
        .replace(/显示\s*(\d+)\s*\/\s*(\d+)/g, "Showing $1/$2")
        .replace(/奖励\s*(\d+)\s*算力点\s*\/\s*(\d+)\s*次工作流/g, "Reward $1 credits / $2 workflow creations")
        .replace(/通过奖励：\s*(\d+)\s*算力点，\s*(\d+)\s*次工作流创建次数。/g, "Reward on pass: $1 credits and $2 workflow creations.")
        .replace(/将删除\s*(\d+)\s*条对话记录，此操作不可撤销。/g, "This will delete $1 chat records. This action cannot be undone.")
        .replace(/(\d+)\s*条消息/g, "$1 messages")
        .replace(/Token\s*(\d+)，消耗\s*(\d+)\s*算力点（估算）/g, "Token $1, used $2 credits (estimated)")
        .replace(/Token\s*(\d+)，消耗\s*(\d+)\s*算力点/g, "Token $1, used $2 credits")
        .replace(/消耗\s*(\d+)\s*算力点/g, "used $1 credits")
        .replace(/(\d+)\s*次创建/g, "$1 creations")
        .replace(/(\d+)次/g, "$1 times")
        .replace(/(\d+)次创建/g, "$1 creations")
        .replace(/来源：(.+)/g, "Source: $1")
        .replace(/更新于\s*(.+)/g, "Updated at $1")
        .replace(/请输入工作流名称确认删除：(.+)/g, "Enter the workflow name to confirm deletion: $1")
        .replace(/请输入“我的工作流”中的名称确认同步：(.+)/g, "Enter the name in My workflows to confirm sync: $1")
        .replace(/删除后「(.+)」不会继续在社区展示。/g, "\"$1\" will no longer be shown in the community after deletion.")
        .replace(/确定删除「(.+)」吗？/g, "Delete \"$1\"?")
        .replace(/封禁原因：(.+)。封禁 7 天后会自动从我的作品中删除。/g, "Ban reason: $1. It will be removed from My works 7 days after the ban.")
        .replace(/已读取\s*(\d+)\s*张参考图/g, "Loaded $1 reference images")
        .replace(/已导入\s*(\d+)\s*个素材/g, "Imported $1 assets")
        .replace(/删除\s*(\d+)\s*个工作流/g, "Delete $1 workflows")
        .replace(/等待\s*(.+)/g, "Waiting $1")
        .replace(/成功\s*(\d+)/g, "Success $1")
        .replace(/失败\s*(\d+)/g, "Failed $1")
        .replace(/共\s*(\d+)/g, "Total $1")
        .replace(/云端更新于\s*(.+)/g, "Cloud updated at $1")
        .replace(/创建于\s*(.+)/g, "Created at $1")
        .replace(/更新于\s*(.+)/g, "Updated at $1")
        .replace(/版本\s*(\d+)/g, "Version $1")
        .replace(/确定删除选中的\s*(\d+)\s*条生成记录吗？/g, "Delete $1 selected history items?")
        .replace(/将删除\s*(\d+)/g, "Will delete $1")
        .replace(/当前列表已选择\s*(\d+)/g, "$1 selected")
        .replace(/创建：(.+)/g, "Created: $1")
        .replace(/更新：(.+)/g, "Updated: $1");

    for (const [zh, en] of sortedTranslations) {
        if (zh.length <= 1) continue;
        output = output.replaceAll(zh, en);
    }
    return `${leading}${output}${trailing}`;
}
