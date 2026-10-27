import { createClient } from "@/lib/supabase/server";
import AppHeader from "../_components/app-header";
import KnownNamesManager from "./_components/known-names-manager";
import CannedPhrasesManager from "./_components/canned-phrases-manager";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const [{ data, error }, { data: cannedPhrasesData, error: cannedPhrasesError }] =
    await Promise.all([
      supabase
        .from("known_names")
        .select("id, category, name, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("canned_phrases")
        .select("id, body, sort_order, created_at")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
    ]);

  if (error) {
    console.error("Failed to fetch known_names:", error);
  }
  if (cannedPhrasesError) {
    console.error("Failed to fetch canned_phrases:", cannedPhrasesError);
  }

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <AppHeader
        title="匿名化辞書の設定"
        description="「〜病院」「〜デイサービス」のような語尾が付かない固有名詞は自動で拾えません。AIに送る前に隠したい人名・病院名・施設名・地名をここに登録してください。"
      />

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-10 px-4 py-6">
        <KnownNamesManager initialKnownNames={data ?? []} />

        <section className="flex flex-col gap-4 border-t border-zinc-200 pt-8 dark:border-zinc-800">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              定型文の登録
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              運営指導向けによく使う言い回しを登録しておくと、記録作成画面でチェックするだけで
              生成結果の末尾に追加できます。AIには渡されません。
            </p>
          </div>
          <CannedPhrasesManager initialCannedPhrases={cannedPhrasesData ?? []} />
        </section>
      </main>
    </div>
  );
}
