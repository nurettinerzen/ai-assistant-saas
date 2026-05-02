import JsonLd from '@/components/seo/JsonLd';
import {
  KEYWORDS_TR,
  buildOpenGraph,
  buildTwitter,
  languageAlternates,
} from '@/lib/seo/site';
import { breadcrumbSchema, faqSchema } from '@/lib/seo/schemas';
import { HOMEPAGE_FAQS_TR } from '@/lib/seo/faqs';
import runtimeConfig from '@/lib/runtime-config';

const TITLE = 'Sıkça Sorulan Sorular — Telyx AI Müşteri Hizmetleri';
const DESCRIPTION =
  'Telyx hakkında sıkça sorulan sorular: nasıl çalışır, hangi kanalları destekler, fiyatlandırma, KVKK uyumu, deneme süresi ve teknik kurulum.';

const SSS_KEYWORDS = [
  ...KEYWORDS_TR,
  'telyx sss',
  'telyx sıkça sorulan sorular',
  'telyx fiyat',
  'telyx kurulum',
  'whatsapp business api soruları',
];

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: SSS_KEYWORDS,
  alternates: languageAlternates('/sss'),
  openGraph: buildOpenGraph({
    title: TITLE,
    description: DESCRIPTION,
    path: '/sss',
  }),
  twitter: buildTwitter({ title: TITLE, description: DESCRIPTION }),
};

const breadcrumbs = breadcrumbSchema([
  { name: 'Ana Sayfa', path: '/' },
  { name: 'SSS', path: '/sss' },
]);

const faq = faqSchema(HOMEPAGE_FAQS_TR);

export default function SssLayout({ children }) {
  const includeStructuredData = !runtimeConfig.isBetaApp;
  return (
    <>
      {includeStructuredData ? <JsonLd id="sss" data={[faq, breadcrumbs]} /> : null}
      {children}
    </>
  );
}
