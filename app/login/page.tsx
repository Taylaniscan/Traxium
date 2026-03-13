export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { prisma } from "@/lib/prisma";

async function login(formData: FormData) {
  "use server";

  const email = String(formData.get("email"));
  const cookieStore = await cookies();
  cookieStore.set("traxium-user", email, { httpOnly: false, path: "/" });
  redirect("/dashboard");
}

export default async function LoginPage() {
  const users = await prisma.user.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Login</CardTitle>
          <CardDescription>Select a seeded demo user to access the savings tracker.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={login} className="space-y-4">
            <div>
              <Label className="mb-2 block">User</Label>
              <Select name="email" defaultValue={users[0]?.email}>
                {users.map((user) => (
                  <option key={user.id} value={user.email}>
                    {user.name} · {user.role}
                  </option>
                ))}
              </Select>
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