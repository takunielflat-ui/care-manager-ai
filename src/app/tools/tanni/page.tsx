import type { Metadata } from "next";

import TanniSimulator from "./_components/tanni-simulator";

export const metadata: Metadata = {
  title: "介護サービス 単位数・自己負担シミュレーター｜ケアマネの訪問先電卓",
  description:
    "ケアマネジャー向け。訪問先でその場で、介護サービスの単位数と月額の自己負担を概算できる無料ツールです。通所介護・通所リハ・訪問介護などの単位数、区分支給限度基準額との比較、家族に見せる画面や印刷用シートまで、ログイン不要ですぐ使えます。",
  keywords: ["介護保険", "単位数", "自己負担", "ケアマネジャー", "区分支給限度基準額", "通所介護", "通所リハビリテーション"],
  openGraph: {
    title: "介護サービス 単位数・自己負担シミュレーター",
    description: "訪問先でその場で、介護サービスの単位数と月額の自己負担を概算できる無料ツールです。",
    url: "/tools/tanni",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "介護サービス 単位数・自己負担シミュレーター",
    description: "訪問先でその場で、介護サービスの単位数と月額の自己負担を概算できる無料ツールです。",
  },
  alternates: {
    canonical: "/tools/tanni",
  },
};

export default function TanniPage() {
  return <TanniSimulator />;
}
