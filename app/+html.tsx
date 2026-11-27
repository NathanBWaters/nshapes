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
          content="Spot 3-card Sets to fire explosive combos, parry boss attacks, and build screen-clearing critter loadouts in a fast pattern-matching roguelike."
        />

        {/* Open Graph social preview */}
        <meta property="og:title" content="NShapes — Pattern-Matching Roguelike" />
        <meta
          property="og:description"
          content="Spot 3-card Sets to fire explosive combos, parry boss attacks, and build screen-clearing critter loadouts in a fast pattern-matching roguelike."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://nathanbwaters.github.io/nshapes/" />
        <meta property="og:image" content="https://nathanbwaters.github.io/nshapes/og-hero.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:type" content="image/png" />
        <meta
          property="og:image:alt"
          content="NShapes — Orange Tabby hero and glowing Circle, Triangle, and Bolt cards erupting in an explosive combo starburst"
        />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="NShapes — Pattern-Matching Roguelike" />
        <meta
          name="twitter:description"
          content="Spot 3-card Sets to fire explosive combos, parry boss attacks, and build screen-clearing critter loadouts in a fast pattern-matching roguelike."
        />
        <meta name="twitter:image" content="https://nathanbwaters.github.io/nshapes/og-hero.png" />

        <link rel="manifest" href="/nshapes/manifest.json" />

        {/* Apple touch icons for iOS */}
        <link rel="apple-touch-icon" sizes="180x180" href="/nshapes/icons/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="NShapes" />

        {/* Theme color for mobile browsers */}
        <meta name="theme-color" content="#F4EFE6" />

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
