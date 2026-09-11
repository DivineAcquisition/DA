import { Plus_Jakarta_Sans } from 'next/font/google'
import type { Metadata } from 'next'

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'HS companies',
  description: 'Audit, debrief, and kickoff requirements for each home-services company.',
}

export default function HsCompaniesSectionLayout({ children }: { children: React.ReactNode }) {
  return <div className={plusJakarta.variable}>{children}</div>
}
