/**
 * Leitura centralizada das variáveis públicas do Supabase.
 *
 * As referências a `process.env.NEXT_PUBLIC_*` precisam ser escritas de forma
 * literal: o Next.js só as substitui no bundle do navegador dessa maneira.
 * Nenhum valor é registrado em log. A chave `service_role` NÃO é usada aqui
 * e nunca deve receber o prefixo NEXT_PUBLIC_.
 */
export function getSupabaseEnv(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error(
      'Configuração do Supabase ausente: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.',
    )
  }

  try {
    new URL(url)
  } catch {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL não é uma URL válida.')
  }

  return { url, key }
}

/** Versão que não lança erro: usada pelo proxy para não derrubar o site inteiro. */
export function hasSupabaseEnv(): boolean {
  try {
    getSupabaseEnv()
    return true
  } catch {
    return false
  }
}
