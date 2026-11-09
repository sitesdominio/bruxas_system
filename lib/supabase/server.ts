import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSupabaseEnv } from '@/lib/supabase/env'

/**
 * Cliente Supabase para Route Handlers, Server Actions e Server Components.
 *
 * `setAll` grava os cookies de sessão. Em Server Components a gravação é
 * proibida pelo Next.js e lança erro, que é ignorado de propósito: nesse caso a
 * renovação da sessão já foi feita pelo `proxy.ts` (ver lib/supabase/proxy.ts).
 *
 * Crie um cliente novo a cada requisição; nunca o guarde em variável global.
 */
export async function createClient() {
  const cookieStore = await cookies()
  const { url, key } = getSupabaseEnv()

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Chamado a partir de um Server Component: o proxy renova a sessão.
        }
      },
    },
  })
}
