import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseEnv, hasSupabaseEnv } from '@/lib/supabase/env'

/**
 * Renova a sessão do Supabase a cada requisição e propaga os cookies atualizados
 * tanto para o restante da requisição quanto para o navegador.
 *
 * Regras importantes (documentação oficial do Supabase para Next.js 16):
 *  - nenhum código entre `createServerClient` e `getClaims()`;
 *  - sempre devolver o `supabaseResponse` mais recente, senão o navegador e o
 *    servidor perdem a sincronia e a sessão é encerrada;
 *  - `getClaims()` valida a assinatura do token (não use `getSession()` aqui).
 *
 * Este proxy NÃO redireciona nem bloqueia páginas: apenas mantém a sessão
 * válida. A autorização de operações sensíveis continua no servidor (rotas de
 * API) e no banco (RLS).
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  // Sem configuração do Supabase (ex.: preview sem variáveis), não derruba o site.
  if (!hasSupabaseEnv()) return supabaseResponse

  const { url, key } = getSupabaseEnv()

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        )
        // Cabeçalhos anti-cache: impedem que uma CDN sirva a sessão de um usuário a outro.
        Object.entries(headers).forEach(([header, value]) => supabaseResponse.headers.set(header, value))
      },
    },
  })

  try {
    await supabase.auth.getClaims()
  } catch {
    // Falha de rede com o Supabase não deve derrubar a página.
  }

  return supabaseResponse
}
