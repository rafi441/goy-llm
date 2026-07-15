import type { Metadata, Viewport } from 'next';
import './globals.css';
import { QueryProvider } from '@/lib/client/query';
import { Toaster } from '@/components/ui/Toaster';

export const metadata: Metadata = {
  title: 'GoyLLM',
  description: 'Self-hosted LLM roleplay client',
};

export const viewport: Viewport = {
  themeColor: '#171717',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

const THEME_INIT = `(function(){try{var t=localStorage.getItem('goy-theme')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'goy-dark':'goy-light';}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="goy-dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="h-dvh overflow-hidden">
        <QueryProvider>
          {children}
          <Toaster />
        </QueryProvider>
      </body>
    </html>
  );
}
