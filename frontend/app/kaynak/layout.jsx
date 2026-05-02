import JsonLd from '@/components/seo/JsonLd';
import {
  KEYWORDS_TR,
  buildOpenGraph,
  buildTwitter,
  languageAlternates,
} from '@/lib/seo/site';
import { breadcrumbSchema } from '@/lib/seo/schemas';
import runtimeConfig from '@/lib/runtime-config';

const TITLE = 'Kaynaklar — AI Müşteri Hizmetleri Rehberleri ve Dökümanlar';
const DESCRIPTION =
  'Telyx kaynak merkezi: yapay zeka destekli müşteri hizmetleri rehberleri, çok kanallı destek operasyonları, WhatsApp Business API, KVKK uyumu ve entegrasyon dokümanları.';

const KAYNAK_KEYWORDS = [
  ...KEYWORDS_TR,
  'telyx rehberi',
  'ai müşteri hizmetleri rehberi',
  'whatsapp business rehberi',
  'kvkk uyumlu ai',
];

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: KAYNAK_KEYWORDS,
  alternates: languageAlternates('/kaynak'),
  openGraph: buildOpenGraph({
    title: TITLE,
    description: DESCRIPTION,
    path: '/kaynak',
  }),
  twitter: buildTwitter({ title: TITLE, description: DESCRIPTION }),
};

const breadcrumbs = breadcrumbSchema([
  { name: 'Ana Sayfa', path: '/' },
  { name: 'Kaynaklar', path: '/kaynak' },
]);

export default function KaynakLayout({ children }) {
  const includeStructuredData = !runtimeConfig.isBetaApp;
  return (
    <>
      {includeStructuredData ? <JsonLd id="kaynak" data={breadcrumbs} /> : null}
      {children}
    </>
  );
}
