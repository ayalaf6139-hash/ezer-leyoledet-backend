import type { Category } from '@prisma/client';

export const CATEGORY_LABELS: Record<Category, string> = {
  MAIN: 'תבשיל',
  SALAD: 'סלט',
  DESSERT: 'קינוח',
  OTHER: 'אחר',
};

const HEBREW_LETTERS = 'אבגדהוזחטיכלמנסעפצקרשת'.split('');

/** כינוי אנונימי למשפחה בלוח השבוע: "משפחה א'", "משפחה ב'"... */
export function anonymousFamilyLabel(index: number): string {
  const letter = HEBREW_LETTERS[index];
  return letter ? `משפחה ${letter}'` : `משפחה ${index + 1}`;
}
