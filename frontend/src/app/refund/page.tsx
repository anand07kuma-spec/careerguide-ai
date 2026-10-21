"use client";

import { Badge } from "@/components/ui/badge";
import { LegalLayout, LegalSection, REPO_URL, type SectionRef } from "@/components/legal/legal-layout";
import { useT } from "@/lib/i18n";

/**
 * Refund policy for a product whose checkout has been built and has never taken money.
 *
 * This page used to say there was nothing to refund because there was nothing to
 * sell. That stopped being true when the plans, the order, the signature check, the
 * webhook and the billing screen were built and tested. What is still true is the
 * harder half: no payment has been captured on this deployment, plan limits are not
 * being enforced, and there is no refund action anywhere in the app — a refund today
 * would be issued from the provider's own dashboard by whoever holds that account.
 *
 * So the document keeps both halves it always kept. The rules below are the ones the
 * build commits to, written before the first rupee moved, and every place where the
 * software has not caught up with the promise is labelled as a gap rather than
 * described as a feature.
 */

const SECTIONS: SectionRef[] = [
  { id: "overview", title: "What is true right now" },
  { id: "free", title: "What is free, and on every plan" },
  { id: "paid", title: "Paid services" },
  { id: "eligibility", title: "When a refund is due" },
  { id: "non-refundable", title: "What is not refundable" },
  { id: "process", title: "How to ask" },
  { id: "timing", title: "Processing time" },
  { id: "mode", title: "How the money comes back" },
  { id: "cancellation", title: "Renewing, ending a period, and cancelling" },
  { id: "chargebacks", title: "Disputed payments" },
  { id: "contact", title: "Contact" },
];

const DUE = [
  "A paid feature was charged for and never became available in this build.",
  "A payment was taken twice for the same purchase, or taken and then reversed by the provider without the service being stopped.",
  "A purchase was made by a child without the knowledge of the grown-up who pays the bills, and it is raised within fourteen days of the charge.",
  "The service was switched off from this side while a paid period was still running.",
];

const NOT_DUE = [
  "A career suggestion, a stream choice or an exam list that turned out to be wrong, unhelpful or disagreeable. The advice is a starting point, it is labelled as machine-generated, and no outcome is guaranteed anywhere in this app — so a refund is not the remedy for a bad answer.",
  "A decision made on the strength of the app that led to a cost: a dropped subject, a missed deadline, an application fee. The disclaimer and the terms both say this tool is not the basis for a decision of that weight.",
  "Losing access because the browser’s data was cleared, the tab was opened in private mode, or a different device or browser was used. There is no account to recover a student from, and that limitation is stated on the first screen and in the terms.",
  "A subscription period that was simply not used, once the paid feature was actually available during it.",
  "A change of mind after a download, an exported report or any other digital good was delivered.",
];

export default function RefundPage() {
  const t = useT();

  return (
    <LegalLayout
      badge={t("Refund policy")}
      title={t("Refund Policy")}
      current="/refund"
      lastUpdated={t(LAST_UPDATED)}
      sections={SECTIONS}
      intro={t(
        "A checkout is built into this app, and no payment has ever been taken by it. This page says which rules are live, which are promises written in advance, and where the software has not caught up with the promise.",
      )}
    >
      <LegalSection id="overview" title={t("What is true right now")}>
        <p>
          {t(
            "The plans, the Razorpay order, the signature check on the callback, the webhook and the billing screen exist in the code, and a test suite runs them against a stand-in provider. Prices are quoted in paise, an order cannot be priced by the browser, and a plan is unlocked only when the server can prove the payment is the one it asked for.",
          )}
        </p>
        <p>
          {t(
            "None of that is switched on for this deployment until the person running it puts real keys on the server. With no keys, the pricing page reads that answer from the server and disables its own Upgrade buttons rather than opening a checkout that cannot work, and no plan limit is being enforced, so every screen still behaves as a free one.",
          )}
        </p>
        <p>
          {t(
            "Which means: nothing has been charged here, and no refund has been paid here. The rules below are what will apply from the first capture, and they are published now rather than after a family has a complaint.",
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="warning">{t("Built, and not switched on")}</Badge>
          <span className="text-xs text-muted">
            {t("No payment has been taken on this deployment, and there is no refund button in the app.")}
          </span>
        </div>
      </LegalSection>

      <LegalSection id="free" title={t("What is free, and on every plan")}>
        <p>
          {t(
            "Everything about careers is free and stays free on every plan: the conversations and voice calls that are within a plan's allowance, the careers, streams, exams, resources, scholarships and institutes, the interest and aptitude work, a student's own journey and reports, and the right to see, export and delete what this app holds.",
          )}
        </p>
        <p>
          {t(
            "Because those cost nothing, there is no refund question about them. What a paid plan adds is conversation volume, repeatable questionnaires, a printable PDF report and the parent dashboard — and if a paid period ever has to be refunded, the free part of the app is not taken away with it.",
          )}
        </p>
        <p>
          {t(
            "A report a family already generated, or an answer a student already received, is never repossessed over money. A dispute about an invoice cannot be a reason to withhold a child's history, because nothing a student already made is inside a paywall.",
          )}
        </p>
      </LegalSection>

      <LegalSection id="paid" title={t("Paid services")} tone="warn">
        <p>
          {t(
            "The provider is named, because this section is no longer hypothetical: Razorpay. An order is created by this server and priced from the same numbers the plan limits are enforced from, and it is paid inside Razorpay's own page. A card number, an expiry, a CVV and a cardholder name have never existed in this application — the database holds an order id, a payment id, an amount in paise, a receipt and the attestation that went with it.",
          )}
        </p>
        <p>
          {t(
            "Two conditions come before any refund rule matters, and both are in the build now. A purchase is made by an adult who ticks, at the moment the order is created, that they are 18 or older and are paying for this knowingly — an order is refused without that answer. And the price, what it buys and how long it lasts are on screen before the charge, not in an email afterwards.",
          )}
        </p>
        <p>
          {t(
            "Institutions are the intended large paid party, never a family buying a better career answer. A paid tier adds conversation volume, repeatable questionnaires, a printable report and a guardian's view. It does not change the order of a career suggestion for a student — there is no ranking code for money to influence, and the test suite checks that a recommendation comes out identical before a payment and after one.",
          )}
        </p>
        <p>
          {t(
            "What is not built, and is therefore not a promise: there is no refund request inside this app. No button, no route, no call to the provider's refund API. Until one exists, a refund that is owed would be issued by hand from the payment provider's dashboard by whoever holds that account, using the receipt this app prints and a message through the contact page. That is a person doing it slowly rather than a product feature, and this page says so instead of describing a control that is not there.",
          )}
        </p>
      </LegalSection>

      <LegalSection id="eligibility" title={t("When a refund is due")}>
        <p>{t("A refund is owed in these cases, written against what the app actually records:")}</p>
        <ul className="list-disc space-y-1.5 pl-5">
          {DUE.map((line) => (
            <li key={line}>{t(line)}</li>
          ))}
        </ul>
        <p>
          {t(
            "The child-purchase clause exists because this app is used by minors on devices their parents pay for. Fourteen days is the window the project commits to; a regulator could set a different one, and the legal review this build has not had would be the point at which that gets checked.",
          )}
        </p>
      </LegalSection>

      <LegalSection id="non-refundable" title={t("What is not refundable")}>
        <p>{t("A refund is not the remedy for these, and pretending otherwise would set up a promise the app cannot keep:")}</p>
        <ul className="list-disc space-y-1.5 pl-5">
          {NOT_DUE.map((line) => (
            <li key={line}>{t(line)}</li>
          ))}
        </ul>
      </LegalSection>

      <LegalSection id="process" title={t("How to ask")}>
        <p>
          {t(
            "The route is the contact form, carrying the receipt this app prints on its billing page and the payment reference if the provider gave one. Today there has been no payment to ask about, so nobody has used it: the form exists, the queue does not.",
          )}
        </p>
        <p>
          {t(
            "What will not be required: an explanation of why the product was not good enough, a phone call, a postal address, or the upload of a document. A claim is tied to a payment reference rather than to a login, because there is no account in this app to tie it to — and the same receipt identifies the order to both sides.",
          )}
        </p>
      </LegalSection>

      <LegalSection id="timing" title={t("Processing time")}>
        <p>
          {t(
            "The commitment is an answer within five working days of a request, and the money moved within ten working days of an approved one. A card refund then takes another two to five working days depending on the issuing bank, which is the processor’s time and not this app’s.",
          )}
        </p>
        <p>
          {t(
            "No queue, no ticketing system and no service-level agreement exists today, and on a build that has taken no payment these times have never been measured against a real case. They are published as the standard to be held to, not reported as a track record.",
          )}
        </p>
      </LegalSection>

      <LegalSection id="mode" title={t("How the money comes back")}>
        <p>
          {t(
            "Back the way it came. A refund is issued to the original payment method through the same processor that took the payment, so the receipt and the refund carry the same reference and the bank sees the same pair.",
          )}
        </p>
        <p>
          {t(
            "There will be no wallet credit, no voucher, and no “store credit instead of cash” default. Where the original method genuinely cannot receive a refund, the app will say so in writing and agree a different route with the person who paid rather than quietly substituting a credit.",
          )}
        </p>
      </LegalSection>

      <LegalSection id="cancellation" title={t("Renewing, ending a period, and cancelling")}>
        <p>
          {t(
            "There is no subscription to cancel, and that is a decision rather than an unfinished feature: one payment buys one period with an end date, nothing charges again by itself, and no card mandate is held. The billing screen therefore offers to renew, and offers to switch to the free plan after naming what that gives up, and never offers to cancel something that was never going to repeat.",
          )}
        </p>
        <p>
          {t(
            "Real auto-renewal would need the provider's subscription object, a live account and a mandate flow. None of that exists in this build, and none of it could have been tested without taking somebody's money — which is the reason this app does not claim a cancellation flow it cannot run.",
          )}
        </p>
        <p>
          {t(
            "Switching to the free plan early ends a period that was already paid for, and the confirmation on that button says so in days rather than hiding it. Whether part of an unused period is then refundable is decided by the rules above, not by the button: it gives up the features, and the money question stays with the receipt.",
          )}
        </p>
        <p>
          {t(
            "Closing a free account is a different thing and stays available regardless. Settings → Delete account erases what the server holds, and it works whether or not anything is ever sold; the one record that outlives it is the payment or refund ledger entry, which a money ledger has to keep even after the person it is about asks to be forgotten — that is why a receipt can still be matched to an order after the account that paid is gone. Settings → This device → Start over is the lighter step: it stops this browser from reaching that account and leaves the rows where they are.",
          )}
        </p>
      </LegalSection>

      <LegalSection id="chargebacks" title={t("Disputed payments")} tone="warn">
        <p>
          {t(
            "A dispute raised with a bank is called a chargeback, and it is not something this app can process, block or judge. If a payment is disputed, the processor will contact this project the way it contacts any merchant, and the project will answer with what the service actually delivered rather than contesting a family’s claim by default.",
          )}
        </p>
        <p>
          {t(
            "A dispute does not replace the refund route above, and the app will not close off the contact form because a bank was contacted first. It also does not decide anything about a child’s data: an unpaid or disputed invoice will never be a reason to withhold or delete a student’s history. Nothing a student has already made sits behind a paywall, and the parts of the app that a paid plan adds are additions to a free path, not the path itself.",
          )}
        </p>
      </LegalSection>

      <LegalSection id="contact" title={t("Contact")}>
        <p>
          {t(
            "Whether a paid plan can actually be bought here is answered on the pricing page itself, from the server, rather than by this document. A refund question goes to the contact form with the receipt printed on the billing page. A statement on a card is answered by the payment provider first, because they hold the transaction, not this app.",
          )}
        </p>
        <p>
          {t(
            "A refund question reaches whoever operates this deployment through the contact page; there is no separate refunds desk, and this page is not going to print an address the contact page has not already published.",
          )}
        </p>
        <p>
          <a className="text-brand underline-offset-2 hover:underline" href="/contact">
            {t("Go to the contact page")}
          </a>{" "}
          ·{" "}
          <a
            className="text-brand underline-offset-2 hover:underline"
            href="/privacy#grievance-officer"
          >
            {t("Privacy: grievance officer")}
          </a>{" "}
          ·{" "}
          <a
            className="text-brand underline-offset-2 hover:underline"
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
          >
            {t("Open the GitHub repository")}
          </a>
        </p>
      </LegalSection>
    </LegalLayout>
  );
}

const LAST_UPDATED = "18 October 2026";
