import { MoneyOnly } from "@/components/money-only";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <MoneyOnly>{children}</MoneyOnly>;
}
