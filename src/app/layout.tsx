import type { Metadata, Viewport } from "next"
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google"
import { ThemeProvider } from "next-themes"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { RegisterSW } from "@/components/pwa/register-sw"
import { InstallPrompt } from "@/components/pwa/install-prompt"
import { ChunkErrorHandler } from "@/components/pwa/chunk-error-handler"
import { LanguageProvider } from "@/components/providers/language-context"
import "./globals.css"

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
})

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
})

export const metadata: Metadata = {
  title: "AI-HOS | Hospital Operating System",
  description: "Next-generation AI-powered Hospital Operating System",
  manifest: "/manifest.json",
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "AI-HOS",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#0F172A" },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${jakarta.variable} ${mono.variable} font-sans antialiased`}>
        {/* Skip navigation link for keyboard/screen-reader users */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-white focus:text-cyan-700 focus:rounded-lg focus:shadow-lg focus:ring-2 focus:ring-cyan-600 focus:text-sm focus:font-semibold dark:focus:bg-gray-900 dark:focus:text-cyan-400"
        >
          Skip to main content
        </a>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <LanguageProvider>
            <TooltipProvider>
              <main id="main-content">{children}</main>
            </TooltipProvider>
          </LanguageProvider>
          <Toaster richColors position="top-right" />
          <RegisterSW />
          <InstallPrompt />
          <ChunkErrorHandler />
        </ThemeProvider>
      </body>
    </html>
  )
}
