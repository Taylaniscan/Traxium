export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";

const DEMO_USERS = [
  { id: "1", name: "Taylan Iscan", email: "taylan@traxium.ai", role: "Head of Global Procurement" },
  { id: "2", name: "Alice Buyer", email: "alice@traxium.ai", role: "Buyer" },
  { id: "3", name: "Frank Finance", email: "frank@traxium.ai", role: "Financial Controller" },
];

async function login(formData: FormData) {
  "use server";

  const email = String(formData.get("email") || "");
  const cookieStore = await cookies();
  cookieStore.set("traxium-user", email, {
    httpOnly: false,
    path: "/",
  });

  redirect("/dashboard");
}

export default async function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Login</CardTitle>
          <CardDescription>
            Select a demo user to access the savings tracker.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={login} className="space-y-4">
            <div>
              <Label htmlFor="email" className="mb-2 block">
                User
              </Label>

              <select
                id="email"
                name="email"
                defaultValue={DEMO_USERS[0].email}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {DEMO_USERS.map((user) => (
                  <option key={user.id} value={user.email}>
                    {user.name} · {user.role}
                  </option>
                ))}
              </select>
            </div>

            <Button type="submit" className="w-full">
              Continue
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}