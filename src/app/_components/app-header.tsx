import { headers } from "next/headers";
import Link from "next/link";

import { FEATURES_HEADER, homePath, parseFeaturesHeader } from "@/lib/access";
import AppMenu from "./app-menu";

/**
 * ログインが必要な画面で共通に使う上部バー。
 * 左端は戻るリンク、右端は「☰ メニュー」。バーは画面上に固定し、
 * スクロールしていても1タップで最初の画面に戻れるようにする。
 *
 * 単位数電卓（/tools/tanni）は公開ページで見た目も独自のため、これは使わない。
 *
 * メニューと戻るリンクは、proxy.ts が確かめて渡す使える機能（x-user-features）に合わせる。
 * 経過記録の権限があれば「← トップ」、アセスメントだけなら「← 一覧」（アセスメント一覧）。
 * ここは見た目を合わせるだけで、開けるかどうかは proxy.ts と API が決める。
 */
export default async function AppHeader({
  title,
  description,
  userEmail,
  isTop = false,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  /** 見出しの下に置くボタンなど */
  children?: React.ReactNode;
  /** メニューを開いたときに出すログイン中のメールアドレス */
  userEmail?: string | null;
  /** トップ画面自身では戻るリンクの代わりにアプリ名を出す */
  isTop?: boolean;
}) {
  const features = parseFeaturesHeader((await headers()).get(FEATURES_HEADER));
  const home = homePath(features);
  const back =
    home === "/" ? { href: "/", label: "← トップ" } : home === "/assessment" ? { href: "/assessment", label: "← 一覧" } : null;

  return (
    <>
      <div className="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        <div className="mx-auto flex h-16 w-full max-w-xl items-center justify-between gap-3 px-4">
          {isTop || !back ? (
            <span className="text-base font-bold text-teal-800 dark:text-teal-300">ケアマネAI</span>
          ) : (
            <Link
              href={back.href}
              className="flex min-h-11 items-center rounded-lg px-1 text-base font-bold text-teal-700 underline-offset-2 hover:underline dark:text-teal-400"
            >
              {back.label}
            </Link>
          )}
          <AppMenu features={[...features]} userEmail={userEmail} />
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
