import { Dashboard } from "@/components/dashboard/dashboard";
import { WebDashboard } from "@/components/web/web-dashboard";
import { resolveRuntimeMode } from "@/lib/runtime/runtime-mode";

export default function HomePage() {
  return resolveRuntimeMode() === "web" ? <WebDashboard /> : <Dashboard />;
}
