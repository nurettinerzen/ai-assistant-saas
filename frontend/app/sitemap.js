import runtimeConfig from '@/lib/runtime-config';

const STATIC_ROUTES = [
  '/',
  '/pricing',
  '/features',
  '/integrations',
  '/about',
  '/contact',
  '/login',
  '/signup',
];

export default function sitemap() {
  if (runtimeConfig.isBetaApp) {
    return [];
  }

  const baseUrl = runtimeConfig.siteUrl;
  const now = new Date();

  return STATIC_ROUTES.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: now,
  }));
}
