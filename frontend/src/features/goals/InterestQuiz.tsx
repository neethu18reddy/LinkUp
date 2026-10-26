import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { requestError } from '@/lib/http';
import {
  getLatestQuiz,
  getQuizQuestions,
  goalKeys,
  submitQuiz,
  type QuizResult,
  type Recommendation,
} from './goals.api';

export function InterestQuiz({
  onSkip,
  onChoose,
}: {
  onSkip: () => void;
  onChoose: (recommendation: Recommendation, quizId: string) => void;
}) {
  const client = useQueryClient();
  const questions = useQuery({ queryKey: goalKeys.questions, queryFn: getQuizQuestions });
  const latest = useQuery({ queryKey: goalKeys.quiz, queryFn: getLatestQuiz });
  const [taking, setTaking] = useState(false);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const submit = useMutation({
    mutationFn: submitQuiz,
    onSuccess: (value) => {
      setResult(value);
      setTaking(false);
      client.setQueryData(goalKeys.quiz, value);
    },
  });
  const suggestions = taking ? null : (result ?? latest.data);
  function restart() {
    setTaking(true);
    setResult(null);
    setAnswers({});
    setStep(0);
    submit.reset();
  }
  return (
    <section className="skills-card quiz-card" aria-labelledby="quiz-title">
      <div className="skills-section-heading">
        <h2 id="quiz-title">Find a direction</h2>
        <Button variant="outline" onClick={onSkip}>
          Skip quiz
        </Button>
      </div>
      <p className="field-hint">
        Seven short questions. Suggestions use local scoring and your existing skills.
      </p>
      {suggestions ? (
        <>
          <h3 className="quiz-results-title">Three directions to explore</h3>
          <p className="field-hint">
            Choose the one you want to review. Your goal stays unchanged until you confirm.
          </p>
          <ol className="recommendation-list">
            {suggestions.recommendations.map((recommendation, index) => (
              <li key={recommendation.roleId}>
                <span className="recommendation-rank">0{index + 1}</span>
                <h3>{recommendation.title}</h3>
                <p>{recommendation.description}</p>
                <ul>
                  {recommendation.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
                <Button variant="outline" onClick={() => onChoose(recommendation, suggestions.id)}>
                  Choose {recommendation.title}
                </Button>
              </li>
            ))}
          </ol>
          <Button variant="outline" onClick={restart}>
            Retake quiz
          </Button>
        </>
      ) : latest.isPending && !taking ? (
        <p role="status">Checking your saved quiz…</p>
      ) : latest.isError && !taking ? (
        <div className="inline-query-error">
          <p role="alert">{requestError(latest.error)}</p>
          <div className="goal-actions">
            <Button variant="outline" onClick={() => void latest.refetch()}>
              Retry saved quiz
            </Button>
            <Button onClick={restart}>Start a new quiz</Button>
          </div>
        </div>
      ) : questions.isPending ? (
        <p role="status">Loading questions…</p>
      ) : questions.isError ? (
        <div className="inline-query-error">
          <p role="alert">{requestError(questions.error)}</p>
          <Button variant="outline" onClick={() => void questions.refetch()}>
            Retry questions
          </Button>
        </div>
      ) : (
        (() => {
          const question = questions.data[step]!;
          const last = step === questions.data.length - 1;
          return (
            <form
              aria-label="Interest quiz"
              onSubmit={(event) => {
                event.preventDefault();
                if (!answers[question.id] || submit.isPending) return;
                if (!last) {
                  setStep(step + 1);
                  return;
                }
                submit.mutate(
                  questions.data.map((item) => ({
                    questionId: item.id,
                    optionId: answers[item.id]!,
                  })),
                );
              }}
            >
              <p role="status" className="quiz-step">
                Question {step + 1} of {questions.data.length}
              </p>
              <progress
                aria-label="Quiz progress"
                max={questions.data.length}
                value={Object.keys(answers).length}
              />
              <fieldset className="quiz-options" key={question.id} disabled={submit.isPending}>
                <legend>{question.prompt}</legend>
                {question.options.map((option) => (
                  <label key={option.id}>
                    <input
                      type="radio"
                      name={question.id}
                      value={option.id}
                      checked={answers[question.id] === option.id}
                      onChange={() => {
                        setAnswers({ ...answers, [question.id]: option.id });
                        submit.reset();
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
                    disabled={submit.isPending}
                    onClick={() => setStep(step - 1)}
                  >
                    Back
                  </Button>
                )}
                <Button type="submit" disabled={!answers[question.id] || submit.isPending}>
                  {submit.isPending
                    ? 'Finding suggestions…'
                    : last
                      ? 'See suggestions'
                      : 'Next question'}
                </Button>
              </div>
              {submit.error && (
                <p className="field-error" role="alert">
                  {requestError(submit.error)}
                </p>
              )}
            </form>
          );
        })()
      )}
    </section>
  );
}
