import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { Sidebar } from "@/components/sidebar/sidebar";
import { THEME_SCRIPT } from "@/components/theme-toggle";
import { TooltipProvider } from "@/components/ui/tooltip";
import { appUrl } from "@/lib/catalog/domain";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "component-library";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl()),
  title: {
    default: appName,
    template: `%s · ${appName}`,
  },
  description:
    "Every new UI component, block, and library found on X, in one searchable place.",
};

export default function RootLayout({ children, modal }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full bg-background text-foreground">
        <TooltipProvider>
          <SiteHeader />
          <div className="flex">
            <Sidebar />
            <main className="min-w-0 flex-1">{children}</main>
          </div>
          {modal}
        </TooltipProvider>
      </body>
    </html>
  );
}
