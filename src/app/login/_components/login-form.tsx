"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

const FIELD_CLASS =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-3 text-base text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 disabled:bg-zinc-100 disabled:text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:disabled:bg-zinc-800";

const LABEL_CLASS = "text-sm font-medium text-zinc-700 dark:text-zinc-300";

const BUTTON_CLASS =
  "flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-4 text-base font-bold text-white shadow-lg shadow-teal-700/20 transition-all hover:bg-teal-800 active:scale-[0.99] active:bg-teal-900 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500 disabled:shadow-none dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600";

const RESEND_COOLDOWN_SECONDS = 30;

type Step = "email" | "code";

export default function LoginForm() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((current) => current - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function handleSendCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || cooldown > 0) return;

    setIsSubmitting(true);
    setErrorMessage("");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });

    setIsSubmitting(false);

    if (error) {
      setErrorMessage("コードの送信に失敗しました。メールアドレスをご確認の上、もう一度お試しください。");
      return;
    }

    setStep("code");
    setCooldown(RESEND_COOLDOWN_SECONDS);
  }

  async function handleVerifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage("");

    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });

    if (error) {
      setIsSubmitting(false);
      setErrorMessage("コードが正しくないか、有効期限が切れています。もう一度お試しください。");
      return;
    }

    router.replace("/");
    router.refresh();
  }

  if (step === "email") {
    return (
      <form onSubmit={handleSendCode} className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <label htmlFor="email" className={LABEL_CLASS}>
            メールアドレス
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            disabled={isSubmitting}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={FIELD_CLASS}
          />
        </div>

        {errorMessage !== "" && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
          >
            {errorMessage}
          </p>
        )}

        <button type="submit" disabled={isSubmitting || email.trim() === ""} className={BUTTON_CLASS}>
          {isSubmitting ? "送信中..." : "コードを送信"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleVerifyCode} className="flex flex-col gap-6">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {email} 宛に認証コードを送信しました。メールをご確認ください。
      </p>

      <div className="flex flex-col gap-2">
        <label htmlFor="code" className={LABEL_CLASS}>
          認証コード
        </label>
        <input
          id="code"
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          maxLength={10}
          placeholder="123456"
          disabled={isSubmitting}
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/[^0-9]/g, ""))}
          className={`${FIELD_CLASS} text-center text-xl tracking-[0.3em]`}
        />
      </div>

      {errorMessage !== "" && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
        >
          {errorMessage}
        </p>
      )}

      <button type="submit" disabled={isSubmitting || code.length < 6} className={BUTTON_CLASS}>
        {isSubmitting ? "確認中..." : "ログイン"}
      </button>

      <button
        type="button"
        disabled={cooldown > 0 || isSubmitting}
        onClick={() => {
          setStep("email");
          setCode("");
          setErrorMessage("");
        }}
        className="text-sm text-teal-700 underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:text-zinc-400 disabled:no-underline dark:text-teal-400 dark:disabled:text-zinc-600"
      >
        {cooldown > 0 ? `コードを再送信（${cooldown}秒後に可能）` : "メールアドレスを変更 / コードを再送信"}
      </button>
    </form>
  );
}
