import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />

        {/* Page <title> is populated via expo-router/head in app/_layout.tsx so static HTML emits a single non-empty <title> */}
        <meta
          name="description"
          content="A pattern-matching roguelike — match trios, bend the rules, and build wild combos."
        />

        {/* Open Graph social preview */}
        <meta property="og:title" content="NShapes — Pattern-Matching Roguelike" />
        <meta
          property="og:description"
          content="A pattern-matching roguelike — match trios, bend the rules, and build wild combos."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://nathanbwaters.github.io/nshapes/" />
        <meta property="og:image" content="https://nathanbwaters.github.io/nshapes/icons/icon-512.png" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="NShapes — Pattern-Matching Roguelike" />
        <meta
          name="twitter:description"
          content="A pattern-matching roguelike — match trios, bend the rules, and build wild combos."
        />
        <meta name="twitter:image" content="https://nathanbwaters.github.io/nshapes/icons/icon-512.png" />

        <link rel="manifest" href="/nshapes/manifest.json" />

        {/* Apple touch icons for iOS */}
        <link rel="apple-touch-icon" sizes="180x180" href="/nshapes/icons/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="NShapes" />

        {/* Theme color for mobile browsers */}
        <meta name="theme-color" content="#000000" />

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
