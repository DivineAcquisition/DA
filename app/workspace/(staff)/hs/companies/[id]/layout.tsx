import { notFound } from 'next/navigation'
import { getHsCompanyBundle } from '@/lib/workspace/hs-company-queries'
import HsCompanyShell from '../components/HsCompanyShell'

export const dynamic = 'force-dynamic'

export default async function HsCompanyLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const bundle = await getHsCompanyBundle(id)
  if (!bundle) notFound()

  return (
    <HsCompanyShell
      company={bundle.company}
      audit={bundle.audit}
      debrief={bundle.debrief}
      requirements={bundle.requirements}
    >
      {children}
    </HsCompanyShell>
  )
}
