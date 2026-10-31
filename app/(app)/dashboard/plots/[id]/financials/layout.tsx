import { BoughtOnly } from "@/components/bought-only";
import { NeedAccess } from "@/components/need-access";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <NeedAccess area="feasibility"><BoughtOnly>{children}</BoughtOnly></NeedAccess>;
}
