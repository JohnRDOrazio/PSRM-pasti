import { NextResponse } from 'next/server'
import { MEMBER_COOKIE, memberCookieOptions } from '@/lib/cookie'
import { findPersonByToken } from '@/server/auth'

export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  const person = await findPersonByToken(token)
  if (!person) return NextResponse.redirect(new URL('/link-non-valido', req.url))
  const res = NextResponse.redirect(new URL('/', req.url))
  res.cookies.set(MEMBER_COOKIE, token, memberCookieOptions())
  return res
}
