import type { NextRequest } from "next/server";

/**
 * The contact form's endpoint.
 *
 * It posts through Resend, and it is honest about the one thing that can stop
 * it working: without RESEND_API_KEY set on the server there is no mail
 * transport, and this route says so with a 503 and a `not_configured` code the
 * page turns into a visible instruction. A success message that no mailbox ever
 * received is the failure mode this file exists to avoid.
 *
 * Nothing here logs the message body. This form is read by a person, not stored
 * in a database, and the app's own data-minimisation rule applies to what is
 * typed into it.
 */

const SUBJECTS = ["general", "privacy", "grievance", "technical"] as const;
type Subject = (typeof SUBJECTS)[number];

const LIMITS = { name: 80, email: 160, message: 4000 };

type Fields = {
  name: string;
  email: string;
  subject: Subject;
  message: string;
};

function json(body: Record<string, unknown>, status: number) {
  return Response.json(body, { status });
}

/** Field-by-field errors, so the form can mark the box that is wrong. */
type ValidationResult =
  | { ok: true; fields: Fields }
  | { ok: false; errors: Record<string, string> };

function validate(raw: Record<string, unknown>): ValidationResult {
  const errors: Record<string, string> = {};
  const pick = (key: string, max: number) => {
    const value = typeof raw[key] === "string" ? String(raw[key]).trim() : "";
    if (!value) errors[key] = "required";
    else if (value.length > max) errors[key] = "too_long";
    return value;
  };

  const name = pick("name", LIMITS.name);
  const email = pick("email", LIMITS.email);
  const message = pick("message", LIMITS.message);

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.email = "invalid_email";
  if (message && message.length < 10) errors.message = "too_short";

  const subject: Subject | undefined = SUBJECTS.includes(raw.subject as Subject)
    ? (raw.subject as Subject)
    : undefined;
  if (!subject) errors.subject = "invalid";

  if (Object.keys(errors).length || !subject) return { ok: false, errors };
  return { ok: true, fields: { name, email, subject, message } };
}

async function sendMail(fields: Fields, resendKey: string, from: string, to: string) {
  const labels: Record<Subject, string> = {
    general: "General enquiry",
    privacy: "Privacy",
    grievance: "Grievance",
    technical: "Technical problem",
  };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: fields.email,
      subject: `[${labels[fields.subject]}] ${fields.name}`,
      text: `${fields.name} <${fields.email}>\n\n${fields.message}`,
    }),
  });
  return response.ok;
}

export async function POST(request: NextRequest) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }
  if (!raw || typeof raw !== "object") return json({ ok: false, error: "invalid_json" }, 400);

  const body = raw as Record<string, unknown>;

  // A hidden field no person fills in. Anything that does is a bot, and it gets
  // the same shape of answer as a real message so it cannot learn to stop.
  if (typeof body.company === "string" && body.company.trim()) {
    return json({ ok: true, delivered: false }, 200);
  }

  const result = validate(body);
  if (!result.ok) return json({ ok: false, error: "invalid", fields: result.errors }, 422);

  const resendKey = process.env.RESEND_API_KEY ?? "";
  const from = process.env.CONTACT_FROM_EMAIL ?? "";
  const to = process.env.CONTACT_TO_EMAIL ?? "";

  if (!resendKey || !from || !to) {
    return json(
      {
        ok: false,
        error: "not_configured",
        // Which of the three is missing, without ever printing a value.
        missing: [
          !resendKey && "RESEND_API_KEY",
          !from && "CONTACT_FROM_EMAIL",
          !to && "CONTACT_TO_EMAIL",
        ].filter(Boolean),
      },
      503,
    );
  }

  let delivered = false;
  try {
    delivered = await sendMail(result.fields, resendKey, from, to);
  } catch {
    // A network failure is reported as one, not as a dropped message.
    return json({ ok: false, error: "upstream" }, 502);
  }
  if (!delivered) return json({ ok: false, error: "upstream" }, 502);

  return json({ ok: true, delivered: true }, 200);
}
