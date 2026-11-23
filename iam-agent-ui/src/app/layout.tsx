import type { ReactNode } from "react";
import { Suspense } from "react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../locales/en.json";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
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
            <Suspense>
              <Shell>{children}</Shell>
            </Suspense>
            <ToastContainer position="top-right" autoClose={5000} hideProgressBar={false} newestOnTop closeOnClick pauseOnFocusLoss draggable pauseOnHover />
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
