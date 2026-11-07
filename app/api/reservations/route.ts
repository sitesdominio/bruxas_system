import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const serviceId = typeof body?.serviceId === 'string' ? body.serviceId : ''
  const serviceName = typeof body?.serviceName === 'string' ? body.serviceName.trim() : ''
  const customerName = typeof body?.customerName === 'string' ? body.customerName.trim() : ''
  const customerPhone = typeof body?.customerPhone === 'string' ? body.customerPhone.trim() : ''
  const scheduledAt = typeof body?.scheduledAt === 'string' ? body.scheduledAt : ''
  const notes = typeof body?.notes === 'string' ? body.notes.trim() : null

  if ((!serviceId && !serviceName) || !customerName || !customerPhone || !scheduledAt) {
    return NextResponse.json({ error: 'Preencha todos os dados do agendamento.' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Entre na sua conta para agendar.' }, { status: 401 })

  let resolvedServiceId = serviceId
  if (!resolvedServiceId) {
    const { data: service } = await supabase.from('services').select('id').eq('name', serviceName).eq('active', true).maybeSingle()
    resolvedServiceId = service?.id ?? ''
  }
  if (!resolvedServiceId) return NextResponse.json({ error: 'Serviço não encontrado.' }, { status: 404 })

  const { data, error } = await supabase.from('reservations').insert({
    user_id: user.id,
    service_id: resolvedServiceId,
    customer_name: customerName,
    customer_phone: customerPhone,
    scheduled_at: scheduledAt,
    notes,
  }).select('id, scheduled_at, status').single()

  if (error) return NextResponse.json({ error: 'Não foi possível salvar o agendamento.' }, { status: 500 })
  return NextResponse.json({ reservation: data }, { status: 201 })
}
