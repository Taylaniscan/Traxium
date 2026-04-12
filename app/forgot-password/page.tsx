import { Suspense } from "react";

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import ForgotPasswordLoadingPage from "@/app/forgot-password/loading";

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<ForgotPasswordLoadingPage />}>
      <ForgotPasswordForm />
    </Suspense>
  );
}
