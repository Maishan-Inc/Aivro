"use client";

import { ArrowRight } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { App, Button, Image, Tag } from "antd";

import { AivroOutlineTitle } from "@/components/aivro-outline-title";
import { AivroReveal } from "@/components/aivro-reveal";
import { fetchPrompts, type Prompt } from "@/services/api/prompts";
import { useI18n } from "@/hooks/use-i18n";
import { useLocalizedPath } from "@/hooks/use-localized-path";
import { navigationTools } from "@/constant/navigation-tools";
import { cn } from "@/lib/utils";

function Highlighter({ action, color, children }: { action: "highlight" | "underline"; color: string; children: ReactNode }) {
    return (
        <span className="relative inline-block px-1">
            {action === "highlight" ? (
                <span className="absolute inset-x-0 bottom-0 top-1 rounded-sm opacity-45" style={{ backgroundColor: color }} />
            ) : (
                <span className="absolute inset-x-0 bottom-0 h-1 rounded-full opacity-80" style={{ backgroundColor: color }} />
            )}
            <span className="relative font-medium text-stone-800 dark:text-stone-200">{children}</span>
        </span>
    );
}

export function HomeClientPage() {
    const { message } = App.useApp();
    const { locale, t } = useI18n();
    const localizedPath = useLocalizedPath();
    const [primaryTool] = navigationTools;
    const [promptShowcase, setPromptShowcase] = useState<Prompt[]>([]);
    const [previewIndex, setPreviewIndex] = useState(0);
    const [previewOpen, setPreviewOpen] = useState(false);

    useEffect(() => {
        void fetchPrompts({ locale, pageSize: 12 })
            .then((data) => setPromptShowcase(data.items))
            .catch((error) => message.error(error instanceof Error ? error.message : t("home.promptError")));
    }, [locale, message, t]);

    return (
        <main className="aivro-wire-surface relative h-full overflow-y-auto bg-background text-stone-950 dark:text-stone-100">
            <section className="relative mx-auto min-h-[calc(100vh-4rem)] max-w-7xl overflow-hidden px-6">
                <div className="pointer-events-none absolute left-[15%] top-24 size-20 rounded-full border border-dashed border-stone-200 dark:border-stone-800" />
                <div className="pointer-events-none absolute right-[23%] top-[48%] size-20 rounded-full border border-dashed border-stone-200 dark:border-stone-800" />

                <AivroReveal className="relative flex min-h-[620px] flex-col items-center justify-center pt-10 text-center">
                    <div data-aivro-reveal className="flex w-full justify-center">
                        <AivroOutlineTitle label={t("app.name")} />
                    </div>
                    <p data-aivro-reveal className="mt-8 max-w-3xl text-balance text-lg leading-8 text-stone-500 dark:text-stone-400">
                        {t("home.hero.prefix")}
                        <Highlighter action="underline" color="#FF9800">
                            {t("app.name")}
                        </Highlighter>
                        {t("home.hero.middle")}
                        <Highlighter action="highlight" color="#87CEFA">
                            {t("home.hero.highlight")}
                        </Highlighter>
                        {t("home.hero.suffix")}
                    </p>
                    <div data-aivro-reveal className="mt-10 flex flex-wrap items-center justify-center gap-3">
                        <Button type="primary" size="large" href={localizedPath(`/${primaryTool.slug}`)} icon={<ArrowRight className="size-4" />} iconPlacement="end">
                            {t("home.use")}
                        </Button>
                        <Button size="large" href={localizedPath("/canvas")}>
                            {t("home.openCanvas")}
                        </Button>
                    </div>
                </AivroReveal>

                <section className="relative mx-auto mb-20 max-w-6xl border-t border-stone-200 pt-12 dark:border-stone-800">
                    <AivroReveal className="mb-8 grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-start">
                        <div />
                        <div data-aivro-reveal className="max-w-2xl text-center">
                            <h2 className="text-3xl font-semibold text-stone-950 dark:text-stone-100">{t("home.section.title")}</h2>
                            <p className="mt-3 text-base leading-7 text-stone-500 dark:text-stone-400">{t("home.section.description")}</p>
                        </div>
                        <Button data-aivro-reveal type="link" href={localizedPath("/prompts")} className="justify-self-center md:justify-self-end" icon={<ArrowRight className="size-4" />} iconPlacement="end">
                            {t("home.section.action")}
                        </Button>
                    </AivroReveal>
                    <AivroReveal key={promptShowcase.length} className="grid auto-rows-[210px] gap-4 md:grid-cols-4">
                        {promptShowcase.map((item, index) => (
                            <button
                                key={item.id}
                                data-aivro-reveal
                                type="button"
                                onClick={() => {
                                    setPreviewIndex(index);
                                    setPreviewOpen(true);
                                }}
                                className={cn(
                                    "aivro-wire-card group relative cursor-pointer overflow-hidden bg-stone-100 text-left dark:bg-stone-900",
                                    index === 0 && "md:col-span-2 md:row-span-2",
                                    index === 3 && "md:col-span-2",
                                )}
                            >
                                <img src={item.coverUrl} alt={item.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/35 to-transparent p-4 text-white">
                                    <div className="mb-2 flex flex-wrap gap-1.5">
                                        {item.tags.slice(0, 2).map((tag) => (
                                            <Tag key={tag} variant="filled" className="m-0 bg-white/15 text-[11px] text-white backdrop-blur">
                                                {tag}
                                            </Tag>
                                        ))}
                                    </div>
                                    <h3 className="text-sm font-medium">{item.title}</h3>
                                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/75">{item.prompt}</p>
                                </div>
                            </button>
                        ))}
                    </AivroReveal>
                </section>
            </section>
            <Image.PreviewGroup
                preview={{
                    open: previewOpen,
                    current: previewIndex,
                    onOpenChange: setPreviewOpen,
                    onChange: setPreviewIndex,
                }}
            >
                <div className="hidden">
                    {promptShowcase.map((item) => (
                        <Image key={item.id} src={item.coverUrl} alt={item.title} />
                    ))}
                </div>
            </Image.PreviewGroup>
        </main>
    );
}
