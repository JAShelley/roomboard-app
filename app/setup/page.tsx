import { redirect } from "next/navigation";

export default function SetupPage() {
  redirect("/app/index.html?mode=setup");
}
