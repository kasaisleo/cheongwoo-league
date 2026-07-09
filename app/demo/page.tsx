import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEMO_SESSION_COOKIE } from "@/lib/demo-session";
import DemoPageClient from "./DemoPageClient";

export default async function DemoPage() {
  const cookieStore = cookies();
  const sessionId = cookieStore.get(DEMO_SESSION_COOKIE)?.value;

  if (!sessionId) {
    redirect("/api/demo/init");
  }

  return <DemoPageClient />;
}
