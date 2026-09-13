import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { MEMBER_COOKIE, memberCookieOptions } from '@/lib/cookie'

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/admin')) return adminGuard(request)
  const res = NextResponse.next()
  const token = request.cookies.get(MEMBER_COOKIE)?.value
  if (token) res.cookies.set(MEMBER_COOKIE, token, memberCookieOptions())
  return res
}

async function adminGuard(request: NextRequest) {
  let res = NextResponse.next({ request })
  const supa = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value)
        res = NextResponse.next({ request })
        for (const { name, value, options } of list) res.cookies.set(name, value, options)
      },
    },
  })
  const { data: { user } } = await supa.auth.getUser()
  const isLogin = request.nextUrl.pathname === '/admin/login'
  if (!user && !isLogin) return NextResponse.redirect(new URL('/admin/login', request.url))
  return res
}

export const config = { matcher: ['/', '/periodo/:path*', '/admin/:path*'] }
