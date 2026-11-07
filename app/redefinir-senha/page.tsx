'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function RedefinirSenhaPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (password.length < 8) return setError('A senha precisa ter pelo menos 8 caracteres.')
    if (password !== confirmation) return setError('As senhas não coincidem.')
    const { error: updateError } = await createClient().auth.updateUser({ password })
    if (updateError) return setError('Não foi possível atualizar sua senha. Solicite um novo email.')
    setMessage('Senha atualizada com sucesso. Você já pode voltar ao site.')
    setTimeout(() => router.push('/'), 1200)
  }

  return <main className="auth-page"><div className="auth-page-card"><p className="section-kicker">Olho da Bruxa</p><h1>Nova senha</h1><p>Escolha uma senha segura para continuar sua jornada.</p><form onSubmit={handleSubmit}><label>Nova senha<input type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required /></label><label>Confirmar senha<input type="password" minLength={8} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required /></label>{error && <p className="form-error" role="alert">{error}</p>}{message && <p className="auth-success" role="status">{message}</p>}<button className="primary-button full" type="submit">Atualizar senha</button></form></div></main>
}
