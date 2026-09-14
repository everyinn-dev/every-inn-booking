import type { MetadataRoute } from 'next';
import { ROOMS } from '../data/rooms';

export default function sitemap(): MetadataRoute.Sitemap {
  const roomUrls: MetadataRoute.Sitemap = ROOMS.map((room) => ({
    url: `https://everyinn.vn/room/${room.id}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  return [
    {
      url: 'https://everyinn.vn',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    ...roomUrls,
  ];
}

