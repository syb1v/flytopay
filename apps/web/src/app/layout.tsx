import type { Metadata } from "next";
import "./globals.css";
import { PreferencesProvider } from "../components/providers/PreferencesProvider";

export const metadata: Metadata = {
  title: "Flytopay",
  description: "Виртуальные карты для зарубежных сервисов.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg", apple: "/logo.svg" },
};
export const viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" as const };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>
        <script src="https://telegram.org/js/telegram-web-app.js" async />
        <PreferencesProvider>{children}</PreferencesProvider>
      </body>
    </html>
  );
}
