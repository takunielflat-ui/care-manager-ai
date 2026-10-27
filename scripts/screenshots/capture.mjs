/**
 * Threads投稿用のスクリーンショットを撮る。
 *
 *   npm run screenshots          … 保存済みのログイン状態で撮影する
 *   npm run screenshots:login    … ブラウザを開いてログインし直してから撮影する
 *
 * - 撮影先は既定で本番サイト。SCREENSHOT_BASE_URL で変更できる。
 * - /api/generate は実際には呼ばない（Anthropic APIの課金・回数制限を発生させない）。
 *   page.route の fulfill は本文を一括でしか返せずストリーミング表示を再現できないため、
 *   ブラウザ側の fetch を差し替えて route.ts と同じ NDJSON を少しずつ流す。
 *   page.route は差し替えが効かなかった場合でも本番APIへ届かないための安全装置として置く。
 * - 出力：screenshots/out/  ログイン状態：screenshots/.auth/（どちらも .gitignore 済み）
 */

import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

import { DISPLAY_NAME, GENERATED_TEXT, NOTE } from "./dummy-data.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT_DIR = path.join(ROOT, "screenshots", "out");
const AUTH_FILE = path.join(ROOT, "screenshots", ".auth", "state.json");
const BASE_URL = (process.env.SCREENSHOT_BASE_URL ?? "https://care-manager-ai.vercel.app").replace(/\/$/, "");


/** iPhoneサイズ。3倍で撮って Threads に載せても粗くならないようにする */
const CONTEXT_OPTIONS = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  locale: "ja-JP",
  timezoneId: "Asia/Tokyo",
  colorScheme: "light",
  // Service Worker 経由の通信は page.route で横取りできないため止めておく
  serviceWorkers: "block",
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* ---------------- ログイン ---------------- */

async function login() {
  console.log("\n[ログイン] ブラウザが開きます。メールアドレスと届いたコードを入力してください。");
  console.log("          トップ画面に移ったら自動でログイン状態を保存します（最大10分待ちます）。\n");

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext(CONTEXT_OPTIONS);
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/login`);
  await page.waitForURL((url) => url.pathname === "/", { timeout: 10 * 60 * 1000 });
  await page.waitForLoadState("networkidle");

  mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  await context.storageState({ path: AUTH_FILE });
  await browser.close();
  console.log(`[ログイン] 保存しました: ${path.relative(ROOT, AUTH_FILE)}\n`);
}

/* ---------------- /api/generate の差し替え ---------------- */

/** 本文を2〜4文字ずつに切る（実際のストリーミングに近い細かさ） */
function toChunks(text) {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    const size = 2 + (chunks.length % 3);
    chunks.push(text.slice(i, i + size));
    i += size;
  }
  return chunks;
}

/**
 * ページ読み込み前にブラウザ内で実行される。
 * /api/generate への fetch だけを、NDJSON を少しずつ流す偽のレスポンスに置き換える。
 * pauseAt 番目の塊を送ったところで止まり、window.__resumeStream() が呼ばれるまで待つ。
 */
function installFetchMock({ chunks, pauseAt, intervalMs }) {
  const originalFetch = window.fetch.bind(window);
  window.__streamPaused = false;
  window.__streamDone = false;

  window.fetch = (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (new URL(url, location.href).pathname !== "/api/generate") {
      return originalFetch(input, init);
    }

    const encoder = new TextEncoder();
    const line = (obj) => encoder.encode(`${JSON.stringify(obj)}\n`);
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const body = new ReadableStream({
      async start(controller) {
        await wait(700); // 「考えをまとめています...」が一瞬見える程度の待ち
        for (let i = 0; i < chunks.length; i++) {
          controller.enqueue(line({ type: "delta", text: chunks[i] }));
          await wait(intervalMs);
          if (i === pauseAt) {
            window.__streamPaused = true;
            await new Promise((resolve) => {
              window.__resumeStream = resolve;
            });
          }
        }
        controller.enqueue(line({ type: "done" }));
        controller.close();
        window.__streamDone = true;
      },
    });

    return Promise.resolve(
      new Response(body, {
        status: 200,
        headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
      }),
    );
  };
}

/** 本番APIに通信が出ていかないようにする安全装置 */
async function guardRealApis(context) {
  await context.route("**/api/generate", async (route) => {
    console.warn("[警告] fetch の差し替えが効かず /api/generate への通信が発生しました。一括で返します（本番APIには届いていません）。");
    const body =
      [{ type: "delta", text: GENERATED_TEXT }, { type: "done" }].map((l) => JSON.stringify(l)).join("\n") + "\n";
    await route.fulfill({ status: 200, contentType: "application/x-ndjson; charset=utf-8", body });
  });
  // 保存ボタンは押さないが、念のため記録の書き込みも止める
  await context.route("**/api/records**", (route) =>
    route.request().method() === "GET" ? route.continue() : route.abort(),
  );
}

/* ---------------- 写り込み対策 ---------------- */

/** メールアドレスを消し、実データの定型文一覧を隠す */
async function sanitize(page) {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll("header p")) {
      if (el.textContent?.includes("@")) el.textContent = "";
    }
    for (const el of document.querySelectorAll("form p")) {
      if (el.textContent?.startsWith("定型文を追加")) el.parentElement.style.display = "none";
    }
  });
}

/** 出力欄（第5表の見出し）が画面の上に来るようにスクロールする */
async function scrollToResult(page) {
  await page.getByRole("heading", { name: "第5表（居宅介護支援経過）" }).evaluate((el) =>
    el.closest("section").scrollIntoView({ block: "start" }),
  );
  await sleep(300);
}

/* ---------------- 撮影 ---------------- */

async function captureRecordScreens(browser) {
  const chunks = toChunks(GENERATED_TEXT);
  const context = await browser.newContext({ ...CONTEXT_OPTIONS, storageState: AUTH_FILE });
  await guardRealApis(context);
  // 下書きの復元リンクや前回の入力が写り込まないよう、localStorage の下書きは消しておく
  await context.addInitScript(() => {
    try {
      window.localStorage.removeItem("care-manager-ai:visit-record-draft");
    } catch {}
  });
  await context.addInitScript(installFetchMock, {
    chunks,
    pauseAt: Math.floor(chunks.length * 0.45),
    intervalMs: 30,
  });

  const page = await context.newPage();
  await page.goto(`${BASE_URL}/`);
  if (new URL(page.url()).pathname === "/login") {
    await browser.close();
    throw new Error("ログイン状態の有効期限が切れています。npm run screenshots:login を実行してください。");
  }
  await page.waitForLoadState("networkidle");

  // 1. 入力画面（メモ入力済み）
  await page.locator("#display-name").fill(DISPLAY_NAME);
  await page.locator("#note").fill(NOTE);
  await page.locator("#note").blur();
  await sanitize(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(300);
  await page.screenshot({ path: path.join(OUT_DIR, "01-input.png") });
  console.log("撮影: 01-input.png");

  // 2. 生成途中
  await page.getByRole("button", { name: "⚡ 簡潔" }).click();
  await page.waitForFunction(() => window.__streamPaused === true, null, { timeout: 30_000 });
  await sleep(800); // アプリ側のスムーズスクロールが止まるのを待つ
  await sanitize(page);
  await scrollToResult(page);
  await page.screenshot({ path: path.join(OUT_DIR, "02-generating.png") });
  console.log("撮影: 02-generating.png");

  // 3. 生成完了
  await page.evaluate(() => window.__resumeStream());
  await page.waitForFunction(() => window.__streamDone === true, null, { timeout: 30_000 });
  await page.getByText("AIが生成した下書きです").waitFor();
  await sleep(500);
  await sanitize(page);
  await scrollToResult(page);
  await page.screenshot({ path: path.join(OUT_DIR, "03-done.png") });
  console.log("撮影: 03-done.png");

  await context.close();
}

/** 単位数電卓はログイン不要。保存済みの事業所設定などが写らないよう、まっさらな状態で撮る */
async function captureTanni(browser) {
  const context = await browser.newContext(CONTEXT_OPTIONS);
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/tools/tanni`);
  await page.getByText("よく使うサービス").waitFor();

  // 初期状態の1行（通所リハ）を消し、要介護2でよくある組み合わせを入れる
  await page.getByRole("button", { name: "削除" }).first().click();
  for (const name of ["デイ", "ヘルパー", "訪看"]) {
    // 「デイ」が「デイケア」に当たらないよう末尾一致で探す
    await page.getByRole("button", { name: new RegExp(`${name}$`) }).first().click();
  }

  // 下の集計シートを開いて内訳を見せる
  await page.getByText("タップで内訳").click();
  await page.getByText("月額合計（概算）").waitFor();
  await sleep(500);
  await page.screenshot({ path: path.join(OUT_DIR, "04-tanni.png") });
  console.log("撮影: 04-tanni.png");

  await context.close();
}

/* ---------------- 実行 ---------------- */

const forceLogin = process.argv.includes("--login");
if (forceLogin || !existsSync(AUTH_FILE)) {
  await login();
}

mkdirSync(OUT_DIR, { recursive: true });
console.log(`撮影先: ${BASE_URL}`);
const browser = await chromium.launch();
try {
  await captureRecordScreens(browser);
  await captureTanni(browser);
} finally {
  await browser.close();
}
console.log(`\n完了: ${path.relative(ROOT, OUT_DIR)} に保存しました。`);
