import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Courier_Prime, Homemade_Apple } from "next/font/google";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});

const courierPrime = Courier_Prime({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--font-courier",
  display: "swap",
});

const homemadeApple = Homemade_Apple({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-handwriting",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MSREG Gala Camera — Client Appreciation Gala",
  description: "Eight exposures. Develop at 8:00 PM CST on November 14, 2026. A 1970s instant camera experience for the MSREG Client Appreciation Gala.",
  metadataBase: new URL("https://gala.mattsmithrealestategroup.com"),
  openGraph: {
    title: "MSREG Gala Camera — Client Appreciation Gala",
    description: "Eight exposures. Develop at 8:00 PM CST on November 14, 2026. A 1970s instant camera experience for our esteemed guests.",
    siteName: "MSREG Gala Camera",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MSREG Gala Camera — Client Appreciation Gala",
    description: "Eight exposures. Develop at 8:00 PM CST on November 14, 2026. A 1970s instant camera experience for our esteemed guests.",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MSREG Camera",
  },
};

export const viewport: Viewport = {
  themeColor: "#F4EEE1",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${cormorant.variable} ${courierPrime.variable} ${homemadeApple.variable} h-full`}
    >
      <body className="min-h-full bg-[#F4EEE1] text-[#1E1C1A] font-serif antialiased selection:bg-[#6B2A2A] selection:text-[#F4EEE1]">
        {/* Subtle physical film/paper grain overlay */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-50 h-full w-full opacity-35 mix-blend-multiply"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
