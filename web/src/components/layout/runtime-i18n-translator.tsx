"use client";

import { useEffect } from "react";

import type { Locale } from "@/i18n/messages";
import { createTranslator, runtimeTranslations } from "@/i18n/runtime-translations";
import { useEffectiveLocale } from "@/hooks/use-effective-locale";

const sourceText = new WeakMap<Text, string>();
const writtenText = new WeakMap<Text, string>();
const sourceAttrs = new WeakMap<Element, Map<string, string>>();
const writtenAttrs = new WeakMap<Element, Map<string, string>>();
const translatableAttrs = ["placeholder", "title", "aria-label", "alt"];
const textSkipSelector = "script,style,textarea,input,pre,code,kbd,samp,[contenteditable='true'],[data-i18n-skip]";
const attrSkipSelector = "script,style,pre,code,kbd,samp,[data-i18n-skip]";
const hasChinese = /[\u3400-\u9fff]/;
const translate = createTranslator(runtimeTranslations);

export function RuntimeI18nTranslator() {
    const locale: Locale = useEffectiveLocale();

    useEffect(() => {
        const translateRoot = () => translateNode(document.body, locale);
        translateRoot();
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === "characterData") {
                    translateTextNode(mutation.target as Text, locale);
                    continue;
                }
                if (mutation.type === "attributes") {
                    translateElementAttrs(mutation.target as Element, locale);
                    continue;
                }
                mutation.addedNodes.forEach((node) => translateNode(node, locale));
            }
        });
        observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: translatableAttrs });
        return () => observer.disconnect();
    }, [locale]);

    return <></>;
}

function translateNode(node: Node, locale: Locale) {
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

function translateTextNode(node: Text, locale: Locale) {
    const parent = node.parentElement;
    if (!parent || parent.closest(textSkipSelector)) return;
    const current = node.nodeValue || "";
    if (!rememberSource(node, current)) return;
    const source = sourceText.get(node) as string;
    const target = translate(source, locale);
    if (target !== current) {
        writtenText.set(node, target);
        node.nodeValue = target;
    } else if (writtenText.has(node)) {
        writtenText.delete(node);
    }
}

function rememberSource(node: Text, current: string) {
    const written = writtenText.get(node);
    if (written !== undefined && current === written) return true;
    if (hasChinese.test(current)) {
        sourceText.set(node, current);
        return true;
    }
    sourceText.delete(node);
    writtenText.delete(node);
    return false;
}

function translateElementAttrs(element: Element, locale: Locale) {
    if (element.closest(attrSkipSelector)) return;
    const sources = sourceAttrs.get(element) || new Map<string, string>();
    const written = writtenAttrs.get(element) || new Map<string, string>();
    if (!sourceAttrs.has(element)) sourceAttrs.set(element, sources);
    if (!writtenAttrs.has(element)) writtenAttrs.set(element, written);
    for (const attr of translatableAttrs) {
        const current = element.getAttribute(attr);
        if (current === null || current === "") continue;
        const lastWritten = written.get(attr);
        if (lastWritten === undefined || current !== lastWritten) {
            if (hasChinese.test(current)) {
                sources.set(attr, current);
            } else {
                sources.delete(attr);
                written.delete(attr);
                continue;
            }
        }
        const source = sources.get(attr);
        if (!source) continue;
        const target = translate(source, locale);
        if (target !== current) {
            written.set(attr, target);
            element.setAttribute(attr, target);
        }
    }
}
