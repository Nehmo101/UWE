import Link from "next/link";
import { LogoutButton } from "./LogoutButton";

interface AuthHeaderProps {
  user: {
    displayName: string;
    email: string | null;
  } | null;
}

export function AuthHeader({ user }: AuthHeaderProps) {
  return (
    <header className="auth-header">
      <Link href="/">UWE Portal</Link>
      <nav>
        <Link href="/auth/worlds">Welten</Link>
        {user ? <LogoutButton displayName={user.displayName} /> : <Link href="/login">Anmelden</Link>}
      </nav>
    </header>
  );
}
