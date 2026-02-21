import type { Metadata } from "next";
import "./globals.css";
import ThemeProvider from "./ThemeProvider";
import Navbar from "./Navbar";

export const metadata: Metadata = {
  title: "CPE Tracker",
  description: "Track your continuing professional education credits",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 antialiased">
        <ThemeProvider>
          <Navbar />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
