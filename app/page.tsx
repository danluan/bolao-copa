import Dashboard from "@/components/dashboard";
import { getDashboardData } from "@/lib/bolao";

export const dynamic = "force-dynamic";

export default async function Home() {
  const initialData = await getDashboardData();
  return <Dashboard initialData={initialData} />;
}
