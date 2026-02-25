import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ThemeProvider } from 'next-themes';
import { Providers } from './providers';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700', '800']
});

export const metadata = {
  title: 'Telyx AI',
  description: 'Yapay zeka destekli telefon, chat, e-posta ve WhatsApp ile işletme iletişiminizi otomatikleştirin.',
  icons: {
    icon: [
      { url: '/telyx-icon.png', media: '(prefers-color-scheme: light)' },
      { url: '/telyx-icon-white.png', media: '(prefers-color-scheme: dark)' },
    ],
    shortcut: [
      { url: '/telyx-icon.png', media: '(prefers-color-scheme: light)' },
      { url: '/telyx-icon-white.png', media: '(prefers-color-scheme: dark)' },
    ],
    apple: '/telyx-icon.png',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body className={plusJakartaSans.className}>
        <Providers>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <LanguageProvider>
              {children}
            </LanguageProvider>
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}
