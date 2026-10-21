"use client";

import { useId } from "react";
import { Check } from "lucide-react";
import type { AssessmentQuestion, ScalePoint } from "@/lib/assessments";
import { useTf } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * One question, one answer, nothing else on screen.
 *
 * A Likert item and a multiple-choice puzzle are the same control here: a real radio
 * group, so arrow keys move between options, the selected answer is announced to a
 * screen reader, and a child who never touches the mouse can still finish the set.
 *
 * The wording comes from the server in the language the sitting was started in. This
 * component never translates a question — a career questionnaire that says one thing
 * in the interface and another in the item is how a child answers the wrong sentence.
 */
export function QuestionCard({
  question,
  index,
  total,
  scale,
  value,
  onChange,
  disabled = false,
}: {
  question: AssessmentQuestion;
  index: number;
  total: number;
  scale: ScalePoint[];
  value: string | undefined;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const tf = useTf();
  const groupId = useId();
  const position = tf("Question {n} of {total}", { n: index + 1, total });

  const options =
    question.response_type === "choice"
      ? question.options.map((option) => ({ value: option.value, label: option.label }))
      : scale.map((point) => ({ value: String(point.value), label: point.label }));

  return (
    <fieldset className="border-0 p-0" disabled={disabled}>
      {/* The position is already printed above the card in the progress row; this
          copy exists for a screen reader entering the group, not for the eye. */}
      <legend className="sr-only">{position}</legend>
      <p
        id={`${groupId}-text`}
        className="text-lg font-semibold leading-snug text-ink sm:text-xl"
      >
        {question.text}
      </p>

      <div className="mt-5 space-y-2.5" role="radiogroup" aria-labelledby={`${groupId}-text`}>
        {options.map((option) => {
          const inputId = `${groupId}-${option.value}`;
          const selected = value === option.value;
          return (
            <div key={option.value} className="relative">
              <input
                id={inputId}
                type="radio"
                name={groupId}
                value={option.value}
                checked={selected}
                // A radio group cannot be cleared by clicking, so the parent keeps
                // the answer until the student picks a different one.
                onChange={() => onChange(option.value)}
                className="peer sr-only"
              />
              <label
                htmlFor={inputId}
                className={cn(
                  "flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium transition-colors",
                  "peer-focus-visible:ring-2 peer-focus-visible:ring-brand/45 peer-focus-visible:ring-offset-2",
                  selected
                    ? "border-brand bg-brand-mist text-brand-dark"
                    : "border-line bg-surface text-ink hover:border-brand-light hover:bg-canvas",
                  disabled && "cursor-not-allowed opacity-60",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                    selected ? "border-brand bg-brand text-white" : "border-line bg-canvas",
                  )}
                >
                  {selected ? <Check className="h-3 w-3" aria-hidden /> : null}
                </span>
                <span className="min-w-0">{option.label}</span>
              </label>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
