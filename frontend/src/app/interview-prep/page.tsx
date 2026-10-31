"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, MessagesSquare, RotateCcw, Send, Sparkles } from "lucide-react";
import { Screen } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { api } from "@/lib/api";
import { useT, useTf, useUiLang } from "@/lib/i18n";
import type { InterviewLine, InterviewTurn } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * One question, the note the interviewer made about the answer before it, and the answer
 * the student gave.
 *
 * The whole interview lives in this array, in this tab, for as long as the tab is open.
 * That is the design rather than a shortcut: a practice interview is five unguarded
 * sentences about yourself, and a server holding them would need a place to keep them, a
 * way to delete them, and a sentence in `/privacy` about both.
 */
interface Exchange {
  question: string;
  /** Said about the answer above this question; null on the first one. */
  feedback: string | null;
  answer: string | null;
  /** Whether this turn came from this app's own list rather than from a model. */
  scripted: boolean;
}

/** The brief asks for a limit of five questions. The server counts the answers itself and
 *  refuses a sixth whatever this constant says, so a mismatch here could only make the label
 *  wrong, never the interview longer. */
const TOTAL_QUESTIONS = 5;

const ROLE_OPTIONS = [
  "Doctor",
  "Engineer",
  "Designer",
  "Teacher",
  "Nurse",
  "Lawyer",
  "Pilot",
  "Chef",
  "Content creator",
  "Data analyst",
];

const OTHER = "__something_else";

/** Three lines the student reads before pressing the button, not after. */
const PROMISES = [
  "Five questions, then a summary. You can stop any time by closing the tab.",
  "Nothing you say here is saved on our servers, or shown to a teacher or an employer.",
  "This is practice, not a test. No one is marking you.",
];

function linesFor(exchanges: Exchange[]): InterviewLine[] {
  return exchanges.flatMap((entry) => [
    { role: "interviewer" as const, text: entry.question },
    ...(entry.answer ? [{ role: "candidate" as const, text: entry.answer }] : []),
  ]);
}

/** A sentence this app wrote in its own words can be looked up in the dictionary; a
 *  sentence a model invented cannot, and pretending otherwise would print a key. */
type Say = (text: string | null, scripted: boolean) => string | null;

export default function InterviewPrepPage() {
  const t = useT();
  const tf = useTf();
  const uiLang = useUiLang();

  const [chosen, setChosen] = useState("");
  const [typed, setTyped] = useState("");
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [outcome, setOutcome] = useState<InterviewTurn | null>(null);
  const [support, setSupport] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listRef, setListRef] = useState<HTMLDivElement | null>(null);

  const job = (chosen === OTHER ? typed : chosen).trim();
  const running = exchanges.length > 0 && !outcome;
  const answered = useMemo(() => exchanges.filter((entry) => entry.answer).length, [exchanges]);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      if (listRef) listRef.scrollTop = listRef.scrollHeight;
    });
  }, [listRef]);

  useEffect(() => {
    scrollToEnd();
  }, [exchanges, outcome, busy, scrollToEnd]);

  const say = useCallback<Say>(
    (text, scripted) => (!text ? null : scripted ? t(text) : text),
    [t],
  );

  /** Ask for the next turn. `answer` is the sentence that justifies asking for it. */
  const ask = useCallback(
    async (answer: string | null) => {
      const history = answer
        ? [...linesFor(exchanges), { role: "candidate" as const, text: answer }]
        : [];
      setBusy(true);
      setError(null);
      try {
        const turn = await api.mockInterview({ role: job, history, language: uiLang });
        // A child who says they are unsafe gets the one sentence this project has
        // reviewed, and no number about their answers.
        setSupport(turn.needs_support ? turn.feedback : null);
        setNotice(turn.demo_generated && turn.error ? t(turn.error) : null);
        if (turn.finished) setOutcome(turn);
        setExchanges((current) => {
          const withAnswer = answer
            ? current.map((entry, index) =>
                index === current.length - 1 ? { ...entry, answer } : entry,
              )
            : current;
          if (turn.finished) return withAnswer;
          return [
            ...withAnswer,
            {
              question: turn.question ?? "",
              feedback: turn.feedback,
              answer: null,
              scripted: turn.demo_generated,
            },
          ];
        });
      } catch (caught) {
        // Nothing was placed in the transcript, so the student's own words are still in
        // the box and one press of Send retries the turn.
        setError(caught instanceof Error ? t(caught.message) : t("The interviewer could not answer."));
      } finally {
        setBusy(false);
      }
    },
    [exchanges, job, t, uiLang],
  );

  const start = useCallback(() => {
    if (job.length < 2) {
      setError(t("Type the job you want to practise for."));
      return;
    }
    setOutcome(null);
    setSupport(null);
    setNotice(null);
    setExchanges([]);
    void ask(null);
  }, [ask, job, t]);

  const send = useCallback(() => {
    const answer = draft.trim();
    if (!answer || busy || !exchanges.length) return;
    setDraft("");
    void ask(answer);
  }, [ask, busy, draft, exchanges.length]);

  const restart = useCallback(() => {
    setExchanges([]);
    setOutcome(null);
    setSupport(null);
    setNotice(null);
    setDraft("");
    setError(null);
  }, []);

  if (!running && !outcome) {
    return (
      <Screen
        title="Practice Interview"
        description="One friendly interviewer, five questions about you, and a few things to try next time. Pick a job and start when you are ready."
        badge={<Badge tone="brand">{t("Interview practice")}</Badge>}
      >
        <Card className="max-w-xl space-y-5">
          <Select
            label="Which job do you want to practise for?"
            placeholder="Choose a job…"
            options={[
              ...ROLE_OPTIONS.map((value) => ({ value, label: value })),
              { value: OTHER, label: "Something else — I will type it" },
            ]}
            value={chosen}
            onChange={(event) => setChosen(event.target.value)}
          />
          {chosen === OTHER ? (
            <Input
              label="The job, in your own words"
              hint="Any job works — “cricket commentator”, “hotel manager”, “machine repair”."
              maxLength={120}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              placeholder="What should the interviewer ask about?"
            />
          ) : null}

          <ul className="space-y-2">
            {PROMISES.map((promise) => (
              <li key={promise} className="flex items-start gap-2 text-xs leading-relaxed text-muted">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal" aria-hidden />
                {t(promise)}
              </li>
            ))}
          </ul>

          {error ? (
            <p className="rounded-card bg-danger-mist px-3 py-2 text-xs text-danger" role="alert">
              {error}
            </p>
          ) : null}

          <Button onClick={start} disabled={busy || job.length < 2}>
            <MessagesSquare className="h-4 w-4" aria-hidden />
            {busy ? t("Getting your first question…") : t("Start Mock Interview")}
          </Button>
        </Card>
      </Screen>
    );
  }

  const progress = tf("Question {n} of {total}", {
    n: Math.min(exchanges.length, TOTAL_QUESTIONS),
    total: TOTAL_QUESTIONS,
  });

  return (
    <Screen
      fill
      title="Practice Interview"
      description={
        <>
          {tf("Practising for {job}. Five questions, and nobody outside this tab reads the answers.", {
            job,
          })}
        </>
      }
      badge={
        <Badge tone={outcome ? "success" : "brand"}>
          {outcome ? t("Interview complete") : answered >= TOTAL_QUESTIONS ? t("Closing…") : progress}
        </Badge>
      }
      action={
        <Button variant="ghost" size="sm" onClick={restart}>
          <RotateCcw className="h-4 w-4" aria-hidden />
          {t("Start over")}
        </Button>
      }
    >
      {/* `gap-4`, not `space-y-4`: this column now has a child that is asked to take what is
          left (`flex-1`), and `space-y-4` puts its margin *inside* that child's box, so the
          thread card measured its own height one gap too short. */}
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        {support ? (
          <Card className="border-warning/40 bg-warning-mist">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden />
              <div className="text-sm">
                <p className="font-semibold text-ink">{t("Your safety comes first")}</p>
                <p className="mt-1 leading-relaxed text-ink/80">{support}</p>
                <p className="mt-2 text-xs leading-relaxed text-muted">
                  {t("This practice interview is closed, and nothing about these answers was scored.")}
                </p>
                <Button variant="ghost" size="sm" className="mt-2" onClick={() => setSupport(null)}>
                  {t("I have read this")}
                </Button>
              </div>
            </div>
          </Card>
        ) : null}

        {notice ? (
          <p className="rounded-card bg-canvas px-4 py-2.5 text-xs leading-relaxed text-muted" role="status">
            {notice}
          </p>
        ) : null}

        {/* Same rule as the chat thread: the card is handed the height the screen has left
            and the answers scroll inside it, instead of the screen agreeing in advance that
            a conversation is 52% of a window tall. */}
        <Card
          className={cn("flex flex-col p-0", outcome ? null : "min-h-[240px] flex-1 overflow-hidden")}
        >
          <div ref={setListRef} className="cg-scrollbar flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
            {exchanges.map((entry, index) => (
              <div key={`${index}-${entry.question}`} className="space-y-2">
                {entry.feedback ? (
                  // The indicator the student asked for: a note about the answer they just
                  // gave, sitting between that answer and the next question, about the
                  // answer and never about them.
                  <div className="flex items-start gap-2 rounded-card bg-teal-mist px-3 py-2">
                    <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-teal">
                        {t("Feedback")}
                      </p>
                      <p className="text-xs leading-relaxed text-ink">{say(entry.feedback, entry.scripted)}</p>
                    </div>
                  </div>
                ) : null}

                <div className="flex justify-start">
                  <div className="max-w-[88%] min-w-0 break-words rounded-card border border-line bg-surface px-4 py-3 text-sm leading-relaxed text-ink shadow-card sm:max-w-[76%]">
                    {say(entry.question, entry.scripted)}
                  </div>
                </div>

                {entry.answer ? (
                  <div className="flex justify-end">
                    <div className="max-w-[88%] min-w-0 break-words rounded-card bg-brand px-4 py-3 text-sm leading-relaxed text-white shadow-card sm:max-w-[76%]">
                      {entry.answer}
                    </div>
                  </div>
                ) : null}
              </div>
            ))}

            {busy ? (
              <div className="flex justify-start">
                <div className="rounded-card border border-line bg-surface px-4 py-3 text-sm text-muted">
                  <span role="status">{t("The interviewer is thinking…")}</span>
                </div>
              </div>
            ) : null}
          </div>

          {outcome ? null : (
            <div className="border-t border-line p-3 sm:p-4">
              {error ? (
                <p className="mb-2 rounded-card bg-danger-mist px-3 py-2 text-xs text-danger" role="alert">
                  {error}
                </p>
              ) : null}
              {/* One height for the box and its button, as in the chat: `items-end` matched
                  their bottoms while a 46px box and a 40px round button sat at different
                  heights, and the box needed `min-w-0` to give way to the button on a phone.
                  `field-sizing-content` so a long answer is read, not scrolled inside a slot
                  that stays 44px no matter what was typed into it. */}
              <div className="flex items-center gap-2">
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      send();
                    }
                  }}
                  rows={1}
                  maxLength={1200}
                  placeholder={t("Type your answer…")}
                  aria-label={t("Your answer to the interviewer")}
                  className="cg-scrollbar max-h-32 min-h-11 min-w-0 flex-1 resize-none rounded-card border border-line bg-surface px-3.5 py-2 text-sm leading-relaxed text-ink outline-none field-sizing-content placeholder:text-muted/70 focus:border-brand focus:ring-2 focus:ring-brand-mist"
                />
                <Button
                  size="icon"
                  aria-label={t("Send your answer")}
                  title={t("Send (Enter)")}
                  disabled={!draft.trim() || busy}
                  onClick={send}
                  className="h-11 w-11 shrink-0"
                >
                  <Send className="h-4 w-4" aria-hidden />
                </Button>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                {/* The shortcut the placeholder used to carry, which in Hindi was three
                    lines tall inside a one-line box. Kept off the phone: the thumb that
                    needs it has no Shift key to find. */}
                <span className="hidden sm:block">
                  {t("Enter sends your answer. Shift+Enter starts a new line.")}
                </span>
                {t(
                  "Take your time. A short answer is fine — say what you would try first, and that counts.",
                )}
              </p>
            </div>
          )}
        </Card>

        {outcome ? <Closing turn={outcome} say={say} t={t} onRestart={restart} /> : null}
      </div>
    </Screen>
  );
}

/**
 * The end card: what the interviewer said, the number if there is one, and the tips.
 *
 * `score` arrives null whenever nobody read the answers, and that is drawn as its own
 * honest panel rather than as a zero — the one thing a student could not argue with.
 */
function Closing({
  turn,
  say,
  t,
  onRestart,
}: {
  turn: InterviewTurn;
  say: Say;
  t: ReturnType<typeof useT>;
  onRestart: () => void;
}) {
  const scripted = turn.demo_generated;
  return (
    <Card className="space-y-4">
      {turn.feedback ? (
        <p className="text-sm leading-relaxed text-ink">{say(turn.feedback, scripted)}</p>
      ) : null}

      {turn.score !== null ? (
        <div className="flex flex-wrap items-end gap-3">
          <p className="text-3xl font-semibold leading-none text-brand-dark">{turn.score}</p>
          <p className="text-xs text-muted">{t("out of 100")}</p>
          <Badge tone="success">{t("for these five answers only")}</Badge>
        </div>
      ) : (
        <div className="rounded-card bg-canvas px-4 py-3">
          <p className="text-sm font-semibold text-ink">{t("No score this time")}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            {scripted
              ? t("Nobody read your answers, so there is no number and no judgement of them.")
              : t("The interviewer did not send a score for these answers, so nothing is shown.")}
          </p>
        </div>
      )}

      {turn.score !== null ? (
        <p className="text-xs leading-relaxed text-muted">
          {t(
            "This is one AI's opinion about five answers in one practice sitting. It is not a mark, it is not a measurement of you, and no college or employer ever sees it.",
          )}
        </p>
      ) : null}

      {turn.tips.length ? (
        <div>
          <h2 className="text-sm font-semibold text-ink">
            {scripted ? t("General tips for any interview") : t("Tips to improve")}
          </h2>
          <ul className="mt-2 space-y-2">
            {turn.tips.map((tip, index) => (
              <li
                key={`${index}-${tip}`}
                className="flex items-start gap-2 text-sm leading-relaxed text-ink/90"
              >
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" aria-hidden />
                {say(tip, scripted)}
              </li>
            ))}
          </ul>
          {scripted ? (
            <p className="mt-2 text-xs leading-relaxed text-muted">
              {t("These lines are the same for every student, because nobody read yours.")}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={onRestart}>
          <RotateCcw className="h-4 w-4" aria-hidden />
          {t("Do another one")}
        </Button>
        <LinkButton href="/app" variant="outline">
          {t("Back to the dashboard")}
        </LinkButton>
      </div>
    </Card>
  );
}
