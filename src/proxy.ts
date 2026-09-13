import { NextResponse, type NextRequest } from 'next/server'
import { MEMBER_COOKIE, memberCookieOptions } from '@/lib/cookie'

export async function proxy(request: NextRequest) {
  const res = NextResponse.next()
  const token = request.cookies.get(MEMBER_COOKIE)?.value
  if (token) res.cookies.set(MEMBER_COOKIE, token, memberCookieOptions())
  return res
}

export const config = { matcher: ['/', '/periodo/:path*'] }
