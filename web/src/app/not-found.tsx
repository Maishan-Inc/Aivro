import { Home, LogIn } from "lucide-react";
import Link from "next/link";

import type { Locale } from "@/i18n/messages";
import { withLocalePath } from "@/i18n/routing";
import { requestLocale } from "@/lib/page-metadata";

const copy: Record<Locale, { title: string; description: string; home: string; login: string }> = {
    "zh-CN": { title: "页面不存在", description: "这个地址没有对应的页面，可能已经移动或被合并到其他入口。", home: "返回首页", login: "去登录" },
    "zh-TW": { title: "頁面不存在", description: "這個地址沒有對應的頁面，可能已經移動或被合併到其他入口。", home: "返回首頁", login: "去登入" },
    "en-US": { title: "Page not found", description: "This address does not match an active page. It may have moved or been merged into another entry.", home: "Home", login: "Sign in" },
    "ja-JP": { title: "ページが見つかりません", description: "このアドレスに対応するページはありません。移動または別の入口に統合された可能性があります。", home: "ホームへ戻る", login: "ログイン" },
    "ko-KR": { title: "페이지를 찾을 수 없습니다", description: "이 주소에 해당하는 페이지가 없습니다. 이동되었거나 다른 진입점으로 통합되었을 수 있습니다.", home: "홈으로", login: "로그인" },
    "fr-FR": { title: "Page introuvable", description: "Aucune page ne correspond à cette adresse. Elle a peut-être été déplacée ou fusionnée avec une autre entrée.", home: "Retour à l'accueil", login: "Se connecter" },
};

export default async function NotFound() {
    const locale = await requestLocale();
    const text = copy[locale] || copy["zh-CN"];
    return (
        <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
            <main className="flex h-full min-h-0 items-center justify-center overflow-y-auto bg-background bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] px-6 py-10 text-stone-900 [background-size:16px_16px] dark:bg-[radial-gradient(rgba(245,245,244,.16)_1px,transparent_1px)] dark:text-stone-100">
                <section className="w-full max-w-md text-center">
                    <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-lg border border-stone-200 bg-white text-2xl font-semibold shadow-sm dark:border-stone-800 dark:bg-stone-900">404</div>
                    <h1 className="text-3xl font-semibold tracking-normal">{text.title}</h1>
                    <p className="mt-3 text-sm leading-6 text-stone-500 dark:text-stone-400">{text.description}</p>
                    <div className="mt-8 flex flex-wrap justify-center gap-3">
                        <Link href={withLocalePath("/", locale)} className="inline-flex h-10 items-center gap-2 rounded-lg bg-stone-950 px-4 text-sm font-medium text-white transition hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-950 dark:hover:bg-stone-200">
                            <Home className="size-4" />
                            {text.home}
                        </Link>
                        <Link
                            href={withLocalePath("/login", locale)}
                            className="inline-flex h-10 items-center gap-2 rounded-lg border border-stone-200 bg-background px-4 text-sm font-medium text-stone-900 transition hover:bg-stone-100 dark:border-stone-800 dark:text-stone-100 dark:hover:bg-stone-800"
                        >
                            <LogIn className="size-4" />
                            {text.login}
                        </Link>
                    </div>
                </section>
            </main>
        </div>
    );
}
