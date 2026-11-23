import type { QuizQuestion, Severity } from './types';

export interface QuizEvaluation {
  correctCount: number;
  wrongCount: number;
  score: number;
  passed: boolean;
  perQuestion: Record<string, { selected: number; correct: boolean; why: string }>;
}

export function scoreQuiz(
  questions: QuizQuestion[],
  answers: Record<string, number>
): QuizEvaluation {
  let correctCount = 0;
  let wrongCount = 0;
  const perQuestion: Record<string, { selected: number; correct: boolean; why: string }> = {};

  for (const q of questions) {
    const selected = answers[q.id];
    const isCorrect = selected === q.answer;
    if (isCorrect) {
      correctCount += 1;
    } else {
      wrongCount += 1;
    }
    perQuestion[q.id] = {
      selected: selected ?? -1,
      correct: isCorrect,
      why: q.why,
    };
  }

  const score = Math.max(0, 100 - wrongCount * 10);
  return {
    correctCount,
    wrongCount,
    score,
    passed: wrongCount === 0,
    perQuestion,
  };
}

const SEVERITY_BASE: Record<Severity, number> = {
  low: 20,
  medium: 45,
  high: 70,
  critical: 90,
};

export function calculateRiskScore(
  severity: Severity,
  assetCriticality: 1 | 2 | 3 | 4 | 5,
  confidence = 0.9
): number {
  const base = SEVERITY_BASE[severity];
  const multiplier = 0.7 + assetCriticality * 0.08;
  return Math.min(100, Math.round(base * multiplier * confidence));
}
