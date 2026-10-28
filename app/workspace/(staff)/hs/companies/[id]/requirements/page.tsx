import { notFound } from 'next/navigation'
import { getHsCompanyBundle } from '@/lib/workspace/hs-company-queries'
import HsRequirementsForm from '../../components/HsRequirementsForm'

export const dynamic = 'force-dynamic'

export default async function HsRequirementsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const bundle = await getHsCompanyBundle(id)
  if (!bundle) notFound()
  return <HsRequirementsForm companyId={bundle.company.id} requirements={bundle.requirements} />
}
