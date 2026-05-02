import Link from 'next/link';
import Navigation from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import Markdown from '@/components/kb/Markdown';
import { ArrowRight, MessageCircleQuestion } from 'lucide-react';
import { HOMEPAGE_FAQS_TR } from '@/lib/seo/faqs';
import { getFaqMarkdown } from '@/lib/kb/loader';

export const dynamic = 'force-static';

export default async function SssPage() {
  const faqMarkdown = await getFaqMarkdown();

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950">
      <Navigation />

      <section className="pt-28 md:pt-36 pb-12 md:pb-16">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium bg-primary-50 text-primary-700 border border-primary-200 mb-6 dark:bg-primary-950/50 dark:text-primary-300 dark:border-primary-800/60">
              <MessageCircleQuestion className="w-4 h-4" />
              SSS
            </span>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-5 text-gray-900 dark:text-white">
              Sıkça Sorulan Sorular
            </h1>
            <p className="text-lg sm:text-xl text-gray-600 dark:text-neutral-400 max-w-2xl mx-auto">
              Telyx hakkında en çok merak edilenler — kanallar, fiyatlandırma, kurulum ve güvenlik.
            </p>
          </div>
        </div>
      </section>

      <section className="pb-12 md:pb-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold mb-6 text-gray-900 dark:text-white">
              Hızlı bakış
            </h2>
            <div className="space-y-4 mb-12">
              {HOMEPAGE_FAQS_TR.map((faq) => (
                <details
                  key={faq.question}
                  className="group rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/50 p-5"
                >
                  <summary className="flex items-center justify-between gap-3 cursor-pointer list-none">
                    <span className="text-base font-semibold text-gray-900 dark:text-white">
                      {faq.question}
                    </span>
                    <span className="text-primary-700 dark:text-primary-300 transition-transform group-open:rotate-45 text-2xl leading-none">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-gray-700 dark:text-neutral-300 leading-relaxed">
                    {faq.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      {faqMarkdown ? (
        <section className="pb-20 md:pb-28">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-2xl md:text-3xl font-bold mb-6 text-gray-900 dark:text-white">
                Tüm sorular ve cevaplar
              </h2>
              <Markdown content={faqMarkdown} />
            </div>
          </div>
        </section>
      ) : null}

      <section className="pb-20 md:pb-28">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto p-8 rounded-2xl bg-gradient-to-br from-primary-50 to-blue-50 dark:from-primary-950/30 dark:to-blue-950/30 border border-primary-100 dark:border-primary-900 text-center">
            <h2 className="text-2xl font-bold mb-3 text-gray-900 dark:text-white">
              Sorunuz hâlâ cevaplanmadı mı?
            </h2>
            <p className="text-gray-600 dark:text-neutral-400 mb-6">
              info@telyx.ai adresinden bize yazın veya iletişim formunu doldurun.
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-white hover:bg-primary/90 font-medium shadow-lg shadow-primary/20 transition-all"
            >
              İletişime geçin
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
