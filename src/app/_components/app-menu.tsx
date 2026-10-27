"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import LogoutButton from "./logout-button";

type MenuLink = { href: string; label: string };

/** ログインして利用を許可されている人のメニュー */
const FULL_LINKS: MenuLink[] = [
  { href: "/", label: "訪問記録の入力（トップ）" },
  { href: "/assessment/new", label: "アセスメント" },
  { href: "/records", label: "記録一覧" },
  { href: "/tools/tanni", label: "単位数電卓" },
  { href: "/settings", label: "辞書設定" },
  { href: "/help", label: "使い方" },
];

/**
 * 利用の許可がまだの人（no-access）のメニュー。
 * それ以外の画面は proxy.ts で案内ページに戻されるため出さない。
 */
const LIMITED_LINKS: MenuLink[] = [{ href: "/tools/tanni", label: "単位数電卓" }];

export default function AppMenu({
  variant = "full",
  userEmail,
}: {
  variant?: "full" | "limited";
  userEmail?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const links = variant === "full" ? FULL_LINKS : LIMITED_LINKS;

  // メニューの外をタップしたとき・Esc キーで閉じる
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="app-menu-panel"
        className="flex min-h-11 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3.5 text-base font-bold text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      >
        <span aria-hidden="true">☰</span>
        メニュー
      </button>

      {open && (
        <div
          id="app-menu-panel"
          className="absolute right-0 top-full z-40 mt-2 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          {userEmail && (
            <p className="truncate border-b border-zinc-100 px-4 py-2.5 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              {userEmail}
            </p>
          )}
          <nav>
            <ul>
              {links.map((link) => {
                const current = pathname === link.href;
                return (
                  <li key={link.href} className="border-b border-zinc-100 dark:border-zinc-800">
                    <Link
                      href={link.href}
                      onClick={() => setOpen(false)}
                      aria-current={current ? "page" : undefined}
                      className={`flex min-h-12 items-center px-4 text-base font-medium ${
                        current
                          ? "bg-teal-50 font-bold text-teal-800 dark:bg-teal-950 dark:text-teal-300"
                          : "text-zinc-800 hover:bg-zinc-50 dark:text-zinc-100 dark:hover:bg-zinc-800"
                      }`}
                    >
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="flex min-h-12 items-center px-4">
            <LogoutButton className="text-base" />
          </div>
        </div>
      )}
    </div>
  );
}
