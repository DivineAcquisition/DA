import { notFound } from 'next/navigation'
import { getHsCompanyBundle } from '@/lib/workspace/hs-company-queries'
import HsDebriefForm from '../../components/HsDebriefForm'

export const dynamic = 'force-dynamic'

export default async function HsDebriefPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const bundle = await getHsCompanyBundle(id)
  if (!bundle) notFound()
  return <HsDebriefForm companyId={bundle.company.id} debrief={bundle.debrief} />
}
