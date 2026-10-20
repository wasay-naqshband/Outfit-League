import React, { type PropsWithChildren } from "react";
import { ScrollViewStyleReset } from "expo-router/html";

export default function Html({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <title>Outfit League</title>
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html:
              "body{background:#FFFBEA}#root{width:100%;max-width:480px;margin:0 auto;box-shadow:0 0 60px #14121f12}button:focus-visible,[role=tab]:focus-visible{outline:3px solid #FF9BD2;outline-offset:3px}",
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
