import type { Metadata, Viewport } from 'next';
import './globals.css';
import { QueryProvider } from '@/lib/client/query';
import { Toaster } from '@/components/ui/Toaster';

export const metadata: Metadata = {
  title: 'GoyLLM',
  description: 'Self-hosted LLM roleplay client',
};

export const viewport: Viewport = {
  themeColor: '#231a2e',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="goyllm" suppressHydrationWarning>
      <body className="h-dvh overflow-hidden">
        <QueryProvider>
          {children}
          <Toaster />
        </QueryProvider>
      </body>
    </html>
  );
}
