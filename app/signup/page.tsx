import { redirect } from "next/navigation";

export default function SignUpPage() {
  redirect("/roomboard/index.html?mode=startup&auth=create");
}
