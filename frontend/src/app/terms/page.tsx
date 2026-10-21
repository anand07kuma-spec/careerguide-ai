"use client";

import { LegalLayout, LegalSection, REPO_URL, type SectionRef } from "@/components/legal/legal-layout";
import { SampleNote } from "@/components/legal/identity-card";
import { CITY } from "@/lib/legal-entity";
import { useT } from "@/lib/i18n";

/**
 * Terms of use — for a prototype with no password, no advertising and no promises
 * it cannot keep. Every clause describes the software that was actually built:
 * where a normal term sheet would promise an indemnity, a notice period or a
 * governing city, this page says what is missing instead. The payments clause
 * describes a checkout that exists and has never taken money, and names the refund
 * action that is not in the build.
 */

const SECTIONS: SectionRef[] = [
  { id: "acceptance", title: "Accepting these terms" },
  { id: "service", title: "What this service is" },
  { id: "eligibility", title: "Who may use it" },
  { id: "accounts", title: "Accounts: this browser is the account" },
  { id: "acceptable-use", title: "Acceptable use" },
  { id: "ai-disclaimer", title: "The guide, and what it never does" },
  { id: "catalogue", title: "The catalogue is sample data" },
  { id: "ip", title: "Intellectual property" },
  { id: "payments", title: "Payments, and refunds" },
  { id: "portals", title: "School and counsellor portals" },
  { id: "study-abroad", title: "The study-abroad directory and its enquiry form" },
  { id: "termination", title: "Ending it" },
  { id: "liability", title: "Liability" },
  { id: "indemnity", title: "Indemnification — what is not promised here" },
  { id: "third-party", title: "Third-party services" },
  { id: "governing-law", title: "Governing law" },
  { id: "disputes", title: "Disputes" },
  { id: "changes", title: "Changes to these terms" },
  { id: "contact", title: "Contact" },
];

const GUIDE_RULES = [
  "Suggestions are starting points built from what the student said, and the evidence behind them is shown so you can disagree.",
  "It is not an aptitude test, an IQ test, or a prediction of the future.",
  "It will never tell a child a career is impossible because of marks, income, gender, region or disability.",
  "It does not diagnose anything, and nothing about ability is inferred from a child’s voice, accent or speaking speed.",
];

const DO_NOT = [
  "Do not use a shared or public computer and leave the tab open — the next person inherits this student's conversation. Use Settings → This device → Start over when you are done.",
  "Do not try to read another student's data. Requests are checked against a session token on the server, so this does not work; attempting it against a deployed service is also unlawful.",
  "Do not paste another child's conversation, nickname or device id into the guide, into a report, or into a public issue.",
  "Do not use the guide to impersonate a person, an institution or a board.",
  "Do not treat it as a crisis line, a counsellor, a doctor or a legal adviser. It is none of those.",
  "Do not rely on any fee, deadline, seat or salary figure in the catalogue without checking the official source for it.",
];

export default function TermsPage() {
  const t = useT();

  return (
    <LegalLayout
      badge={t("Terms")}
      title={t("Terms of Use")}
      current="/terms"
      lastUpdated={t(LAST_UPDATED)}
      sections={SECTIONS}
      intro={t(
        "These are the terms for using CareerGuide AI. They are short because the app is a prototype with no password, no advertising and no promises it cannot keep. Where a normal clause would describe something this build does not have, the page says so instead of borrowing the wording for it.",
      )}
    >
      <LegalSection id="acceptance" title={t("Accepting these terms")}>
        <p>
          {t(
            "Using the site is the acceptance. There is no checkbox, no signature and no contract stored about you, because there is nothing to attach one to — the app identifies a browser, not a person.",
          )}
        </p>
        <p>
          {t(
            "If these terms do not work for you, close the tab. Nothing else has to be undone: the site keeps no email, phone or password that would have to be cancelled, and clearing its data removes the four values it stored in this browser. What clearing does not touch is what the server gathered about the student during the conversation — that is what Settings → Delete account erases, and it is the one step that removes those rows rather than only throwing away the key to them.",
          )}
        </p>
        <p>
          {t(
            "This document has not had qualified legal review. It states how the software behaves; it does not pretend to be advice about what any law requires.",
          )}
        </p>
      </LegalSection>

      <LegalSection id="service" title={t("What this service is")}>
        <p>
          {t(
            "CareerGuide AI helps a student explore careers through conversation, in Hindi, English or Hinglish. It is a support for a conversation at home — not a replacement for a qualified career counsellor, a teacher, or a doctor.",
          )}
        </p>
        <p>
          {t(
            "The screens that exist today are the conversation, voice calls, careers, the class 10 stream choice, exams, interests, study plans, reports, a parent view reached by a sharing code, and settings. Any of them can change or disappear without notice, because this is a prototype and not a contracted service.",
          )}
        </p>
      </LegalSection>

      <LegalSection id="eligibility" title={t("Who may use it")}>
        <p>
          {t(
            "It is written for Indian students from class 6 to 12 and for their parents or guardians. There is no age gate, no identity check and no way for the app to know who is typing.",
          )}
        </p>
        <p>
          {t(
            "The first screen asks a grown-up to confirm consent for a user under 18. That confirmation is honest intent, not identity proof — the app has no way to verify who is typing, and it deliberately asks for nothing that could identify anyone.",
          )}
        </p>
      </LegalSection>

      <LegalSection id="accounts" title={t("Accounts: this browser is the account")}>
        <p>
          {t(
            "There is no account to log into. Progress is tied to a random device id kept by this browser. Clearing this site’s data, a private window, or another device starts a new student, and the old progress cannot be recovered. Do not use a shared or public computer, and use Settings → This device → Start over when you are done.",
          )}
        </p>
        <p>
          {t(
            "The optional email sign-in does not change any of that. It connects an email to the account this browser already holds, so the same work can also be opened by signing in; while it is switched off — which is how this prototype runs — there is nothing to log into at all.",
          )}
        </p>
        <p>
          {t(
            "Because there is no password, there is nothing to reset, nothing to steal, and no support ticket that can restore a lost student. That is the trade this design makes, stated on the privacy page too.",
          )}
        </p>
      </LegalSection>

      <LegalSection id="acceptable-use" title={t("Acceptable use")}>
        <p>
          {t(
            "Use it to explore careers. The rest of this list is what the design cannot protect against, or what it actively blocks:",
          )}
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          {DO_NOT.map((line) => (
            <li key={line}>{t(line)}</li>
          ))}
        </ul>
      </LegalSection>

      <LegalSection id="ai-disclaimer" title={t("The guide, and what it never does")}>
        <ul className="list-disc space-y-1.5 pl-5">
          {GUIDE_RULES.map((line) => (
            <li key={line}>{t(line)}</li>
          ))}
        </ul>
        <p>
          {t(
            "Replies come from a language model called through an API. It can be confident and wrong in the same sentence. Nothing it says has been checked by a human before it reaches you.",
          )}
        </p>
        <p>
          {t(
            "If a conversation mentions danger, the app answers with a fixed safety message pointing to a trusted adult or a local service. The app itself is not an emergency service, and nobody watches it in real time. In an emergency, contact real services directly.",
          )}
        </p>
      </LegalSection>

      <LegalSection id="catalogue" title={t("The catalogue is sample data")}>
        <p>
          {t(
            "Careers, learning resources, scholarships and institutions are sample data for exploration. Fees, deadlines, placements and scheme rules change every year — verify them on official websites before relying on anything here. No guaranteed outcome of any kind is offered: not admission, not a job, not a salary.",
          )}
        </p>
        <p>
          {t(
            "Sponsored institution entries are badged where they exist, and no payment changes a career suggestion — there is no ranking code for money to influence.",
          )}
        </p>
      </LegalSection>

      <LegalSection id="ip" title={t("Intellectual property")}>
        <p>
          {t(
            "The code is published in a public repository so anyone can read what the app really does. A public repository is not a licence: no permission to reuse, rebrand or redistribute any of it is granted here, and none is implied.",
          )}
        </p>
        <p>
          {t(
            "What a student types and the replies they receive stay theirs to use however they like. This app claims no ownership over a conversation, and it does not train a model on it.",
          )}
        </p>
        <p>
          {t(
            "Names of exams, boards and institutions belong to the bodies that run them. They appear here to describe those exams, not to suggest any endorsement.",
          )}
        </p>
      </LegalSection>

      <LegalSection id="payments" title={t("Payments, and refunds")}>
        <p>
          {t(
            "A paid tier exists as software now. The plans, the order, the signature check, the webhook and the billing screen are built and covered by a suite that stands in for the payment provider; none of it is a mock-up. It is switched off until the operator sets real keys on the server, and with none set the pricing page disables its own Upgrade buttons and says why. No payment has been taken on this deployment, so no refund has been owed by it.",
          )}
        </p>
        <p>
          {t(
            "Two things a usual paid product has are deliberately absent. There is no auto-renewal: one payment buys one fixed period, nothing charges again by itself, so there is no subscription to cancel and no mandate held on a card. And there is no refund action inside the app — no refund button, no refund call, no invoice to reverse. A refund would be issued from the payment provider's own dashboard by whoever holds that account, and this page states that instead of describing a control that does not exist.",
          )}
        </p>
        <p>
          {t(
            "What money cannot buy here is the point of the whole product: the order of a career suggestion, a stream recommendation or an exam list. There is no ranking code for a payment to influence, the entire career catalogue sits on the free plan, and a sponsored listing — if one ever appears — will be badged where it shows.",
          )}
        </p>
        <p>
          {t("The refund policy states what is owed, and how it is asked for:")}{" "}
          <a className="text-brand underline-offset-2 hover:underline" href="/refund">
            {t("Refund policy")}
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection id="portals" title={t("School and counsellor portals")}>
        <p>
          {t(
            "A portal is opened by an adult account, never by a child's. A school's portal is opened by whoever runs this site, because an institution's credibility is not something one request can declare, and a counsellor's practice is opened by the adult whose account will run it. A student's account cannot be handed a staff role, and a link mailed to a child cannot make them their own school's administrator.",
          )}
        </p>
        <p>
          {t(
            "The limits on a staff role are the point of it. Nobody at a school or a practice may press a student into turning on their sharing switch, may take an invitation link out of their hands, or may read what the portal was never given. A place ends from either side — staff take it back, or the member leaves — and in both cases what that person wrote, asked and earned stays in their own account.",
          )}
        </p>
        <p>
          {t(
            "Tiers are counted, not bought. A portal's seat limit comes from this platform's own list, no card is charged from inside a portal screen, and a bigger tier is arranged with a person. No plan, paid or granted, changes what a student is told about their own career.",
          )}
        </p>
      </LegalSection>

      <LegalSection id="study-abroad" title={t("The study-abroad directory and its enquiry form")}>
        <p>
          {t(
            "The study-abroad pages are a directory and a way to ask a question. They are not an application service. This app does not apply to a university on anyone’s behalf, does not hold a student’s documents, does not issue or advise on an offer of a place, and is not a registered immigration or visa adviser. Nothing written on those pages is advice about immigration law, and a country page is a description, not an eligibility rule.",
          )}
        </p>
        <p>
          {t(
            "Sending the enquiry form asks for a conversation. It creates one row on this site, holding what the sender typed and the time they agreed to be contacted. It is not a contract, an acceptance, a booking or an offer of service, and nothing is owed to the sender because it was sent; what comes back is whatever whoever runs this site chooses to say. The operator can mark that row contacted or closed, and can delete it. The sender has no button of their own for either yet, and asks through the contact page.",
          )}
        </p>
        <p>
          {t(
            "The facts on those pages are the weakest part of them, and this clause says so plainly. Every institution here was stored as not verified: its fee, its intakes, its deadlines and its application links are blank until somebody reads them off that institution’s own website, and an entry can later be filled in with its source and the date it was true. A blank is not a zero and not a no — it means nobody has checked. Where a number is shown, it was true of one page on one date, not of the year you are planning for. Every fee, deadline, requirement and visa rule has to be confirmed with the institution and the official bodies themselves before a family spends anything on it.",
          )}
        </p>
        <p>
          {t(
            "No institution pays for its place in this directory, and none has been paid. A listing is not a partnership, an endorsement or an agent agreement, and a link out to an institution is only a link out. The entry does carry one field for a paid listing; it exists so that a listing which ever becomes paid has to say so on the page, and it cannot move a row up a list. Where the guide suggests a career or a stream, it does not read this directory at all.",
          )}
        </p>
      </LegalSection>

      <LegalSection id="termination" title={t("Ending it")}>
        <p>
          {t(
            "You can end your use at any moment by closing the tab. Ending the data is a different act, and the app now has one: Settings → Delete account erases what the server holds and signs out every device, and it cannot be undone afterwards. Clearing this site’s data or using Settings → This device → Start over only stops this browser from reaching those rows — they stay until they are erased. No notice is needed and none is asked for.",
          )}
        </p>
        <p>
          {t(
            "On this side: the site can be taken down, changed or switched off without notice. It runs on a non-commercial hosting plan as a personal prototype, so there is no service level, no uptime promise and no obligation to keep it online. Losing it loses every student's history in it, which is why the app is not a place to store anything you cannot afford to lose.",
          )}
        </p>
      </LegalSection>

      <LegalSection id="liability" title={t("Liability")}>
        <p>
          {t(
            "This prototype is provided as it is, without warranties of any kind. It may be wrong, it may change without notice, and it may break — the code and the deployed site can move at any time. This build has not had qualified legal review, and moving a real child’s data onto it needs one first.",
          )}
        </p>
        <p>
          {t(
            "To the maximum extent the law allows, the people behind this prototype are not liable for loss or damage arising from its use — including a career, subject, exam or institution decision made on the strength of anything shown here. A decision that shapes a student's future should be taken with a human professional and the official sources, not with a prototype alone.",
          )}
        </p>
        <p>
          {t(
            "Nothing in this section excludes liability that cannot lawfully be excluded, including for death, personal injury, or fraud caused by the people running the service.",
          )}
        </p>
      </LegalSection>

      <LegalSection id="indemnity" title={t("Indemnification — what is not promised here")} tone="warn">
        <p>
          {t(
            "A standard terms page asks the user to cover the provider's legal costs if the provider gets sued because of that user. This page does not impose that on a student's family, and it would be wrong to print the clause as though it had been agreed with anyone.",
          )}
        </p>
        <p>
          {t(
            "What is asked instead is on the acceptable-use list: do not put another child's private conversation into this app or into its public issue tracker. Whether any indemnity is appropriate at all is a question for the legal review this build has not had.",
          )}
        </p>
      </LegalSection>

      <LegalSection id="third-party" title={t("Third-party services")}>
        <p>
          {t(
            "The app depends on services this project does not control: Groq for the model, Google Gemini for spoken replies, the browser's own speech recognition, and Vercel for hosting and the database. Each has its own terms and its own privacy policy, and using this app means your text passes through them.",
          )}
        </p>
        <p>
          {t(
            "Their terms are not incorporated into these terms by a link nobody clicks. They are listed on the privacy page, with what each one receives, and their data-retention behaviour has not been verified by this project.",
          )}
        </p>
      </LegalSection>

      <LegalSection id="governing-law" title={t("Governing law")}>
        <p>
          {t(
            "These terms are written for use in India, and Indian law is the law this project assumes applies to them. That is a statement of intent, not a determination — no lawyer has reviewed it.",
          )}
        </p>
        <p>
          {t("The usual next line names the courts of a city. Those are the")}&nbsp;
          <span className="font-mono text-xs text-ink">{CITY}</span>&nbsp;
          {t("courts, because that is where whoever operates this deployment works from.")}
        </p>
        <SampleNote />
      </LegalSection>

      <LegalSection id="disputes" title={t("Disputes")}>
        <p>
          {t(
            "There is no arbitration clause and no forum-selection clause, so the sentence above is the whole of it. If something here goes wrong for you, the contact form and the public issue tracker are the two routes, and the issue tracker is at least visible to others.",
          )}
        </p>
        <p>
          {t(
            "A deployment that holds a real child's data needs that path working rather than merely named: an inbox somebody reads, an officer whose name is filled in, and a lawyer who has read this page. The note printed beside the contact details on these pages says which of those this build has.",
          )}
        </p>
      </LegalSection>

      <LegalSection id="changes" title={t("Changes to these terms")}>
        <p>
          {t(
            "These terms change by being edited and republished, with the date at the top moved forward. There is no email to notify, no in-app banner and no version history shown to you — continuing to use the app after a change is the acceptance of it.",
          )}
        </p>
        <p>
          {t(
            "The page you are reading is stored with the code, so the terms you see match the build you are using, and every past version is public in the repository.",
          )}
        </p>
      </LegalSection>

      <LegalSection id="contact" title={t("Contact")}>
        <p>
          {t(
            "The contact page has a form, and the repository has an issue tracker. Neither is a support desk, and no reply time is promised.",
          )}
        </p>
        <p>
          <a className="text-brand underline-offset-2 hover:underline" href="/contact">
            {t("Go to the contact page")}
          </a>{" "}
          ·{" "}
          <a className="text-brand underline-offset-2 hover:underline" href={REPO_URL} target="_blank" rel="noreferrer">
            {t("Open the GitHub repository")}
          </a>
        </p>
      </LegalSection>
    </LegalLayout>
  );
}

const LAST_UPDATED = "20 October 2026";
