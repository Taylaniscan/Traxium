import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

import {
  E2E_FOREIGN_WORKSPACE_SLUG,
  personas,
} from "./support/personas";

process.loadEnvFile?.(".env");

const prisma = new PrismaClient();

export default async function globalTeardown() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const emails = new Set<string>([
    personas.foreignOwner.email,
    personas.financeMember.email,
    personas.normalMember.email,
  ]);

  if (url && serviceRoleKey) {
    const supabase = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    let page = 1;

    while (true) {
      const { data, error } = await supabase.auth.admin.listUsers({
        page,
        perPage: 200,
      });
      if (error) {
        break;
      }

      for (const user of data.users) {
        if (user.email && emails.has(user.email)) {
          await supabase.auth.admin.deleteUser(user.id);
        }
      }

      if (!data.nextPage || data.nextPage === page) {
        break;
      }
      page = data.nextPage;
    }
  }

  const organization = await prisma.organization.findUnique({
    where: { slug: E2E_FOREIGN_WORKSPACE_SLUG },
    select: { id: true },
  });

  if (organization) {
    await prisma.organizationMembership.deleteMany({
      where: { organizationId: organization.id },
    });
    await prisma.user.deleteMany({
      where: { organizationId: organization.id },
    });
    await prisma.organization.delete({
      where: { id: organization.id },
    });
  }

  await prisma.$disconnect();
}
