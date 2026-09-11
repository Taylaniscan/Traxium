import { redirect } from "next/navigation";

// Timeline moved under Reports (/reports/timeline).
export default function TimelinePage() {
  redirect("/reports/timeline");
}
