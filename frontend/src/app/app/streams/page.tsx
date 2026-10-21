"use client";

import { useMemo } from "react";
import {
  ArrowRight,
  BookOpen,
  Building2,
  Calculator,
  Compass,
  HeartHandshake,
  Info,
  MessagesSquare,
  Scale,
  Split,
  Unplug,
} from "lucide-react";
import { Screen } from "@/components/layout/app-shell";
import { Card, SectionHeading } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { useSession } from "@/lib/session";
import { useT } from "@/lib/i18n";
import type { ThemeKey } from "@/lib/types";

/**
 * The class 10 → class 11 fork, explained rather than decided.
 *
 * What this screen refuses to do: tell a student which stream they "should"
 * take, rank the streams, or promise that one of them leads somewhere specific.
 * The subject combinations a school actually offers are set by that school and
 * its board, so the only authority on availability is the school itself — every
 * card says so instead of assuming.
 */
interface Stream {
  id: string;
  name: string;
  tagline: string;
  subjects: string[];
  /** Course families people commonly reach from here — degrees, not jobs. */
  leads: string[];
  /** What to ask the school, because no app can know a particular school's timetables. */
  to_check: string;
  /** Something true about the stream that students usually learn too late. */
  reality: string;
  theme: ThemeKey;
}

const STREAMS: Stream[] = [
  {
    id: "science",
    name: "Science",
    tagline: "Usually Physics, Chemistry and Maths (PCM) or Physics, Chemistry and Biology (PCB).",
    subjects: [
      "Physics and Chemistry are common to both combinations.",
      "Maths in PCM; Biology in PCB. Many schools also allow a third option such as Computer Science, IT, Engineering Graphics or Biology alongside Maths — that choice is the school's, not a national rule.",
      "The practical/lab work and the board's own syllabus are what you are actually examined on.",
    ],
    leads: [
      "Engineering and technology degrees (usually PCM).",
      "Medicine, dentistry, nursing, pharmacy and allied health degrees (usually PCB).",
      "Pure and applied science degrees, agriculture, veterinary and some design courses.",
      "Degrees that ask for science in specific subjects — the prospectus of that one course is the authority.",
    ],
    to_check:
      "Ask your school which combinations it offers in class 11, how many sections of each, and whether your chosen third subject is timetabled. Then read your board's class 11 subject list.",
    reality:
      "Science is not a smarter stream, and it is not a shortcut into a high salary. It is a heavier load of abstract theory and practice work — taken happily it is a good base; taken under pressure it is a hard two years.",
    theme: "nature_scientific_curiosity",
  },
  {
    id: "commerce",
    name: "Commerce",
    tagline: "Money, organisations and how an economy behaves.",
    subjects: [
      "Accountancy and Business Studies are the usual core.",
      "Economics is common; Maths or Informatics Practices is often an option — some schools require one, others offer neither.",
      "A language and an optional subject are usually added, depending on the board.",
    ],
    leads: [
      "Commerce and management degrees (B.Com, BBA and similar).",
      "Professional routes such as CA, CS and cost/work accountancy, each with its own institute's own entry rules.",
      "Banking, insurance, taxation, audit and finance roles after further study or exams.",
      "Law, design, media and civil services too — commerce is not a wall around one field.",
    ],
    to_check:
      "Ask whether your school offers Commerce with Maths, without Maths, and with which optional subjects — professional-route eligibility sometimes depends on having studied Maths or Accountancy.",
    reality:
      "Commerce is not the easy scoring stream. Numbers, definitions and case logic have their own difficulty, and the professional exams people chase after class 12 are long and demanding.",
    theme: "organization_leadership",
  },
  {
    id: "humanities",
    name: "Humanities / Arts",
    tagline: "People, societies, texts, arguments and systems.",
    subjects: [
      "Common options include History, Political Science, Geography, Psychology, Sociology, Economics, Public Administration and Legal Studies.",
      "Languages — Hindi, English, Sanskrit, Urdu and regional languages — are often chosen here.",
      "Which of these a school actually runs is the school's decision, and it varies widely.",
    ],
    leads: [
      "Broad bachelor's degrees: arts, social sciences, literature, journalism, mass communication.",
      "Law after class 12 through the national law entrance, and civil services after any degree.",
      "Teaching, public health, development work, design, archiving, content and research paths.",
      "Many professional courses accept any stream as long as the named subjects are there.",
    ],
    to_check:
      "Ask for the exact list of optional subjects your school runs for class 11 Humanities, and who teaches each — the same name on two schools' lists can mean very different timetables.",
    reality:
      "Humanities is not the fallback for weak students. It rewards reading, writing and arguing carefully, and it is the standard route into law, civil services and most of the work that deals with people and policy.",
    theme: "communication_collaboration",
  },
];

const OTHER_ROUTES = [
  {
    icon: Unplug,
    title: "Vocational and skill-based streams",
    body: "Some boards run vocational electives — IT, construction, retail, healthcare assistance, agriculture and similar — inside school itself. Where they exist they can lead straight into work or into a diploma. Ask your school and your state board whether any are offered; availability is genuinely uneven.",
  },
  {
    icon: BookOpen,
    title: "Diploma after class 10",
    body: "Polytechnic diplomas in engineering and other fields are commonly open after class 10, through your state's own admission process. They are a different route, not a lesser one — and later steps depend on rules you should verify with the state authority.",
  },
  {
    icon: Compass,
    title: "Open and national schooling",
    body: "Open schooling boards exist for students whose situation does not fit a regular school — work, health, family responsibilities, or a stream their local school does not offer. Their subject lists and rules are published on their own official sites.",
  },
];

/**
 * Myths stated flatly, because the pressure a class 10 student is under usually
 * comes from these, not from a lack of information.
 */
const MYTHS = [
  {
    claim: "Science is for bright students, Humanities is for weak ones.",
    truth:
      "The three streams ask for different abilities, not different worth. A student who reads fast and argues well can be average in PCM and excellent in Humanities — and the reverse is equally common.",
  },
  {
    claim: "Commerce is the easy, high-scoring stream.",
    truth:
      "Accountancy and economics have their own hard parts, and the routes people aim at after commerce are competitive in their own way.",
  },
  {
    claim: "Your stream decides your whole life.",
    truth:
      "It decides the next two years and which doors are convenient, not the final room you end up in. People change fields after class 12, after graduation and later.",
  },
  {
    claim: "Once you choose, you cannot change.",
    truth:
      "Changing is possible in many schools and boards, with conditions — time limits, subjects you must catch up on, board rules. Ask before you assume it is impossible, and before you assume it is free.",
  },
  {
    claim: "Take the stream your friends are taking.",
    truth:
      "Your friends will not sit your papers, or your two years of daily homework, for you.",
  },
];

/**
 * A student's stated interests, linked to the career explorer by theme. This
 * shows what to read about — it never scores a stream or predicts a fit.
 */
const INTEREST_TO_THEME: Record<string, ThemeKey> = {
  "Maths and puzzles": "analytical_problem_solving",
  "Science experiments": "nature_scientific_curiosity",
  "Computers and coding": "analytical_problem_solving",
  "Building and fixing things": "practical_building",
  "Nature and animals": "nature_scientific_curiosity",
  "Plants and farming": "nature_scientific_curiosity",
  "Drawing and painting": "creative_exploration",
  "Music or dance": "creative_exploration",
  "Movies, photos and videos": "creative_exploration",
  "Stories and writing": "communication_collaboration",
  "Speaking in front of people": "communication_collaboration",
  "Organising events": "organization_leadership",
  "Business and money": "organization_leadership",
  "Helping people": "helping_others",
  "Teaching others": "helping_others",
  "Sports and games": "physical_activity_sports",
};

const HOW_TO_CHOOSE = [
  "Read the actual class 11 textbooks of each stream you are considering — the board publishes them, and many are free. Two pages of a real chapter tells you more than any advice.",
  "Ask your school what it offers, not what the market offers. A combination that does not exist in your building is not a choice.",
  "Picture the daily work: which subjects would you still be reading at 9 pm without anyone making you?",
  "Talk to one teacher and one senior who took that stream in your own school. Ask them what surprised them.",
  "Write down what you think you want, then look at it again after a week. A first answer is not a contract.",
];

const NOT_A_VERDICT = [
  "This screen gives no stream recommendation, no score and no prediction. It cannot know your school, your marks, your health or your family's situation.",
  "The guide in Chat and on the call can talk this through with you, and will not decide for you either.",
  "Any decision here should be checked with your school, your board, and the official website of any course you later aim at.",
];

function StreamCard({ stream }: { stream: Stream }) {
  const t = useT();
  return (
    <Card className="flex flex-col">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="flex items-center gap-2 text-base font-semibold leading-tight text-ink">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-mist text-brand-dark">
            {stream.id === "science" ? (
              <Split className="h-4 w-4" aria-hidden />
            ) : stream.id === "commerce" ? (
              <Calculator className="h-4 w-4" aria-hidden />
            ) : (
              <Scale className="h-4 w-4" aria-hidden />
            )}
          </span>
          {t(stream.name)}
        </h3>
        <LinkButton
          href={`/app/careers?theme=${stream.theme}`}
          variant="ghost"
          size="sm"
          className="px-0 text-brand-dark hover:bg-transparent"
        >
          {t("Careers to read about")}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </LinkButton>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-muted">{t(stream.tagline)}</p>

      <dl className="mt-3 space-y-2.5 text-sm leading-relaxed">
        <div>
          <dt className="font-medium text-ink">{t("What you usually study")}</dt>
          <dd className="mt-1 space-y-1.5 text-muted">
            {stream.subjects.map((line) => (
              <p key={line}>{t(line)}</p>
            ))}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-ink">{t("Courses people reach from here")}</dt>
          <dd className="mt-1 space-y-1.5 text-muted">
            {stream.leads.map((line) => (
              <p key={line}>{t(line)}</p>
            ))}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-ink">{t("Ask your school this")}</dt>
          <dd className="text-muted">{t(stream.to_check)}</dd>
        </div>
      </dl>

      <div className="mt-3 flex items-start gap-1.5 rounded-xl border border-line bg-canvas px-3 py-2.5 text-xs leading-relaxed text-ink">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
        <span>{t(stream.reality)}</span>
      </div>
    </Card>
  );
}

export default function StreamSelector() {
  const { profile } = useSession();
  const t = useT();

  const interestHints = useMemo(() => {
    const chosen = (profile?.interest_areas ?? [])
      .map((label) => ({ label, theme: INTEREST_TO_THEME[label] }))
      .filter((entry): entry is { label: string; theme: ThemeKey } => entry.theme !== undefined);
    // A profile can accumulate interests over time; four is enough to read at once.
    return chosen.slice(0, 4);
  }, [profile?.interest_areas]);

  return (
    <Screen
      title={t("Choose your stream")}
      description={t(
        "After class 10, Indian schools split into streams. This page explains what each one is actually like and what to check before you pick — it does not tell you which to choose.",
      )}
      badge={
        <Badge tone="teal" icon={<Building2 className="h-3.5 w-3.5" aria-hidden />}>
          {t("Exploration, not a decision")}
        </Badge>
      }
      action={
        <LinkButton href="/app/chat" variant="outline" size="sm">
          <MessagesSquare className="h-4 w-4" aria-hidden />
          {t("Talk it through with the guide")}
        </LinkButton>
      }
    >
      <div className="space-y-5">
        <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {t(
            "Streams, subject combinations and the rules for changing them are set by your board and your school. This page describes the common pattern; your school's own list is the authority on what you can actually take.",
          )}
        </p>

        {/* The three streams */}
        <section className="space-y-3">
          <SectionHeading
            title={t("The three main streams")}
            description={t(
              "Each card ends with the thing students usually wish they had known before choosing.",
            )}
          />
          <div className="grid gap-4 lg:grid-cols-3">
            {STREAMS.map((stream) => (
              <StreamCard key={stream.id} stream={stream} />
            ))}
          </div>
        </section>

        {/* Routes that are not one of the three */}
        <section className="space-y-3">
          <SectionHeading
            title={t("Other routes that exist")}
            description={t(
              "Science, Commerce and Humanities are the usual labels, not the only doors. Availability of these varies by state and school.",
            )}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            {OTHER_ROUTES.map((route) => {
              const Icon = route.icon;
              return (
                <Card key={route.title}>
                  <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-teal-mist text-teal">
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    {t(route.title)}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{t(route.body)}</p>
                </Card>
              );
            })}
          </div>
        </section>

        {/* How to actually decide */}
        <Card className="border-brand-light/40 bg-brand-mist/40">
          <SectionHeading
            title={t("How students who chose well actually chose")}
            description={t("Five things that cost nothing and are worth more than any opinion.")}
          />
          <ol className="mt-3 space-y-2.5">
            {HOW_TO_CHOOSE.map((line, i) => (
              <li key={line} className="flex items-start gap-3 text-sm leading-relaxed text-ink">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface text-xs font-semibold text-brand-dark">
                  {i + 1}
                </span>
                <span>{t(line)}</span>
              </li>
            ))}
          </ol>
        </Card>

        {/* What the student already told us */}
        {interestHints.length > 0 ? (
          <Card>
            <SectionHeading
              title={t("Things you said you like, and where to read more")}
              description={t(
                "These links open the career explorer. They are starting points to read, not a judgement about which stream suits you.",
              )}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {interestHints.map((hint) => (
                <LinkButton
                  key={hint.label}
                  href={`/app/careers?theme=${hint.theme}`}
                  variant="outline"
                  size="sm"
                >
                  {t(hint.label)}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </LinkButton>
              ))}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted">
              {t("Update these whenever you like — the interests screen is not a one-time test.")}
            </p>
          </Card>
        ) : (
          <Card>
            <SectionHeading
              title={t("Start with what you like")}
              description={t(
                "You have not told the guide what interests you yet. The interests screen takes a few minutes and gives you careers to read about in every stream.",
              )}
            />
            <div className="mt-3">
              <LinkButton href="/app/interests" size="sm">
                {t("Discover my interests")}
              </LinkButton>
            </div>
          </Card>
        )}

        {/* Myths */}
        <section className="space-y-3">
          <SectionHeading
            title={t("Things said about streams that are not true")}
            description={t("Most of the pressure around this choice comes from these ideas.")}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            {MYTHS.map((myth) => (
              <Card key={myth.claim} className="border-warning/25">
                <p className="text-sm font-semibold leading-relaxed text-ink">
                  <span className="text-amber-700">{t("Said often:")}</span> {t(myth.claim)}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted">{t(myth.truth)}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Exams that care about your stream */}
        <Card>
          <SectionHeading
            title={t("Exams that ask for particular subjects")}
            description={t(
              "Some entrance tests need specific subjects in class 11 and 12. That is the practical reason the stream choice matters — so read the exam page before you commit, not after.",
            )}
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <LinkButton href="/app/exams" size="sm">
              <BookOpen className="h-4 w-4" aria-hidden />
              {t("See the exams map")}
            </LinkButton>
            <LinkButton href="/app/institutes" variant="outline" size="sm">
              {t("Look at courses and colleges")}
            </LinkButton>
          </div>
        </Card>

        {/* Honest closing */}
        <Card className="border-brand-light/40 bg-brand-mist/40">
          <div className="flex items-start gap-2.5">
            <HeartHandshake className="mt-0.5 h-4 w-4 shrink-0 text-brand-dark" aria-hidden />
            <div className="text-sm leading-relaxed">
              <p className="font-semibold text-brand-dark">{t("What this page will not do")}</p>
              <ul className="mt-1 space-y-1.5 text-muted">
                {NOT_A_VERDICT.map((line) => (
                  <li key={line}>{t(line)}</li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </Screen>
  );
}
