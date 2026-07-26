import type { Metadata } from 'next'
import { getRole } from '../../data/roles'

type Props = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const role = getRole(slug)

  if (!role) {
    return {
      title: 'Position Not Found',
      description: 'The requested position could not be found.',
    }
  }

  return {
    title: `${role.title} - ${role.departmentLabel}`,
    description: role.seoDescription,
    alternates: {
      canonical: `https://hiring.divineacquisition.io/hiring/${slug}`,
    },
    openGraph: {
      title: `${role.title} at Divine Acquisition`,
      description: role.seoDescription,
      url: `https://hiring.divineacquisition.io/hiring/${slug}`,
      type: 'website',
      images: [
        {
          url: '/icon-512.png',
          width: 512,
          height: 512,
          alt: `${role.title} - Divine Acquisition`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${role.title} at Divine Acquisition`,
      description: role.seoDescription,
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
