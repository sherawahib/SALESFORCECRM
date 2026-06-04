import type { Metadata } from 'next';
import { PLATFORM_NAME, PLATFORM_TAGLINE } from '@ops/shared';
import './globals.css';

export const metadata: Metadata = {
  title: PLATFORM_NAME,
  description: PLATFORM_TAGLINE,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
