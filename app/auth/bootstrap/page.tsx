import { PostLoginTransition } from "@/components/auth/post-login-transition";
import { resolveInviteNextPath } from "@/lib/auth-navigation";

export default async function AuthBootstrapPage(
  {
    searchParams,
  }: {
    searchParams: Promise<{ next?: string | string[] }>;
  }
) {
  const { next } = await searchParams;
  const nextPath = resolveInviteNextPath(next);

  return <PostLoginTransition nextPath={nextPath} />;
}
