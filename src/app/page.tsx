import { redirect } from 'next/navigation'
import { getPersonFromCookie } from '@/server/auth'

export default async function HomePage() {
  const person = await getPersonFromCookie()
  if (!person) redirect('/link-non-valido')
  return <main className="p-6">{person.full_name}</main>
}
