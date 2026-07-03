import { redirect } from "next/navigation";

export default function LoginPage() {
  redirect("/app/index.html?mode=startup&auth=login");
}
