import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getFeatures, redirectFor, setTrustedHeaders, type Feature } from "@/lib/access";

const PUBLIC_PATHS = ["/login"];

/** ログイン不要で公開するツール群。配下のパスもまとめて対象外にする。 */
const PUBLIC_PATH_PREFIXES = ["/tools/tanni"];
const isPublicPrefixPath = (pathname: string) =>
  PUBLIC_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));

/**
 * 全ページリクエストでSupabaseセッションをリフレッシュし、
 * 未ログイン時は /login へ、ログイン済みで /login にいる場合は / へ誘導する。
 * /api/* はここでは扱わない。各Route Handlerが個別に認証と権限を確認する。
 *
 * ログイン済みの人は、使える機能（user_entitlements）に合わせて画面を振り分ける（src/lib/access.ts）。
 * 確認した結果は x-user-email / x-user-features ヘッダーに載せてページ側に渡す。
 * 外から同じ名前のヘッダーが送られてきても、必ず消してから上書きする（setTrustedHeaders）。
 */
export async function proxy(request: NextRequest) {
  // 無料公開ツール（SNS・検索流入の入口）。認証を確認せず、
  // Supabaseへの往復も省いて高速に返す。偽のヘッダーだけは消しておく。
  if (isPublicPrefixPath(request.nextUrl.pathname)) {
    const headers = setTrustedHeaders(new Headers(request.headers), { features: null, email: null });
    return NextResponse.next({ request: { headers } });
  }

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

  // 使える機能に合わない画面は、開ける画面へ回す（権限なし → 案内ページ、アセスメントの権限なし → 購入案内）
  let features: Set<Feature> | null = null;
  if (user) {
    features = await getFeatures(supabase, user);
    const to = redirectFor(request.nextUrl.pathname, features);
    if (to) return NextResponse.redirect(new URL(to, request.url));
  }

  // request.cookies.set() の結果を含めるため、ヘッダーはここで作る
  const requestHeaders = setTrustedHeaders(new Headers(request.headers), {
    features,
    email: user?.email ?? null,
  });

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
