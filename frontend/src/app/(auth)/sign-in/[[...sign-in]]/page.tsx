"use client";

import { SignIn } from "@clerk/nextjs";
import { EmailSignInNotSwitchedOn } from "@/components/account/email-sign-in-off";
import { clerkEnabled } from "@/lib/clerk";

export default function SignInRoute() {
  if (!clerkEnabled()) return <EmailSignInNotSwitchedOn />;
  return (
    <main className="flex w-full justify-center px-4 py-10">
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        fallbackRedirectUrl="/account/enter"
      />
    </main>
  );
}
