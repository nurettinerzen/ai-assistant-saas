import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import Markdown from '@/components/kb/Markdown';
import JsonLd from '@/components/seo/JsonLd';
import { getResource, getAllResources } from '@/lib/kb/loader';
import {
  buildOpenGraph,
  buildTwitter,
  languageAlternates,
} from '@/lib/seo/site';
import { articleSchema, breadcrumbSchema } from '@/lib/seo/schemas';
import runtimeConfig from '@/lib/runtime-config';

export const dynamic = 'force-static';

export async function generateStaticParams() {
  const resources = await getAllResources();
  return resources.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({ params }) {
  const resource = await getResource(params.slug);
  if (!resource) return { title: 'Bulunamadı' };

  const path = `/kaynak/${resource.slug}`;
  return {
    title: resource.title,
    description: resource.description,
    keywords: resource.keywords,
    alternates: languageAlternates(path),
    openGraph: buildOpenGraph({
      title: resource.title,
      description: resource.description,
      path,
      type: 'article',
    }),
    twitter: buildTwitter({
      title: resource.title,
      description: resource.description,
    }),
  };
}

export default async function KaynakDetailPage({ params }) {
  const resource = await getResource(params.slug);
  if (!resource) notFound();

  const includeStructuredData = !runtimeConfig.isBetaApp;
  const path = `/kaynak/${resource.slug}`;

  const article = articleSchema({
    headline: resource.title,
    description: resource.description,
    path,
    datePublished: '2026-01-15T00:00:00Z',
    dateModified: '2026-05-01T00:00:00Z',
    inLanguage: 'tr-TR',
  });

  const breadcrumbs = breadcrumbSchema([
    { name: 'Ana Sayfa', path: '/' },
    { name: 'Kaynaklar', path: '/kaynak' },
    { name: resource.title, path },
  ]);

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950">
      <Navigation />

      {includeStructuredData ? (
        <JsonLd id={`kaynak-${resource.slug}`} data={[article, breadcrumbs]} />
      ) : null}

      <section className="pt-28 md:pt-32 pb-8">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <Link
              href="/kaynak"
              className="inline-flex items-center gap-1 text-sm font-medium text-gray-600 dark:text-neutral-400 hover:text-primary-700 dark:hover:text-primary-300 mb-6"
            >
              <ArrowLeft className="w-4 h-4" />
              Tüm kaynaklara dön
            </Link>
          </div>
        </div>
      </section>

      <article className="pb-20 md:pb-28">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <Markdown content={resource.content} />
          </div>

          <div className="max-w-3xl mx-auto mt-16 p-8 rounded-2xl bg-gradient-to-br from-primary-50 to-blue-50 dark:from-primary-950/30 dark:to-blue-950/30 border border-primary-100 dark:border-primary-900 text-center">
            <h2 className="text-2xl font-bold mb-3 text-gray-900 dark:text-white">
              Telyx&apos;i Ücretsiz Deneyin
            </h2>
            <p className="text-gray-600 dark:text-neutral-400 mb-6">
              15 dakika telefon görüşmesi + 14 gün chat/WhatsApp erişimi. Kredi kartı gerekmez.
            </p>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-white hover:bg-primary/90 font-medium shadow-lg shadow-primary/20 transition-all"
            >
              Hemen başlayın
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </article>

      <Footer />
    </div>
  );
}
