import Link from 'next/link';
import Navigation from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { ArrowRight, BookOpen } from 'lucide-react';
import { getAllResources } from '@/lib/kb/loader';

export const dynamic = 'force-static';

export default async function KaynakHubPage() {
  const resources = await getAllResources();

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950">
      <Navigation />

      <section className="pt-28 md:pt-36 pb-12 md:pb-16">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium bg-primary-50 text-primary-700 border border-primary-200 mb-6 dark:bg-primary-950/50 dark:text-primary-300 dark:border-primary-800/60">
              <BookOpen className="w-4 h-4" />
              Kaynaklar
            </span>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-5 text-gray-900 dark:text-white">
              AI Müşteri Hizmetleri Rehberleri
            </h1>
            <p className="text-lg sm:text-xl text-gray-600 dark:text-neutral-400 max-w-2xl mx-auto">
              Telyx&apos;in nasıl çalıştığını, hangi entegrasyonları desteklediğini ve verilerinizi nasıl koruduğumuzu detaylı rehberlerimizden öğrenin.
            </p>
          </div>
        </div>
      </section>

      <section className="pb-20 md:pb-28">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {resources.map((resource) => (
              <Link
                key={resource.slug}
                href={`/kaynak/${resource.slug}`}
                className="block group"
              >
                <article className="h-full p-6 md:p-8 rounded-2xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/50 hover:border-primary-400 dark:hover:border-primary-500 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                  <h2 className="text-xl md:text-2xl font-bold mb-3 text-gray-900 dark:text-white group-hover:text-primary-700 dark:group-hover:text-primary-300 transition-colors">
                    {resource.title}
                  </h2>
                  <p className="text-base leading-relaxed text-gray-600 dark:text-neutral-400 mb-5">
                    {resource.summary || resource.description}
                  </p>
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary-700 dark:text-primary-300">
                    Okumaya başla
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                </article>
              </Link>
            ))}
          </div>

          <div className="mt-12 text-center">
            <p className="text-gray-600 dark:text-neutral-400 mb-4">
              Sıkça sorulan soruların yanıtlarını arıyorsanız:
            </p>
            <Link
              href="/sss"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-white hover:bg-primary/90 font-medium shadow-lg shadow-primary/20 transition-all"
            >
              SSS sayfasına git
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
