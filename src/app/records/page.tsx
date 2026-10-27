import { createClient } from "@/lib/supabase/server";
import AppHeader from "../_components/app-header";
import RecordsList, { type VisitRecord } from "./_components/records-list";

export const dynamic = "force-dynamic";

export default async function RecordsPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; month?: string }>;
}) {
  const { client, month } = await searchParams;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("visit_records")
    .select("id, visit_date, display_name, note, generated_text, status, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch visit_records:", error);
  }

  const records = (data ?? []) as VisitRecord[];

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <AppHeader
        title="記録一覧"
        description="保存した第5表の記録です。介護ソフトへのコピペが済んだらステータスを切り替えてください。"
      />

      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-6">
        <RecordsList
          initialRecords={records}
          initialClient={client ?? "all"}
          initialMonth={month ?? "all"}
        />
      </main>
    </div>
  );
}
