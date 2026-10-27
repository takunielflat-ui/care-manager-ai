"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { createClient } from "@/lib/supabase/client";

/**
 * 単位数電卓（公開ページ）から経過記録のトップへ戻るリンク。
 * ログインしている人にだけ出す。ログインしていない人が押すとログイン画面に飛び、
 * SNS・検索から来た人が迷うため。
 *
 * proxy.ts はこのページで認証を確認しないので、ブラウザに残っているセッションで判定する
 * （getSession は Cookie を読むだけで、認証サーバーへの通信は発生しない）。
 */
export default function TopLink({ className }: { className: string }) {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    createClient()
      .auth.getSession()
      .then(({ data }) => {
        if (!cancelled) setLoggedIn(Boolean(data.session));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loggedIn) return null;
  return (
    <Link href="/" className={className}>
      ← トップ
    </Link>
  );
}
