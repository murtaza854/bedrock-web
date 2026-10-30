import { BoughtOnly } from "@/components/bought-only";
import { MoneyOnly } from "@/components/money-only";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <MoneyOnly><BoughtOnly>{children}</BoughtOnly></MoneyOnly>;
}
