import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Next.js 16 renamed the `middleware.ts` file convention to `proxy.ts`
// (see AGENTS.md); next-intl's factory still returns a standard
// (req) => NextResponse function, so it plugs in unchanged under the new name.
export const proxy = createMiddleware(routing);

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
