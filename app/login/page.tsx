import { redirect } from "next/navigation";

export default function LoginPage() {
  redirect("/roomboard/index.html?mode=startup&auth=login");
}
