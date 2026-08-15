export type OptionLetter = 'a' | 'b' | 'c' | 'd' | 'e' | 'f';

export type MarkStatus = 'CORRECT' | 'INCORRECT' | 'BLANK' | 'DOUBLE_MARK' | 'UNGRADED';

export interface QuestionKey {
  questionNumber: number;
  correctOption: OptionLetter;
  weight: number;
  topic?: string;
}

export interface MasterTemplate {
  id: string;
  name: string;
  institution: string;
  subject: string;
  totalQuestions: number;
  optionsPerQuestion: number;
  keys: Record<number, OptionLetter>;
  weights: Record<number, number>;
  scaleMin: number;
  scaleMax: number;
  passingGrade: number;
  doubleMarkRule: 'INCORRECT' | 'ZERO_POINTS';
  blankMarkRule: 'INCORRECT' | 'ZERO_POINTS' | 'PENALTY';
  penaltyPerBlank?: number;
  createdAt: string;
}

export interface StudentExamResult {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  imageUrl: string;
  processedImageUrl?: string;
  binarizedImageUrl?: string;
  
  studentName: string;
  grade: string;
  institution?: string;
  
  templateId: string;

  detectedAnswers: Record<number, OptionLetter | 'MULTIPLE' | 'BLANK'>;
  answerConfidences?: Record<number, number>;
  
  score: number;
  percentage: number;
  correctCount: number;
  incorrectCount: number;
  blankCount: number;
  doubleMarkCount: number;
  totalQuestionsGraded: number;
  isPassed: boolean;
  
  status: 'PENDING' | 'PROCESSING' | 'GRADED' | 'NEEDS_REVIEW' | 'ERROR';
  anomalies: string[];
  errorMessage?: string;
  
  rotationAngle: number;
  contrast: number;
  brightness: number;
  threshold: number;
  
  analyzedWithAI: boolean;
  timestamp: string;
}

export interface ClassStatistics {
  totalStudents: number;
  gradedStudents: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  medianScore: number;
  standardDeviation: number;
  passRate: number;
  passedCount: number;
  failedCount: number;
  questionStats: {
    questionNumber: number;
    correctCount: number;
    incorrectCount: number;
    blankCount: number;
    doubleCount: number;
    successRate: number;
    mostCommonWrongOption?: OptionLetter;
  }[];
  hardestQuestions: number[];
  easiestQuestions: number[];
}

export interface PreprocessSettings {
  autoRotate: boolean;
  deskew: boolean;
  contrast: number;
  brightness: number;
  threshold: number;
  showBinarized: boolean;
  cropTop: number;
  cropBottom: number;
  cropLeft: number;
  cropRight: number;
}
