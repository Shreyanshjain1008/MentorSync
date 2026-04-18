import { AuthForm } from "@/components/auth/AuthForm";
import { AuthShell } from "@/components/auth/AuthShell";

export default function SignupPage() {
  return (
    <AuthShell
      eyebrow="MentorSync"
      title="Create your live workspace"
      subtitle="Sign up as a mentor or student. Your role is synced to Supabase Auth and used throughout the collaboration flow."
    >
      <AuthForm mode="signup" />
    </AuthShell>
  );
}
