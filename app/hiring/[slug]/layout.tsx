import type { Metadata } from 'next'

// Job metadata for SEO
const jobMetadata: Record<string, { title: string; description: string; department: string }> = {
  'system-integrator': {
    title: 'Systems Architect',
    description: 'Join Divine Acquisition as a Systems Architect. Build pipelines, automations, workflows, and integrations using GHL, Zapier, Make, and APIs. Remote position with project-based and retainer compensation.',
    department: 'Operations',
  },
  'setter': {
    title: 'Appointment Setter',
    description: 'Join Divine Acquisition as an Appointment Setter. Book qualified calls with high-quality prospects and help grow our client base. Remote position with competitive compensation and upside.',
    department: 'Sales',
  },
  'closer': {
    title: 'Closer',
    description: 'Join Divine Acquisition as a Closer. Convert qualified opportunities into long-term client partnerships through consultative sales. Remote position with base salary plus commission.',
    department: 'Sales',
  },
  'media-buyer': {
    title: 'Media Buyer',
    description: 'Join Divine Acquisition as a Media Buyer. Take capital and turn it into qualified conversations across Meta, Google, and YouTube. Remote position with base salary plus performance bonuses.',
    department: 'Growth',
  },
  'client-success': {
    title: 'Client Success Manager',
    description: 'Join Divine Acquisition as a Client Success Manager. Own client relationships from onboarding through renewal and drive transformation. Remote position with per-client retainer plus bonuses.',
    department: 'Client Success',
  },
}

type Props = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const job = jobMetadata[slug]

  if (!job) {
    return {
      title: 'Position Not Found',
      description: 'The requested position could not be found.',
    }
  }

  return {
    title: `${job.title} - ${job.department}`,
    description: job.description,
    openGraph: {
      title: `${job.title} at Divine Acquisition`,
      description: job.description,
      url: `https://hiring.divineacquisition.io/hiring/${slug}`,
      type: 'website',
      images: [
        {
          url: '/logo.png',
          width: 800,
          height: 800,
          alt: `${job.title} - Divine Acquisition`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${job.title} at Divine Acquisition`,
      description: job.description,
    },
  }
}

export default function RoleLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
