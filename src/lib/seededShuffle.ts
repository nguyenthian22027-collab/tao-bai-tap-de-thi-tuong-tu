import { ExamData, Question } from '../types';

/**
 * Creates a deterministic pseudo-random number generator given a numeric seed
 */
function createSeededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

/**
 * Converts a string code (e.g. 'A', '101') to a numeric seed combined with today's date
 */
export function getSeedFromCode(code: string): number {
  const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const combined = `${code}_${todayStr}`;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Fisher-Yates shuffle using a seeded random function
 */
export function seededShuffleArray<T>(array: T[], seed: number): T[] {
  const result = [...array];
  const rng = createSeededRandom(seed);
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Shuffles questions and/or options deterministically based on exam version code
 */
export function shuffleExam(
  originalExam: ExamData,
  code: string,
  shuffleQuestions = true,
  shuffleOptions = true
): ExamData {
  const seed = getSeedFromCode(code);
  const rng = createSeededRandom(seed);

  const shuffledSections = originalExam.phan.map(section => {
    if (section.loai === 'tu_luan') {
      // Don't shuffle essay questions unless explicitly requested
      return section;
    }

    let questions = [...section.cauHoi];

    // 1. Shuffle questions if requested
    if (shuffleQuestions) {
      questions = seededShuffleArray(questions, seed + 101);
    }

    // 2. Shuffle options (A, B, C, D) if requested
    const updatedQuestions = questions.map(q => {
      if (q.loai !== 'trac_nghiem' || !q.optionA) return q;

      const optionKeys = ['A', 'B', 'C', 'D'] as const;
      const optionMap: { key: string; text: string; isCorrect: boolean }[] = [
        { key: 'A', text: q.optionA || '', isCorrect: q.dapAn === 'A' },
        { key: 'B', text: q.optionB || '', isCorrect: q.dapAn === 'B' },
        { key: 'C', text: q.optionC || '', isCorrect: q.dapAn === 'C' },
        { key: 'D', text: q.optionD || '', isCorrect: q.dapAn === 'D' },
      ];

      let shuffledOptions = optionMap;
      if (shuffleOptions) {
        // Seed per question for variety
        const qSeed = seed + (q.stt || 1) * 37;
        shuffledOptions = seededShuffleArray(optionMap, qSeed);
      }

      const newCorrectIndex = shuffledOptions.findIndex(o => o.isCorrect);
      const newDapAn = optionKeys[newCorrectIndex >= 0 ? newCorrectIndex : 0];

      return {
        ...q,
        optionA: shuffledOptions[0]?.text || '',
        optionB: shuffledOptions[1]?.text || '',
        optionC: shuffledOptions[2]?.text || '',
        optionD: shuffledOptions[3]?.text || '',
        dapAn: newDapAn,
      };
    });

    // Re-assign STT sequentially
    const renumbered = updatedQuestions.map((q, idx) => ({
      ...q,
      stt: idx + 1,
    }));

    return {
      ...section,
      cauHoi: renumbered,
    };
  });

  return {
    ...originalExam,
    meta: {
      ...originalExam.meta,
      tieuDe: `${originalExam.meta.tieuDe} (MÃ ĐỀ ${code})`,
    },
    phan: shuffledSections,
  };
}
