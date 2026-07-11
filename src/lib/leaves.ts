/** Types d'absence et statistiques associées. */

export const LEAVE_KINDS = ['annual', 'training'] as const;
export type LeaveKind = (typeof LEAVE_KINDS)[number];

export const LEAVE_LABEL: Record<LeaveKind, string> = {
  annual: 'Congé annuel',
  training: 'Formation',
};

export const LEAVE_SHORT: Record<LeaveKind, string> = {
  annual: 'CA',
  training: 'Formation',
};

export interface CountableLeave {
  kind: LeaveKind;
  hours: number | null;
}

export interface LeaveStats {
  annualDays: number;
  trainingDays: number;
  trainingHours: number;
}

export function computeLeaveStats(leaves: CountableLeave[]): LeaveStats {
  let annualDays = 0;
  let trainingDays = 0;
  let trainingHours = 0;
  for (const l of leaves) {
    if (l.kind === 'annual') annualDays += 1;
    else {
      trainingDays += 1;
      trainingHours += l.hours ?? 0;
    }
  }
  return { annualDays, trainingDays, trainingHours };
}
