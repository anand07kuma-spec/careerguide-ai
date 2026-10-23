"use client";

import { ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { IdentityCard } from "@/components/legal/identity-card";
import {
  LegalLayout,
  LegalSection,
  REPO_URL,
  type SectionRef,
} from "@/components/legal/legal-layout";
import { useT } from "@/lib/i18n";

/**
 * The privacy policy. Public, no session needed, and written to describe the
 * app that actually runs — device-id sessions, browser-only speech
 * recognition, Groq and Gemini as the only recipients of conversation text, a
 * payment provider that stays switched off until real keys are on the server,
 * and Google Analytics plus Microsoft Clarity on a deployment whose operator
 * has named those projects and whose visitor has accepted analytics. The
 * application's own code writes no cookie. Every claim below was checked
 * against the code before it was written; where the app does not yet do
 * something a policy usually promises (an export, an account deletion, a
 * retention clock), the page says so instead of pretending. The operator's own
 * contact details come from `src/lib/legal-entity.ts` rather than from this file.
 */

const LAST_UPDATED = "20 October 2026";

const SECTIONS: SectionRef[] = [
  { id: "introduction", title: "Introduction" },
  { id: "information-we-collect", title: "Information we collect" },
  { id: "how-we-use-it", title: "How we use it" },
  { id: "legal-basis", title: "Legal basis" },
  { id: "data-storage", title: "Data storage" },
  { id: "data-sharing", title: "Data sharing" },
  { id: "ai-disclosure", title: "AI-specific disclosure" },
  { id: "retention", title: "Data retention period" },
  { id: "your-rights", title: "Your rights" },
  { id: "portals", title: "School and counsellor portals" },
  { id: "study-abroad", title: "Study-abroad enquiries" },
  { id: "children", title: "Children’s privacy" },
  { id: "transfers", title: "International data transfers" },
  { id: "security", title: "Security measures" },
  { id: "cookies", title: "Cookies" },
  { id: "grievance-officer", title: "Grievance officer" },
  { id: "changes", title: "Changes to this policy" },
  { id: "contact", title: "Contact us" },
];

const STORED = [
  "Your role — student or parent — and a nickname, if you chose to give one.",
  "The class or grade you mention in conversation, if you mention one.",
  "The language your account opens in.",
  "Consent records, kept per scope: profile, voice, history.",
  "Your conversations with the guide, and their text.",
  "Your interest answers, your saved careers, and your study plans with their step status.",
  "The skill-gap note and the four-week plan written from a result’s scores. They sit on that result, on your account, and they are replaced only when you press the button that rewrites them.",
  "If you write a resume: the job title you aimed it at, and the class rows, skills and projects you typed, kept as one document on your account. Printing happens in your own browser — this app builds no file and keeps no copy of a printed page.",
  "Report records, and any parent-link relationship you start with a sharing code.",
  "If you accept an invitation to a school's or a counsellor's portal: one membership row for that portal, holding its name, the role the invitation was written for, the date you joined, and your own switch for finished reports.",
  "If you send a study-abroad enquiry: the name, email address and optional phone number you typed, the stage chosen from a short list, which country or service page sent it, what you wrote in the message box, and the fact and time of the contact tick. Its own section below.",
  "Opaque session tokens, so this browser can come back without a password.",
  "One opaque id from Clerk, and the date it was connected — only on an account whose owner chose to add an email sign-in. No address, no name from Clerk, no password.",
];

const NOT_COLLECTED = [
  "A student's account never needs a phone number, a password or an email address, and the app never asks for one. The two places a person does type an address are an invitation to a school's or a counsellor's portal, and a study-abroad enquiry — both described in their own sections below.",
  "The optional email sign-in does not change that. It is run by Clerk, and the only thing this app keeps from it is Clerk's own opaque user id — never the address, never a password.",
  "We do not store your location or your address, and the app never asks which school you go to. A study-abroad enquiry can hold a stage chosen from a short list and nothing more precise than that — never a school, never a city.",
  "We do not ask for bank account numbers or financial documents.",
  "We do not take photographs, and there is no camera feature to take them with.",
  "Raw microphone audio is never recorded and never uploaded. Speech-to-text happens inside your browser, using the Web Speech API, and only the resulting text leaves it.",
  "Nothing records or monitors in the background. The microphone is live only while the student is in an explicit listening state on the call screen.",
  "A practice interview is kept nowhere. Its questions and the answers typed into them live in the browser tab and end when the tab closes — the server holds no row for them, so the account-erasure step has nothing to remove there. What leaves the tab while the screen is open is described under Groq below.",
  "The application's own code sets one cookie — the session one named under Cookies below — and stores no IP address against your account. The two measurement services described there can set cookies of their own, and only on a public page, only after an answer of Accept or a custom choice that switches them on, and never on a student's or a parent's screen.",
  "If the optional email sign-in is switched on and a student actually uses it, Clerk's own library keeps its session in that browser. That storage is Clerk's, under Clerk's policy, not this app's — and it exists only for the account that chose to connect an email.",
  "We do not infer anything from your voice — not ability, not personality, not a diagnosis. The voice is only turned into words.",
];

const USES = [
  "To reply in the conversation, and to remember what was already said when you come back.",
  "To keep the interest answers, saved careers and study plans in one place for this device.",
  "To show a student’s own progress to a parent they deliberately shared it with, and to nobody else.",
  "To show a student’s own resume back to them when they come back to the screen, and to print it when they press the button.",
  "To know which consents have been given, so voice and history can be switched off again.",
];

const RECEIVERS = [
  {
    name: "Groq",
    body: "The text of the conversation is sent to the model openai/gpt-oss-120b, over Groq’s API, to generate the guide’s reply. Groq sees that text. Your voice never reaches it. The same kind of call happens on the resume screen: only the job title you type into the ✨ Suggest box is sent, so the model can name skills and project ideas for it. The rest of that document — the name, the marks, the schools, what you actually saved — is never sent anywhere. The ✨ Rewrite this plan with AI button on a result sends a different set: the score this app calculated for each area, as a number and a band, plus the career those scores pointed at and the skills our own notes list for it. The answers themselves are not in that request, and neither is your name or your school. Pressing it is optional — the plan on the page was written by this app’s own rules, and it stays there if you never press it. When you open the chat from a plan, the four weeks on your screen are put in front of the model so its reply is about the page you are looking at: nothing reaches the provider that is not already on your own result. The practice-interview screen sends the same kind of text: the answer just typed goes with the earlier questions and answers of that sitting, so the model can comment on it and ask the next question — and nothing of that sitting is kept on this app’s side. With no model configured, that screen asks its own five questions, sends nothing to anyone, and gives no feedback and no score, because nobody read the answers.",
  },
  {
    name: "Google Gemini text-to-speech",
    body: "The text of the guide’s reply is sent to be turned into spoken audio. Your voice is never sent — only the reply’s text.",
  },
  {
    name: "Vercel",
    body: "Hosts the web app and the API, and runs the database this build stores data in. This build runs on the non-commercial Vercel Hobby plan.",
  },
  {
    name: "The application database",
    body: "It holds exactly the stored items listed above, and nothing else.",
  },
  {
    name: "Google Analytics 4 (only after consent, and only if configured)",
    body: "On a deployment whose operator has named a GA4 property, and only for a visitor who has accepted analytics, this site sends one page-view hit per public page: the path of that page, its full URL, and the path of the page that linked here. It is configured to send no advertising identifiers, no ad-personalisation signals and no display-features data, and it never loads on a signed-in screen — so nothing a student typed or said can reach it. With no property configured, no request to Google is made by anybody at all.",
  },
  {
    name: "Microsoft Clarity (only after consent, and only if configured)",
    body: "Clarity records how a page is used: clicks, scrolling, and a replay of the page's own elements. Because that replay can include text sitting in an input box on the screen, it is switched off entirely on a student's screens, a parent's screens and the entry screens, and loads on public pages only — for a visitor who has accepted, on a deployment where the operator has named a Clarity project. Rejecting, or changing the answer later, stops the recorder and clears the identifiers it left in this browser.",
  },
  {
    name: "Clerk (only if email sign-in is switched on)",
    body: "On a deployment where the operator switches on the optional email sign-in, the sign-in itself happens on Clerk's servers, and the email address lives there. This app receives one opaque user id from Clerk and no other detail about the account. On a deployment where it is switched off — which is how this prototype currently runs — Clerk is never contacted at all.",
  },
  {
    name: "The email service (only if a key is configured)",
    body: "Mail that leaves this app — a portal invitation, a study-abroad acknowledgement, a notice to whoever runs the site — goes out through one transactional email provider, and that provider receives the address it is delivering to and the words of the message. With no key on the server no message is delivered to anyone, and the screens say the mail was not sent instead of pretending it was. Which provider a given deployment uses, and what that provider's own retention policy says, is the operator's configuration and their answer, not this document's.",
  },];

const NOT_SHARED = [
  "There is no advertising SDK, no third-party tracker and nothing sold. The two measurement services above are loaded by name, only after an accepted answer, only on public pages, and withdrawing that answer stops them and clears what they stored.",
  "A payment provider is integrated in the code and switched off unless the operator puts real keys on the server. When a family does pay, the card is typed only into the provider's own page: this app keeps an order id, a payment id, an amount in paise and a receipt — no card number, no expiry, no CVV, no cardholder name, and none of the provider's payload that carries those. Nothing financial is passed to anyone else, and no institution can pay to change a career suggestion.",
  "We do not sell personal data, and no institution can pay to change a career suggestion — the guide’s recommendations read the career catalogue and the student’s own answers, and they do not look at money. The separate study-abroad directory has a field for a paid listing, and it is only ever printed as a label on that entry: it cannot move a row up a list, and no listing has been sold on this build.",
];

const RIGHTS = [
  {
    right: "Access",
    status: "In the app",
    body: "Everything stored about you is shown in the app itself — your conversations, saved careers, plans and consents.",
  },
  {
    right: "Correction",
    status: "Partly built",
    body: "Your reply language, interface language, class, age, interests and the two background questions are all editable in Settings at any time. The nickname you gave when the account started cannot be changed in the app yet, so today correcting it means asking whoever runs this site through the contact page. Nothing else about you is asked for.",
  },
  {
    right: "Deletion",
    status: "In the app",
    body: "Settings → Delete account erases an account in one step: the conversations and messages, the assessments with their answers and results, the reports and the PDFs printed from them, the study plans and every item in them, saved careers, the resume as it was written, the profile, the settings, every consent given and any mail still queued are removed, and every session on every device signs out. The row that was the account is kept holding nothing but the date it was erased on, because a payment ledger and an operator log have to point at something. An erasure is final — the app keeps no copy to restore from — and an operator account cannot erase itself, which is the one case that goes through whoever runs the site. Clearing conversations and Settings → This device → Start over still work on their own, for someone who wants one without the other.",
  },
  {
    right: "Portability",
    status: "Partly built",
    body: "A finished assessment can be turned into a PDF report and downloaded, so that one file leaves the app with you. There is still no export of everything at once — conversations, saved careers and plans can be read or copied out by hand, but the app cannot yet bundle them into a file.",
  },
  {
    right: "Withdraw consent",
    status: "In the app",
    body: "Consent for profile, voice and history is stored per scope and can be switched off in Settings; the app then gates that feature instead of carrying on regardless.",
  },
];

const SECURITY = [
  "The session that authorises a child's data is a cookie the browser sends and no page script can read. The server keeps only an unreadable digest of it, so a copy of the database is not a list of ways into an account. Ownership is checked on every data request: a request that names another student’s id is answered with 401 — permission is enforced on the backend, not only hidden in the interface.",
  "An email sign-in authorises nothing by itself. Clerk proves which email is being used; this app still only serves a child's answers to its own session token, and that token is issued for the account the email was connected from. A Clerk session alone reaches no data.",
  "Come-back codes are stored as an index plus a salted, iterated hash, not as the code itself.",
  "Model API keys live only in server-side environment variables. They are never placed in frontend code, in browser storage, or in a Git commit.",
  "Logs record that a call failed and what kind of failure it was. They do not record the contents of a child’s conversation, and no code writes raw audio to disk.",
];

const SECURITY_GAPS = [
  "There has been no penetration test, no third-party security audit, and no bug bounty programme.",
  "The database is a shared instance on a hobby-tier plan, not a dedicated, separately audited store.",
  "Anyone sitting at this browser can continue this student’s conversation, because there is no password to stand between them and it.",
  "Hosting on the Vercel Hobby plan is permitted for non-commercial use only; this build is a prototype.",
];

const COOKIE_KEYS = [
  {
    key: "careerguide.device-id",
    body: "The random id that says which student this browser belongs to.",
  },
  {
    key: "careerguide.ui-lang",
    body: "Which language this device’s menus and buttons are in.",
  },
  {
    key: "careerguide.consent",
    body: "The answer given to the storage notice — accepted, rejected, or managed — so the site does not ask again on every visit.",
  },
];

/**
 * The one cookie this site writes, spelled out rather than folded into the list above,
 * because it is a different kind of thing: page code cannot read it, and it is what lets
 * a child back into their own work. The timings are the server's defaults, read from
 * `backend/app/config.py` — a session rolls a day forward while it is in use and stops
 * extending a month after the sign-in that started it.
 */
const SESSION_COOKIE = {
  key: "cg_session",
  body: "The session: which student this browser is signed in as. No script on this page can read it, it travels only to the address that wrote it, and it expires by itself — a day after the last request, and never more than a month after the sign-in that made it.",
};

export default function PrivacyPage() {
  const t = useT();

  return (
    <LegalLayout
      badge={t("Privacy")}
      title={t("Privacy Policy")}
      current="/privacy"
      lastUpdated={t(LAST_UPDATED)}
      sections={SECTIONS}
      intro={
        <>
          {t("This page says what happens to your data, in plain words.")}{" "}
          {t(
            "CareerGuide AI is a career-exploration prototype for Indian students from class 6 to 12, and for their parents. It describes the app that actually exists — not a policy template.",
          )}{" "}
          {t(
            "Where the app does not yet do something a policy usually promises, this page says that instead of promising it.",
          )}
        </>
      }
    >
      <LegalSection id="introduction" title={t("Introduction")}>
        <p>
          {t(
            "The short version: there is no sign-up, the app asks for almost nothing, the microphone is used only while you are actively speaking, and the only outside services that see your words are the ones named below. Anyone sitting at this browser can continue this student’s conversation, so the browser is the account and privacy here depends partly on keeping the device itself private.",
          )}
        </p>
        <p>
          {t(
            "This is one document about one prototype. It is not a legal opinion, and it does not claim to satisfy any law — see the sections on legal basis and on the grievance officer for what is actually missing.",
          )}
        </p>
      </LegalSection>

      <LegalSection id="information-we-collect" title={t("Information we collect")}>
        <p>{t("When you use the app, the server keeps only:")}</p>
        <ul className="list-disc space-y-1.5 pl-5">
          {STORED.map((line) => (
            <li key={line}>{t(line)}</li>
          ))}
        </ul>
        <p className="pt-1">
          {t("And it deliberately does not collect or store:")}
        </p>
        <div className="flex items-start gap-3 rounded-card bg-brand-mist p-5">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-dark" aria-hidden />
          <ul className="list-disc space-y-1.5 pl-5 text-xs leading-relaxed text-brand-dark">
            {NOT_COLLECTED.map((line) => (
              <li key={line}>{t(line)}</li>
            ))}
          </ul>
        </div>
      </LegalSection>

      <LegalSection id="how-we-use-it" title={t("How we use it")}>
        <p>
          {t(
            "Your data is used to run the app you are using, and for nothing else. Concretely:",
          )}
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          {USES.map((line) => (
            <li key={line}>{t(line)}</li>
          ))}
        </ul>
        <p>
          {t(
            "There is no advertising, no profiling for someone else’s benefit, and no sale of this data to anyone.",
          )}
        </p>
      </LegalSection>

      <LegalSection id="legal-basis" title={t("Legal basis")} tone="warn">
        <p>
          {t(
            "A policy of this kind usually names a legal basis for each processing step — consent under Article 6(1)(a) of the GDPR, or the grounds set out in India’s Digital Personal Data Protection Act, 2023. This build mentions those laws only to say what it is trying to respect: consent is asked per scope, it can be withdrawn, and the data collected is the minimum the feature needs.",
          )}
        </p>
        <p>
          {t(
            "Naming them is not a compliance claim. This prototype has had no qualified legal review, no data protection impact assessment, and no documented lawful basis per processing purpose. If this app is ever to hold real children’s data, that review has to happen first, and this section has to be rewritten by someone qualified to write it.",
          )}
        </p>
      </LegalSection>

      <LegalSection id="data-storage" title={t("Data storage")}>
        <p>
          {t(
            "Run locally, the app writes to a SQLite file, careerguide.db, inside the project folder on that machine. The deployed site stores the same records in a Postgres database managed by Vercel. A move to Supabase Postgres has been prepared — the tables exist and are empty — but it has not been switched over, so it is not where your data lives today.",
          )}
        </p>
        <p>
          {t(
            "In every case the database holds exactly the stored items listed above. No audio files are written anywhere, and there is no separate store of conversation transcripts.",
          )}
        </p>
      </LegalSection>

      <LegalSection id="data-sharing" title={t("Data sharing")}>
        <p>
          {t(
            "This app runs on services that see some of what you type. They are listed here because hiding them would be dishonest.",
          )}
        </p>
        <ul className="space-y-2.5">
          {RECEIVERS.map((item) => (
            <li key={item.name}>
              <span className="font-semibold text-ink">{t(item.name)}</span> — {t(item.body)}
            </li>
          ))}
        </ul>
        <p>
          {t(
            "If sending replies to a speech vendor is not acceptable for a child, the app falls back to the browser’s own voice, which sends nothing anywhere.",
          )}
        </p>
        <p className="pt-1">{t("And data is never shared with:")}</p>
        <ul className="list-disc space-y-1.5 pl-5">
          {NOT_SHARED.map((line) => (
            <li key={line}>{t(line)}</li>
          ))}
        </ul>
      </LegalSection>

      <LegalSection id="ai-disclosure" title={t("AI-specific disclosure")}>
        <p>
          {t(
            "The guide’s replies are generated by a language model, openai/gpt-oss-120b, called through Groq’s API. Career information it gives is for exploration and discussion. It is not guaranteed, and it is not a substitute for a qualified career counsellor, a teacher, a doctor, or the official information published by a board or university. The app does not promise placements, admissions, salaries, or job outcomes, and it does not fabricate institution data.",
          )}
        </p>
        <p>
          {t(
            "Your conversation text is sent to the model to answer you in that conversation. It is not used by this app to train a model, and there is no fine-tuning pipeline in this codebase. What the provider itself does with API inputs, and for how long, has not been verified by us — that is the provider’s own policy, and it should be read before this app is used by a real child.",
          )}
        </p>
        <p>
          {t(
            "If a conversation mentions abuse or danger, the app answers with a fixed, safety-focused reply that points to a trusted adult or a local service. That reply is produced by the app itself. It is not sent to the AI provider, and it does not depend on what the model chooses to say.",
          )}
        </p>
      </LegalSection>

      <LegalSection id="retention" title={t("Data retention period")}>
        <p>
          {t(
            "Honest answer: there is no automatic deletion schedule. A conversation, an interest answer, a plan, or a study-abroad enquiry stays in the database until the person who made it is dealt with by hand — the student clearing their own data from Settings, or an operator deleting the enquiry — or until the app’s data itself is deleted by whoever runs it. Nothing expires on a clock.",
          )}
        </p>
        <p>
          {t(
            "That gap is stated here as a known weakness of this build, not written as a policy that exists. A real retention period — with automatic expiry, and with deletion propagated to any backup — is something this app does not have yet.",
          )}
        </p>
      </LegalSection>

      <LegalSection id="your-rights" title={t("Your rights")}>
        <p>
          {t(
            "What you can actually do from inside the app today, stated as it is rather than as an aspiration:",
          )}
        </p>
        <ul className="space-y-2.5">
          {RIGHTS.map((item) => (
            <li key={item.right}>
              <span className="font-semibold text-ink">{t(item.right)}</span>{" "}
              <Badge
                tone={
                  item.status === "Not built"
                    ? "warning"
                    : item.status === "Partly built"
                      ? "neutral"
                      : "success"
                }
                className="ml-1 align-middle"
              >
                {t(item.status)}
              </Badge>
              <p className="mt-1">{t(item.body)}</p>
            </li>
          ))}
        </ul>
        <p>
          {t(
            "Because there is no email or phone on a student’s account, a request to delete or export everything cannot currently be made through a support address tied to your identity — it is made by using the controls above on your own device. A person who sent a study-abroad enquiry did leave an address, and asking for it to be removed is made through the contact page; the operator can delete that row, and there is no button for the sender to do it themselves yet.",
          )}
        </p>
      </LegalSection>

      <LegalSection id="portals" title={t("School and counsellor portals")}>
        <p>
          {t(
            "A school or a counsellor can have a portal of its own on this site. Nothing reaches it before a person says yes: a portal is handed no roster, no report and no conversation until the invited account opens its link and accepts, and the acceptance happens on the screen of the person who accepted it.",
          )}
        </p>
        <p>
          {t(
            "What one membership holds: the portal's name, the role the invitation was written for — student, parent, counsellor or administrator — the date of joining, and the switch that decides whether finished reports are visible. The address an invitation was sent to is kept only while the place is waiting, and is cleared the moment the person joins. Take the place back and the switch goes with it, rather than waiting to be granted again by accident.",
          )}
        </p>
        <p>
          {t(
            "What its staff can see: the members of their own portal, the labels they typed themselves, and aggregate counts of questionnaire progress. What no portal screen can reach: a student's conversations with the guide, their unfinished answers, their drafts, and any other portal's data. Small groups are withheld from the counts, so a number handed to an institution cannot point at one child.",
          )}
        </p>
        <p>
          {t(
            "Finished reports are shared by the student's own switch, which is off by default and takes one click to turn off again. A counsellor can send a note in the other direction: a note stays private until they share it, and only a note they shared appears in the student's own list of notes.",
          )}
        </p>
        <p>
          {t(
            "What this feature does not do: an invitation link is the whole proof of who may take a place. The server does not check that the person opening it is the person the address belongs to, so a letter that reached the wrong inbox, or a link handed on to someone else, can be opened by them — and on a deployment where email is switched off, the link is shown on screen to be passed over by hand. Whoever runs a portal is responsible for how its invitations travel. Whether that is enough for an institution's student data is a question for qualified legal review, and this page does not answer it by asserting.",
          )}
        </p>
      </LegalSection>

      <LegalSection id="study-abroad" title={t("Study-abroad enquiries")}>
        <p>
          {t(
            "The study-abroad pages let a family ask for a first conversation about going abroad to study. That form is the one place in this app where a person types a name and an email address and the site keeps them. What one enquiry row holds: the name and the address typed, a phone number only if it was offered, the stage chosen from a short list, which country or service page sent the form, what was written in the message box, and the fact and the time of the contact tick. Then, kept apart from all of that, the operator’s own status label, note and timestamp.",
          )}
        </p>
        <p>
          {t(
            "Two things make this row different from everything else here. It carries no account: there is deliberately no user id on it, so an enquiry about a paid service cannot be joined to a child’s conversation record, and whoever reads the enquiries queue sees a name, an address and what that person chose to type — not their answers, plans, reports or history. And the tick is stored rather than assumed: a row cannot exist unless “You may contact me at this address about this enquiry” was ticked, and the time of that tick is the only record there is of who agreed to be contacted.",
          )}
        </p>
        <p>
          {t(
            "Where it goes. The enquiry is stored on this app’s own database, and it is announced to two mailboxes and to nobody else: the address set on the server by whoever runs this site, and — where a mail service is configured — a copy back to the sender so they know the form actually arrived. There is no mailing list, no import into a CRM, no advertising audience built from it, and no institution that receives it. An address is never written into a log line: the log records the row’s id. One technical note, because it is the sort of thing a policy tends to skip — this form has no session in front of it, so the guard that limits how many enquiries arrive per hour counts the sender’s own network address. That count lives in the throttle store while the window lasts, and it is not written into the enquiry row or attached to a student.",
          )}
        </p>
        <p>
          {t(
            "How long. The same honest answer as the rest of this page: no clock deletes these rows. An enquiry stays until an operator deletes it from the enquiries screen, which is real and is the only way one leaves today. A person who asked to be removed has no self-service button — that request goes to the contact page and to whoever runs this site, and they can also answer from the row. A retention period for enquiries, and a way for a sender to take their own address back out, are not built.",
          )}
        </p>
        <p>
          {t(
            "The directory itself, because it holds no data about you and still needs saying. A country, university or service page describes places this project has not visited and figures this project has not checked. Every seeded institution is stored as not verified, with its fee, intakes, deadlines and application links left empty rather than filled with a plausible number. A blank on one of those pages means nobody has read that value off the institution’s own website yet — it does not mean a course is free, and it does not mean there is no deadline. Nothing on these pages is an application, an admission, an offer of a place, a visa service or advice about immigration law, and being listed is not a partnership: no institution pays for its place, a paid listing exists in the code only as a label that cannot reorder a list, and none has been sold. Whether keeping a consultation enquiry in this way is lawful for a given country or a given child is a question for qualified legal review, and this page describes what happens instead of claiming permission.",
          )}
        </p>
      </LegalSection>

      <LegalSection id="children" title={t("Children’s privacy")}>
        <p>
          {t(
            "The app is written for students from class 6 to 12, so minors are its main users, and their parents are secondary ones. It asks for no personal identifier: no name, no email, no phone, no school, no location. The only thing it learns about a child is what the child chooses to say in conversation, plus their consent choices. Two things sit outside that rule, and both are described above: a school's or a counsellor's portal, where a child becomes a member only by accepting an invitation themselves, and the study-abroad enquiry form, which does ask for a name and an address.",
          )}
        </p>
        <p>
          {t(
            "That enquiry form is the weaker of the two, and it is stated as a weakness: it asks no age question and has no way to tell whether the person typing is the student or a parent, and its only gate is the tick from whoever did type. A family should treat it as the adult's form — the one a parent or guardian sends about a child's plans — until a real age or guardian check exists here.",
          )}
        </p>
        <p>
          {t(
            "A parent link is opt-in and one-way: the student generates a sharing code, and only the relationship started with that code exists. A parent cannot browse other students’ data, and changing an id in a request does not open another family’s information — the server checks the token, not the id.",
          )}
        </p>
        <p>
          {t(
            "What is not built: there is no mechanism to require or record parental consent separately from the child’s own consent, because the app has no way to verify an adult. Whether that is acceptable for a real deployment of a product used by young children is exactly the question a qualified legal review has to answer, and this page will not answer it by wishing.",
          )}
        </p>
      </LegalSection>

      <LegalSection id="transfers" title={t("International data transfers")}>
        <p>
          {t(
            "They happen. Groq’s inference endpoints and Google’s Gemini speech service are operated outside India, so the text of a conversation and the text of a reply leave the country they were typed in. Vercel’s platform and its database may also serve and store data from outside India.",
          )}
        </p>
        <p>
          {t(
            "There is no documented transfer mechanism, standard contractual clause, or adequacy assessment behind those transfers in this build. If a child in India is to use this app for real, that paperwork is missing and needs to be prepared.",
          )}
        </p>
      </LegalSection>

      <LegalSection id="security" title={t("Security measures")}>
        <p>{t("What is in place today:")}</p>
        <ul className="list-disc space-y-1.5 pl-5">
          {SECURITY.map((line) => (
            <li key={line}>{t(line)}</li>
          ))}
        </ul>
        <p className="pt-1">
          {t(
            "No system holding data is ever fully safe, and it would be dishonest to imply otherwise here. What is not in place:",
          )}
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          {SECURITY_GAPS.map((line) => (
            <li key={line}>{t(line)}</li>
          ))}
        </ul>
      </LegalSection>

      <LegalSection id="cookies" title={t("Cookies")}>
        <p>
          {t(
            "The code that belongs to this application drops no advertising pixel and carries no cross-site tracker. It writes one cookie, the session one described below, and nothing else. Anything else that appears in this browser comes from one of two places: the storage values listed here, and — on a deployment where analytics has been switched on and then accepted — the two measurement services named under the services that see data.",
          )}
        </p>
        <p>
          {t("This site writes one cookie:") + " "}
          <span className="font-mono text-xs text-ink">{SESSION_COOKIE.key}</span> —{" "}
          {t(SESSION_COOKIE.body)}
        </p>
        <p>
          {t(
            "Some browsers refuse a cookie set by a request to a different site, and this site's page and its API are two hosts. Safari, and Firefox with strict tracking protection, are the two that do. On those browsers the session is kept in the open tab's memory instead and is gone when the tab closes — the app then recognises the device again on the next visit, and no work is lost.",
          )}
        </p>
        <p>
          {t(
            "Besides that cookie, it stores three small values in this browser’s own localStorage, which behave like the app’s memory of who you are on this device:",
          )}
        </p>
        <ul className="space-y-2">
          {COOKIE_KEYS.map((item) => (
            <li key={item.key}>
              <span className="font-mono text-xs text-ink">{item.key}</span> — {t(item.body)}
            </li>
          ))}
        </ul>
        <p>
          {t(
            "Clearing this site’s data in the browser removes the three values above. The session cookie lives against the address that wrote it, which on this deployment is the API’s own host, so clearing it can take one extra step there — and either way the result is the same: the app can no longer find this student’s progress, which is the trade-off the introduction describes.",
          )}
        </p>
        <p>
          {t(
            "On a deployment whose operator has named a measurement project, a visitor who accepts analytics also lets two services set cookies of their own on the public pages: Google Analytics and Microsoft Clarity, described under the services that see data. Rejecting — or changing the answer afterwards — stops both and clears their identifiers (_ga, _gid, _ga_<property>, _clck, _clsk) from this browser. On a student's screens, a parent's screens and the entry screens neither service ever loads, whatever answer was given.",
          )}
        </p>
        <p>
          {t(
            "With no project named, which is how this prototype runs, this site sets no cookie other than its own session cookie and contacts no measurement service at all.",
          )}
        </p>
      </LegalSection>

      <LegalSection id="grievance-officer" title={t("Grievance officer")}>
        <p>
          {t(
            "A policy for users in India names a grievance officer who can be reached and who answers within a stated period. Those details live in one file in this project's code, and every legal page reads them from there, so a deployment changes them once instead of hunting through four documents.",
          )}
        </p>
        <IdentityCard fields="officer" />
      </LegalSection>

      <LegalSection id="changes" title={t("Changes to this policy")}>
        <p>
          {t(
            "This page is updated by editing it and putting the new version online, with the date at the top changed. There is no notification system — no in-app banner, no email list, because there is no email on file. A student who wants to know whether this page changed has to read the date at the top.",
          )}
        </p>
        <p>
          {t(
            "The text of the policy itself is stored with the code, so the version you are reading matches the version of the app you are using. Its history is public in the Git repository this project is kept in.",
          )}
        </p>
      </LegalSection>

      <LegalSection id="contact" title={t("Contact us")}>
        <p>
          {t(
            "The grievance inbox and postal address above are the contact routes for anything about data. There is no separate support desk behind them, and a bug you can describe is usually faster reported where others can see it:",
          )}
        </p>
        <p>
          <a
            className="font-medium text-brand underline-offset-2 hover:underline"
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
          >
            {REPO_URL}
          </a>
        </p>
        <p>
          {t(
            "If a student is in danger right now, this app is not the right place to ask for help. In India, Childline is reachable at 1098, and the app itself points a disclosure toward a trusted adult or a local service rather than waiting for anyone to read it.",
          )}
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
