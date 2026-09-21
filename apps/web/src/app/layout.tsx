import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Flytopay", description: "Виртуальные карты для зарубежных сервисов." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body>{children}</body></html>;
}
