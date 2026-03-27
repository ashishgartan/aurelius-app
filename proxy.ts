// proxy.ts
import { NextResponse, type NextRequest } from "next/server"
import { verifyToken, COOKIE_NAME } from "@/lib/jwt"

const PROTECTED = ["/chat", "/dashboard", "/settings", "/profile", "/memory", "/options", "/tools"]

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const isProtected = PROTECTED.some((p) => pathname.startsWith(p))

  const token = req.cookies.get(COOKIE_NAME)?.value ?? null
  const user = token ? await verifyToken(token) : null

  if (isProtected && !user) {
    const url = req.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("from", pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/login",
    "/signup",
    "/chat/:path*",
    "/dashboard/:path*",
    "/settings/:path*",
    "/profile/:path*",
    "/memory/:path*",
    "/options/:path*",
    "/tools/:path*",
  ],
}
