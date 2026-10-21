"use client";

import { SignUp } from "@clerk/nextjs";
import { EmailSignInNotSwitchedOn } from "@/components/account/email-sign-in-off";
import { clerkEnabled } from "@/lib/clerk";

export default function SignUpRoute() {
  if (!clerkEnabled()) return <EmailSignInNotSwitchedOn />;
  return (
    <main className="flex w-full justify-center px-4 py-10">
      {/* A fresh email is connected to nothing yet, so land on the screen that connects it. */}
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        fallbackRedirectUrl="/account/connect"
      />
    </main>
  );
}
