import { notFound } from 'next/navigation'
import { getHsCompanyBundle } from '@/lib/workspace/hs-company-queries'
import HsAuditForm from '../../components/HsAuditForm'

export const dynamic = 'force-dynamic'

export default async function HsAuditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const bundle = await getHsCompanyBundle(id)
  if (!bundle) notFound()
  return <HsAuditForm companyId={bundle.company.id} audit={bundle.audit} />
}
