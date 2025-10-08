import { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://www.coupon-cycle.site'
  
  // Fetch all benefit usage way slugs for dynamic pages
  let usageWays: { slug: string; updatedAt: Date }[] = []
  try {
    usageWays = await prisma.benefitUsageWay.findMany({
      select: {
        slug: true,
        updatedAt: true,
      },
    })
  } catch (error) {
    console.warn('Could not fetch benefit usage ways for sitemap:', error)
  }
  
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
      url: `${baseUrl}/loyalty`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
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
  
  // Dynamic benefit usage guide pages
  const dynamicPages: MetadataRoute.Sitemap = usageWays.map((way) => ({
    url: `${baseUrl}/benefits/how-to-use/${way.slug}`,
    lastModified: way.updatedAt,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }))
  
  return [...staticPages, ...dynamicPages]
}
