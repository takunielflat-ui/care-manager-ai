import Link from "next/link";

import { CONTACT_EMAIL } from "@/lib/sales";

const LINKS = [
  { href: "/legal/tokushoho", label: "特定商取引法に基づく表記" },
  { href: "/legal/terms", label: "利用規約" },
  { href: "/legal/privacy", label: "プライバシーポリシー" },
];

/** ログインなしで見られるページ（紹介ページ・法的ページ）の共通フッター */
export default function PublicFooter() {
  return (
    <footer className="border-t border-zinc-200 bg-white px-4 py-6 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-3">
        <nav className="flex flex-col gap-2">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="underline underline-offset-2">
              {link.label}
            </Link>
          ))}
        </nav>
        <p className="break-all">お問い合わせ：{CONTACT_EMAIL}</p>
      </div>
    </footer>
  );
}
