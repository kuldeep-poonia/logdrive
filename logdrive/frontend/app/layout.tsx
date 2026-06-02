import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'LogDrive – Runtime Visualizer',
  description: 'Live runtime traffic simulator',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-black text-white font-mono">{children}</body>
    </html>
  );
}