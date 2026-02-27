import type { Metadata } from "next";
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
            <Navbar />
            {children}
            <SessionTimeoutManager />
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
