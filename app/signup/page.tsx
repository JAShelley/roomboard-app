import { redirect } from "next/navigation";

export default function SignUpPage() {
  redirect("/app/index.html?mode=startup&auth=create");
}
