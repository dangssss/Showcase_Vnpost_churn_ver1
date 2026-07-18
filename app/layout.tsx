import type { Metadata } from "next";
import "./globals.css";

const publicBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const siteOrigin = process.env.GITHUB_PAGES === "true"
  ? "https://dangssss.github.io"
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  title: "Explainable Customer Churn Prioritization | Data Science Case Study",
  description: "A production-oriented logistics churn system that predicts risk two months ahead and produces an explainable intervention queue.",
  openGraph: {
    title: "Explainable Customer Churn Prioritization",
    description: "Logistics · 2-month horizon · Actionable risk queue",
    images: [{ url: `${publicBasePath}/og.png`, width: 1200, height: 630, alt: "Explainable Customer Churn Prioritization" }],
  },
  twitter: { card: "summary_large_image", images: [`${publicBasePath}/og.png`] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
