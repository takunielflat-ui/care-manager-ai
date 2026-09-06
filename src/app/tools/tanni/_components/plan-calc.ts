"use client";

/* =====================================================================
 *  保存プラン（TanniPlanState）→ 計算結果 の変換を1か所にまとめる。
 *  電卓本体（tanni-simulator）と保存一覧（tanni-plans-view）で
 *  同じ数字が出るようにするための共有ヘルパ。
 * ===================================================================== */

import { 高額介護サービス費 } from "@/lib/kaigo/master";
import { 計算, type 計算結果 } from "@/lib/kaigo/calc";
import type { 条件, 行state } from "./state";

export interface プラン内容 extends 条件 {
  印刷名: string;
  rows: 行state[];
}

export function 高額上限を引く(高額区分: string): number | null {
  return 高額介護サービス費.find((k) => k.id === 高額区分)?.上限 ?? null;
}

export function プランを計算(state: プラン内容): 計算結果 {
  return 計算({
    要介護度: state.要介護度,
    地域区分: state.地域区分,
    負担割合: state.負担割合,
    高額上限: 高額上限を引く(state.高額区分),
    rows: state.rows.map((x) => ({
      id: x.id,
      service: x.service,
      軸1: x.軸1,
      軸2: x.軸2,
      manualUnits: x.manualUnits,
      月回数: x.月回数,
      処遇改善区分: x.処遇改善区分,
      加算率上書き: x.加算率上書き,
      自費: x.自費,
    })),
  });
}
