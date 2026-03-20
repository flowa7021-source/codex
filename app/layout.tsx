import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "NEXUS — Operations Command Center",
  description: "Дашборд оперативного управления подразделением УМиТ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="h-full">
      <head>
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
        />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="h-full antialiased" style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'var(--color-elevated)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            },
          }}
        />
      </body>
    </html>
  );
}
