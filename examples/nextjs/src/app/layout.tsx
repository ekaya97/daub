import type { Metadata } from 'next';
import { DaubProvider } from '@daub/next/provider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Daub — Next.js Example',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen">
        <DaubProvider>{children}</DaubProvider>
      </body>
    </html>
  );
}
