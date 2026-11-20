"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { createClient } from "@/lib/supabase/client";

/**
 * ブラウザに残っているセッションでログイン中かを判定する。
 * proxy.ts は単位数電卓のページで認証を確認しないので、ここで見る
 * （getSession は Cookie を読むだけで、認証サーバーへの通信は発生しない）。
 */
function useLoggedIn(): boolean {
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

  return loggedIn;
}

/**
 * 単位数電卓（公開ページ）から経過記録のトップへ戻るリンク。
 * ログインしている人にだけ出す。ログインしていない人が押すとログイン画面に飛び、
 * SNS・検索から来た人が迷うため。
 */
export default function TopLink({ className }: { className: string }) {
  const loggedIn = useLoggedIn();
  if (!loggedIn) return null;
  return (
    <Link href="/" className={className}>
      ← トップ
    </Link>
  );
}

/**
 * 「保存した計算」一覧へのボタン。保存はログインした人だけが使うので、ログイン中だけ出す。
 * 画面下の小さな文字のリンクだけでは見つけにくい、という声を受けて画面上部に置く。
 */
export function SavedPlansLink({
  className,
  confirmMessage,
}: {
  className: string;
  /** 指定があれば、移る前に確認する（保存していない変更があるときなど） */
  confirmMessage?: string | null;
}) {
  const loggedIn = useLoggedIn();
  if (!loggedIn) return null;
  return (
    <Link
      href="/tools/tanni/plans"
      className={className}
      onClick={(e) => {
        if (confirmMessage && !confirm(confirmMessage)) e.preventDefault();
      }}
    >
      📂 保存した計算を開く
    </Link>
  );
}
