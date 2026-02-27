import './globals.css';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ThemeProvider } from 'next-themes';
import { Providers } from './providers';

export const metadata = {
  title: 'Telyx AI',
  description: 'Yapay zeka destekli telefon, chat, e-posta ve WhatsApp ile işletme iletişiminizi otomatikleştirin.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body>
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
