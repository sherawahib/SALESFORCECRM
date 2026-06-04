import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ops Platform',
  description: 'Enterprise CRM & Operations Hub',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
