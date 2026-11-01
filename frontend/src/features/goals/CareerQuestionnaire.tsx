import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getCareerQuestions, saveCareerAnswers } from './career.api';
import { MatchList } from './CareerMatches';
import { Button } from '@/components/ui/button';
import { requestError } from '@/lib/http';

export function CareerQuestionnaire() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['career-questions'], queryFn: getCareerQuestions });
  const [step, setStep] = useState(0),
    [answers, setAnswers] = useState<Record<string, string[]>>({});
  const save = useMutation({
    mutationFn: saveCareerAnswers,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['my-skills'] });
      void client.invalidateQueries({ queryKey: ['career-matches'] });
      void client.invalidateQueries({ queryKey: ['latest-quiz'] });
    },
  });
  if (query.isPending) return <p role="status">Loading your guided starting point…</p>;
  if (query.isError)
    return (
      <>
        <p role="alert">{requestError(query.error)}</p>
        <Button onClick={() => void query.refetch()}>Retry questionnaire</Button>
      </>
    );
  if (save.data)
    return (
      <section className="skills-card">
        <h2>Your starting directions</h2>
        <p>
          Your self-reported tools were saved at beginner level. Review their levels in Skills. Your
          preference is {save.data.hoursPerWeek} hours a week; choose your actual pace when you
          create a weekly plan.
        </p>
        <MatchList roles={save.data.recommendations} />
        <details>
          <summary>Next five alternatives</summary>
          <MatchList roles={save.data.alternatives} />
        </details>
        {save.data.stretchRoles.length > 0 && (
          <details>
            <summary>Stretch directions</summary>
            <MatchList roles={save.data.stretchRoles} />
          </details>
        )}
        <Button
          variant="outline"
          onClick={() => {
            save.reset();
            setStep(0);
          }}
        >
          Review my answers
        </Button>
      </section>
    );
  const question = query.data[step]!;
  const options = question.options.filter(
    (option) => !option.domains || option.domains.includes(answers.interest?.[0] ?? ''),
  );
  const chosen = answers[question.id] ?? [];
  return (
    <section className="skills-card">
      <h2>Find your starting point</h2>
      <p>Eight short questions. Only tools you say you have used are added to your skills.</p>
      <form
        aria-label="Career questionnaire"
        onSubmit={(event) => {
          event.preventDefault();
          if (!chosen.length || save.isPending) return;
          if (step < query.data.length - 1) setStep(step + 1);
          else
            save.mutate(
              query.data.map((item) => ({
                questionId: item.id,
                optionIds: answers[item.id] ?? [],
              })),
            );
        }}
      >
        <p role="status">
          Question {step + 1} of {query.data.length}
        </p>
        <progress aria-label="Questionnaire progress" value={step + 1} max={query.data.length} />
        <fieldset className="quiz-options" key={question.id} disabled={save.isPending}>
          <legend>{question.prompt}</legend>
          {options.map((option) => (
            <label key={option.id}>
              <input
                type={question.multiple ? 'checkbox' : 'radio'}
                name={question.id}
                checked={chosen.includes(option.id)}
                onChange={() => {
                  const next = question.multiple
                    ? option.id === 'none'
                      ? ['none']
                      : chosen.includes(option.id)
                        ? chosen.filter((id) => id !== option.id)
                        : [...chosen.filter((id) => id !== 'none'), option.id]
                    : [option.id];
                  setAnswers((current) => ({
                    ...current,
                    [question.id]: next,
                    ...(question.id === 'interest' ? { tools: [] } : {}),
                  }));
                }}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </fieldset>
        <div className="goal-actions">
          {step > 0 && (
            <Button
              type="button"
              variant="outline"
              disabled={save.isPending}
              onClick={() => setStep(step - 1)}
            >
              Previous
            </Button>
          )}
          <Button type="submit" disabled={!chosen.length || save.isPending}>
            {save.isPending
              ? 'Saving your starting point…'
              : step === query.data.length - 1
                ? 'Find my directions'
                : 'Continue'}
          </Button>
        </div>
        {save.error && <p role="alert">{requestError(save.error)}</p>}
      </form>
    </section>
  );
}
