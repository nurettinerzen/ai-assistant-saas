import runtimeConfig from '@/lib/runtime-config';

export default function robots() {
  if (runtimeConfig.isBetaApp) {
    return {
      rules: {
        userAgent: '*',
        disallow: '/',
      },
      host: runtimeConfig.siteUrl,
    };
  }

  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: `${runtimeConfig.siteUrl}/sitemap.xml`,
    host: runtimeConfig.siteUrl,
  };
}
