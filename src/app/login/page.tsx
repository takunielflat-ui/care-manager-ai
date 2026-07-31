import LoginForm from "./_components/login-form";

export default function LoginPage() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <header className="border-b border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto w-full max-w-xl">
          <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            ログイン
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            メールアドレスに届く認証コードでログインします。
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-6">
        <LoginForm />
      </main>
    </div>
  );
}
