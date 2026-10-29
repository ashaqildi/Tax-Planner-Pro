import "@/index.css";
import type { Metadata, Viewport } from "next";
export const metadata: Metadata = { title: "Tax Estimated Payment Manager", icons: { icon: "/favicon.svg" } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1 };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body><div id="root">{children}</div></body></html>; }
