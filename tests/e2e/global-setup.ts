import { spawnSync } from "node:child_process";

import { PrismaClient, Role } from "@prisma/client";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

import {
  E2E_FOREIGN_WORKSPACE_SLUG,
  personas,
} from "./support/personas";

process.loadEnvFile?.(".env");

const prisma = new PrismaClient();

function requireEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing ${name}; browser persona setup cannot continue.`);
  }

  return value;
}

async function findAuthUserByEmail(
  supabase: SupabaseClient,
  email: string
): Promise<User | null> {
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });

    if (error) {
      throw error;
    }

    const user =
      data.users.find(
        (candidate) =>
          candidate.email?.trim().toLowerCase() === email.toLowerCase()
      ) ?? null;

    if (user || !data.nextPage || data.nextPage === page) {
      return user;
    }

    page = data.nextPage;
  }
}

async function upsertPersona(input: {
  supabase: SupabaseClient;
  organizationId: string;
  email: string;
  password: string;
  name: string;
  role: Role;
  membershipRole: "OWNER" | "ADMIN" | "MEMBER";
}) {
  const user = await prisma.user.upsert({
    where: {
      organizationId_email: {
        organizationId: input.organizationId,
        email: input.email,
      },
    },
    update: {
      name: input.name,
      role: input.role,
      activeOrganizationId: input.organizationId,
    },
    create: {
      organizationId: input.organizationId,
      activeOrganizationId: input.organizationId,
      name: input.name,
      email: input.email,
      role: input.role,
    },
  });

  await prisma.organizationMembership.upsert({
    where: {
      userId_organizationId: {
        userId: user.id,
        organizationId: input.organizationId,
      },
    },
    update: {
      role: input.membershipRole,
      status: "ACTIVE",
    },
    create: {
      userId: user.id,
      organizationId: input.organizationId,
      role: input.membershipRole,
      status: "ACTIVE",
    },
  });

  const existingAuthUser = await findAuthUserByEmail(
    input.supabase,
    input.email
  );
  const payload = {
    password: input.password,
    email_confirm: true,
    user_metadata: {
      name: input.name,
      full_name: input.name,
    },
    app_metadata: {
      ...(existingAuthUser?.app_metadata ?? {}),
      userId: user.id,
      activeOrganizationId: input.organizationId,
      e2ePersona: true,
    },
  };

  if (existingAuthUser) {
    const { error } = await input.supabase.auth.admin.updateUserById(
      existingAuthUser.id,
      payload
    );
    if (error) {
      throw error;
    }
  } else {
    const { error } = await input.supabase.auth.admin.createUser({
      email: input.email,
      ...payload,
    });
    if (error) {
      throw error;
    }
  }
}

export default async function globalSetup() {
  if (process.env.E2E_SKIP_SEED !== "1") {
    const seed = spawnSync(
      "npm",
      ["run", "db:seed:utopiatrax", "--", "--reset"],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          DEMO_SEED_QUIET: "1",
        },
        encoding: "utf8",
      }
    );

    if (seed.status !== 0) {
      const output = `${seed.stdout}\n${seed.stderr}`.replaceAll(
        "Traxium123!",
        "[redacted]"
      );
      throw new Error(`UtopiaTrax browser seed failed.\n${output}`);
    }
  }

  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  const organization = await prisma.organization.upsert({
    where: { slug: E2E_FOREIGN_WORKSPACE_SLUG },
    update: {
      name: "EvilTenant E2E",
      description: "Temporary hostile tenant for runtime isolation tests.",
      workspaceTrialEndsAt: new Date("2027-01-01T00:00:00.000Z"),
    },
    create: {
      slug: E2E_FOREIGN_WORKSPACE_SLUG,
      name: "EvilTenant E2E",
      description: "Temporary hostile tenant for runtime isolation tests.",
      workspaceTrialEndsAt: new Date("2027-01-01T00:00:00.000Z"),
    },
  });

  await upsertPersona({
    supabase,
    organizationId: organization.id,
    email: personas.foreignOwner.email,
    password: personas.foreignOwner.password,
    name: "Foreign Workspace Owner",
    role: Role.HEAD_OF_GLOBAL_PROCUREMENT,
    membershipRole: "OWNER",
  });
  await upsertPersona({
    supabase,
    organizationId: organization.id,
    email: personas.financeMember.email,
    password: personas.financeMember.password,
    name: "Finance Reviewer Member",
    role: Role.FINANCIAL_CONTROLLER,
    membershipRole: "MEMBER",
  });
  await upsertPersona({
    supabase,
    organizationId: organization.id,
    email: personas.normalMember.email,
    password: personas.normalMember.password,
    name: "Normal Workspace Member",
    role: Role.PROCUREMENT_ANALYST,
    membershipRole: "MEMBER",
  });

  await prisma.$disconnect();
}
