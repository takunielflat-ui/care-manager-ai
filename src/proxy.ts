import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login"];

/** ログイン不要で公開するツール群。配下のパスもまとめて対象外にする。 */
const PUBLIC_PATH_PREFIXES = ["/tools/tanni"];
const isPublicPrefixPath = (pathname: string) =>
  PUBLIC_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));

/**
 * 全ページリクエストでSupabaseセッションをリフレッシュし、
 * 未ログイン時は /login へ、ログイン済みで /login にいる場合は / へ誘導する。
 * /api/* はここでは扱わない。各Route Handlerが個別に認証を確認する。
 *
 * ここで確認したユーザー情報は x-user-email ヘッダーに載せてページ側に渡す。
 * 各ページで改めて supabase.auth.getUser() を呼ぶと認証サーバーへの
 * ネットワーク往復が二重になるため、ページ側はこのヘッダーを読むだけにする。
 */
export async function proxy(request: NextRequest) {
  // 無料公開ツール（SNS・検索流入の入口）。認証を確認せず、
  // Supabaseへの往復も省いて高速に返す。
  if (isPublicPrefixPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const requestHeaders = new Headers(request.headers);
  let cookiesToApply: { name: string; value: string; options: CookieOptions }[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          cookiesToApply = cookiesToSet;
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicPath = PUBLIC_PATHS.includes(request.nextUrl.pathname);

  if (!user && !isPublicPath) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && isPublicPath) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (user?.email) {
    requestHeaders.set("x-user-email", user.email);
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  for (const { name, value, options } of cookiesToApply) {
    response.cookies.set(name, value, options);
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon\\.ico|icon|apple-icon|manifest\\.webmanifest).*)",
  ],
};
