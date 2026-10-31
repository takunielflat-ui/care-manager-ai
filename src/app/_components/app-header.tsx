import { headers } from "next/headers";
import Link from "next/link";

import AppMenu, { type MenuVariant } from "./app-menu";

/**
 * ログインが必要な画面で共通に使う上部バー。
 * 左端は「← トップ」、右端は「☰ メニュー」。バーは画面上に固定し、
 * スクロールしていても1タップでトップに戻れるようにする。
 *
 * 単位数電卓（/tools/tanni）は公開ページで見た目も独自のため、これは使わない。
 *
 * アセスメントだけを購入した人（proxy.ts が付ける x-user-plan が "assessment"）には、
 * 開ける画面だけのメニューを出し、「← トップ」の代わりに「← 一覧」（アセスメント一覧）を出す。
 */
export default async function AppHeader({
  title,
  description,
  userEmail,
  isTop = false,
  menu = "full",
  children,
}: {
  title: string;
  description?: React.ReactNode;
  /** 見出しの下に置くボタンなど */
  children?: React.ReactNode;
  /** メニューを開いたときに出すログイン中のメールアドレス */
  userEmail?: string | null;
  /** トップ画面自身では「← トップ」の代わりにアプリ名を出す */
  isTop?: boolean;
  menu?: "full" | "limited";
}) {
  const isAssessmentOnly = (await headers()).get("x-user-plan") === "assessment";
  const menuVariant: MenuVariant = menu === "full" && isAssessmentOnly ? "assessment" : menu;
  const back = isAssessmentOnly ? { href: "/assessment", label: "← 一覧" } : { href: "/", label: "← トップ" };

  return (
    <>
      <div className="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        <div className="mx-auto flex h-16 w-full max-w-xl items-center justify-between gap-3 px-4">
          {isTop ? (
            <span className="text-base font-bold text-teal-800 dark:text-teal-300">ケアマネAI</span>
          ) : (
            <Link
              href={back.href}
              className="flex min-h-11 items-center rounded-lg px-1 text-base font-bold text-teal-700 underline-offset-2 hover:underline dark:text-teal-400"
            >
              {back.label}
            </Link>
          )}
          <AppMenu variant={menuVariant} userEmail={userEmail} />
        </div>
      </div>

      <header className="border-b border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto w-full max-w-xl">
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{title}</h1>
          {description && (
            <div className="mt-1 text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">{description}</div>
          )}
          {children}
        </div>
      </header>
    </>
  );
}
