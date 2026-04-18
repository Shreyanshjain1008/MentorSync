import { AuthForm } from "@/components/auth/AuthForm";
import { AuthShell } from "@/components/auth/AuthShell";

export default function LoginPage() {
  return (
    <AuthShell
      eyebrow="MentorSync"
      title="Welcome back"
      subtitle="Log in with your MentorSync account to launch sessions, reconnect to active rooms, and continue collaborating in real time."
    >
      <AuthForm mode="login" />
    </AuthShell>
  );
}
