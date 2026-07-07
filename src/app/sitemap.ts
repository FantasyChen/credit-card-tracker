import { MetadataRoute } from 'next'
import { PRIMARY_SITE_URL } from '@/lib/site'
import { benefitUsageWays, getPublicStaticCards, STATIC_CATALOG_UPDATED_AT } from '@/lib/static-catalog'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = PRIMARY_SITE_URL
  
  const catalogUpdatedAt = new Date(STATIC_CATALOG_UPDATED_AT)
  
  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${baseUrl}/guide`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/benefits`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/benefits/how-to-use`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/cards`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/cards/browse`,
      lastModified: catalogUpdatedAt,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/loyalty`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/loyalty-landing`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/offline`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ]
  
  const cardPages: MetadataRoute.Sitemap = getPublicStaticCards().map((card) => ({
    url: `${baseUrl}/cards/browse/${encodeURIComponent(card.name)}`,
    lastModified: new Date(card.updatedAt),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }))

  // Dynamic benefit usage guide pages
  const dynamicPages: MetadataRoute.Sitemap = benefitUsageWays.map((way) => ({
    url: `${baseUrl}/benefits/how-to-use/${way.slug}`,
    lastModified: catalogUpdatedAt,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }))

  return [...staticPages, ...cardPages, ...dynamicPages]
}
