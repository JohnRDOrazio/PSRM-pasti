export const MEMBER_COOKIE = 'psrm_member'
/** Set once an admin session is seen on this device; survives sign-out so member pages can still offer the admin login. */
export const ADMIN_HINT_COOKIE = 'psrm_admin_hint'

export function memberCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  }
}
