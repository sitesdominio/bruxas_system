import type { Metadata } from 'next'
import { OlhoDaBruxa } from '@/components/olho-da-bruxa'

export const metadata: Metadata = {
  title: 'Banhos e produtos | Olho da Bruxa',
  description: 'Conheça os produtos e banhos rituais da Olho da Bruxa.',
}

export default function BanhosPage() {
  return <OlhoDaBruxa catalogOnly />
}
