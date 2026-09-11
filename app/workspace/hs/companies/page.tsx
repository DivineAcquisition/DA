import { listHsCompanies } from '@/lib/workspace/hs-company-queries'
import HsCompaniesList from './components/HsCompaniesList'

export const dynamic = 'force-dynamic'

export default async function HsCompaniesPage() {
  const companies = await listHsCompanies()
  return (
    <div className="animate-rise">
      <HsCompaniesList companies={companies} />
    </div>
  )
}
