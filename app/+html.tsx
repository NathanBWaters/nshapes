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
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />

        {/* PWA manifest */}
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
