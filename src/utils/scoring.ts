import { ClassStatistics, MasterTemplate, OptionLetter, StudentExamResult } from '../types';

/**
 * Evaluates student answers against the active Master Template
 */
export function gradeStudentExam(
  detectedAnswers: Record<number, OptionLetter | 'MULTIPLE' | 'BLANK'>,
  template: MasterTemplate,
  existingResultData?: Partial<StudentExamResult>
): {
  score: number;
  percentage: number;
  correctCount: number;
  incorrectCount: number;
  blankCount: number;
  doubleMarkCount: number;
  totalQuestionsGraded: number;
  isPassed: boolean;
  anomalies: string[];
} {
  const totalQuestions = template.totalQuestions;
  let correctCount = 0;
  let incorrectCount = 0;
  let blankCount = 0;
  let doubleMarkCount = 0;
  let totalScoreEarned = 0;
  let totalPossibleScore = 0;

  const anomalies: string[] = [];

  for (let q = 1; q <= totalQuestions; q++) {
    const studentAnswer = detectedAnswers[q];
    const correctAnswer = template.keys[q];
    const weight = template.weights[q] ?? 1.0;

    totalPossibleScore += weight;

    if (!studentAnswer || studentAnswer === 'BLANK') {
      blankCount++;
      anomalies.push(`Pregunta #${q} sin responder (en blanco)`);
      if (template.blankMarkRule === 'PENALTY' && template.penaltyPerBlank) {
        totalScoreEarned = Math.max(0, totalScoreEarned - template.penaltyPerBlank);
      }
    } else if (studentAnswer === 'MULTIPLE') {
      doubleMarkCount++;
      anomalies.push(`Pregunta #${q} con múltiple respuesta rellenada (inválida)`);
      // Double marks award 0
    } else if (correctAnswer && studentAnswer.toLowerCase() === correctAnswer.toLowerCase()) {
      correctCount++;
      totalScoreEarned += weight;
    } else {
      incorrectCount++;
    }
  }

  // Formula: Score = (Score Earned / Possible Score) * (scaleMax - scaleMin) + scaleMin
  const rawPercentage = totalPossibleScore > 0 ? (totalScoreEarned / totalPossibleScore) * 100 : 0;
  const scaleRange = template.scaleMax - template.scaleMin;
  const calculatedScore = totalPossibleScore > 0 
    ? Number((template.scaleMin + (totalScoreEarned / totalPossibleScore) * scaleRange).toFixed(2))
    : template.scaleMin;

  const isPassed = calculatedScore >= template.passingGrade;

  return {
    score: Math.min(template.scaleMax, Math.max(template.scaleMin, calculatedScore)),
    percentage: Number(rawPercentage.toFixed(1)),
    correctCount,
    incorrectCount,
    blankCount,
    doubleMarkCount,
    totalQuestionsGraded: totalQuestions,
    isPassed,
    anomalies: Array.from(new Set(anomalies)),
  };
}

/**
 * Compute aggregate statistics for the entire evaluated class/batch
 */
export function calculateClassStatistics(
  results: StudentExamResult[],
  template: MasterTemplate
): ClassStatistics {
  const gradedList = results.filter((r) => r.status === 'GRADED' || r.status === 'NEEDS_REVIEW');
  const totalGraded = gradedList.length;

  if (totalGraded === 0) {
    return {
      totalStudents: results.length,
      gradedStudents: 0,
      averageScore: 0,
      highestScore: 0,
      lowestScore: 0,
      medianScore: 0,
      standardDeviation: 0,
      passRate: 0,
      passedCount: 0,
      failedCount: 0,
      questionStats: [],
      hardestQuestions: [],
      easiestQuestions: [],
    };
  }

  const scores = gradedList.map((r) => r.score).sort((a, b) => a - b);
  const sumScores = scores.reduce((sum, s) => sum + s, 0);
  const avgScore = sumScores / totalGraded;

  // Median
  let median = 0;
  const mid = Math.floor(totalGraded / 2);
  if (totalGraded % 2 !== 0) {
    median = scores[mid];
  } else {
    median = (scores[mid - 1] + scores[mid]) / 2;
  }

  // Standard deviation
  const variance = scores.reduce((sum, s) => sum + Math.pow(s - avgScore, 2), 0) / totalGraded;
  const stdDev = Math.sqrt(variance);

  const passedCount = gradedList.filter((r) => r.score >= template.passingGrade).length;
  const failedCount = totalGraded - passedCount;
  const passRate = (passedCount / totalGraded) * 100;

  // Per-question item analysis
  const questionStats = [];
  for (let q = 1; q <= template.totalQuestions; q++) {
    let correct = 0;
    let incorrect = 0;
    let blank = 0;
    let double = 0;
    const wrongOptionsCount: Record<string, number> = {};

    gradedList.forEach((r) => {
      const ans = r.detectedAnswers[q];
      const correctKey = template.keys[q];

      if (!ans || ans === 'BLANK') {
        blank++;
      } else if (ans === 'MULTIPLE') {
        double++;
      } else if (correctKey && ans.toLowerCase() === correctKey.toLowerCase()) {
        correct++;
      } else {
        incorrect++;
        wrongOptionsCount[ans] = (wrongOptionsCount[ans] || 0) + 1;
      }
    });

    let mostCommonWrongOption: OptionLetter | undefined = undefined;
    let maxWrongCount = 0;
    Object.entries(wrongOptionsCount).forEach(([opt, cnt]) => {
      if (cnt > maxWrongCount) {
        maxWrongCount = cnt;
        mostCommonWrongOption = opt as OptionLetter;
      }
    });

    const successRate = totalGraded > 0 ? (correct / totalGraded) * 100 : 0;
    questionStats.push({
      questionNumber: q,
      correctCount: correct,
      incorrectCount: incorrect,
      blankCount: blank,
      doubleCount: double,
      successRate: Number(successRate.toFixed(1)),
      mostCommonWrongOption,
    });
  }

  // Rank easiest and hardest questions
  const sortedByDifficulty = [...questionStats].sort((a, b) => a.successRate - b.successRate);
  const hardestQuestions = sortedByDifficulty.slice(0, 5).map((q) => q.questionNumber);
  const easiestQuestions = [...sortedByDifficulty].reverse().slice(0, 5).map((q) => q.questionNumber);

  return {
    totalStudents: results.length,
    gradedStudents: totalGraded,
    averageScore: Number(avgScore.toFixed(2)),
    highestScore: scores[scores.length - 1],
    lowestScore: scores[0],
    medianScore: Number(median.toFixed(2)),
    standardDeviation: Number(stdDev.toFixed(2)),
    passRate: Number(passRate.toFixed(1)),
    passedCount,
    failedCount,
    questionStats,
    hardestQuestions,
    easiestQuestions,
  };
}
