import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../locales/en.json";
import Shell from "@/components/Shell";
import { AuthProvider } from "@/context/Auth";
import "./globals.css";

export const metadata = {
  title: "Agency administration",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <NextIntlClientProvider locale="en" messages={messages}>
          <AuthProvider>
            <Shell>{children}</Shell>
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
