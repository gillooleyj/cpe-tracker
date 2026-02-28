import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import ThemeProvider from "./ThemeProvider";
import Navbar from "./Navbar";
import AuthProvider from "./AuthProvider";
import SessionTimeoutManager from "./SessionTimeoutManager";

export const metadata: Metadata = {
  title: "CredVault",
  description: "Track your professional certifications, CPD progress, and renewal deadlines — all in one place.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 antialiased">
        <AuthProvider>
          <ThemeProvider>
            <div className="flex flex-col min-h-screen">
              <Navbar />
              <div className="flex-1">
                {children}
              </div>
              <footer className="border-t border-gray-200 dark:border-gray-700 py-6 px-4 mt-auto">
                <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <p>© {new Date().getFullYear()} CredVault by Cooey Tools. All rights reserved.</p>
                  <nav className="flex gap-4">
                    <Link href="/privacy" className="hover:text-gray-700 dark:hover:text-gray-200 transition-colors">Privacy Policy</Link>
                    <Link href="/terms" className="hover:text-gray-700 dark:hover:text-gray-200 transition-colors">Terms of Service</Link>
                  </nav>
                </div>
              </footer>
              <SessionTimeoutManager />
            </div>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
