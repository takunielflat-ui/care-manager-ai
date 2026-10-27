import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { todayInJapan } from "@/lib/date";
import type { Selections } from "@/lib/assessment/templates";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "../../_components/app-header";
import AssessmentForm from "../_components/assessment-form";

export const metadata: Metadata = {
  title: "アセスメント | Care Manager AI",
};

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 保存したアセスメントを開いて、続きを編集・上書き保存・削除する画面 */
export default async function AssessmentEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  // RLS により自分のものしか返らない
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assessments")
    .select("id, display_name, assessed_on, family, selections, include_unconfirmed, generated_text, template_version")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error("Failed to fetch assessments:", error);
  }
  if (!data) notFound();

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <AppHeader title="アセスメント" description="選び直して「💾 保存」を押すと上書きされます。" />

      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-6">
        <AssessmentForm
          defaultDate={todayInJapan()}
          saved={{
            id: data.id,
            displayName: data.display_name,
            assessedOn: data.assessed_on,
            family: data.family as string[],
            selections: data.selections as Selections,
            includeUnconfirmed: data.include_unconfirmed,
            generatedText: data.generated_text,
            templateVersion: data.template_version,
          }}
        />
      </main>
    </div>
  );
}
