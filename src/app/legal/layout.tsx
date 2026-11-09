import Link from "next/link";

import PublicFooter from "../_components/public-footer";

/** 法的ページ（特商法の表記・利用規約・プライバシーポリシー）の共通の枠。ログインなしで見られる（proxy.ts） */
export default function LegalLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <header className="border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto w-full max-w-xl">
          <Link href="/lp/assessment" className="font-bold text-teal-700 dark:text-teal-400">
            ケアマネAI
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-6 text-base leading-relaxed text-zinc-700 dark:text-zinc-300 [&_h1]:mb-6 [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-zinc-900 dark:[&_h1]:text-zinc-100 [&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:font-bold [&_h2]:text-zinc-900 dark:[&_h2]:text-zinc-100 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}
