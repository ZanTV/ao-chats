/** Built-in signup options — used when API is unavailable (e.g. production backend mismatch). */
export const UNIVERSITIES = [
  'University of Nairobi',
  'Kenyatta University',
  'Strathmore University',
  'United States International University',
  'Jomo Kenyatta University of Agriculture and Technology',
  'Moi University',
  'Egerton University',
  'Maseno University',
  'Technical University of Kenya',
  'Dedan Kimathi University of Technology',
  'Other',
] as const;

export const AVATAR_CATEGORIES: Record<string, string[]> = {
  animals: ['avatar-1', 'avatar-2', 'avatar-3', 'avatar-4', 'avatar-5'],
  nature: ['avatar-6', 'avatar-7', 'avatar-8', 'avatar-9', 'avatar-10'],
  technology: ['avatar-11', 'avatar-12', 'avatar-13', 'avatar-14', 'avatar-15'],
  sports: ['avatar-16', 'avatar-17', 'avatar-18', 'avatar-19', 'avatar-20'],
  education: ['avatar-21', 'avatar-22', 'avatar-23', 'avatar-24', 'avatar-25'],
  minimal: ['avatar-26', 'avatar-27', 'avatar-28', 'avatar-29', 'avatar-30'],
};

export function getLocalPasswordStrength(password: string): {
  score: number;
  label: 'weak' | 'fair' | 'good' | 'strong';
} {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const labels: Array<'weak' | 'fair' | 'good' | 'strong'> = [
    'weak',
    'weak',
    'fair',
    'good',
    'strong',
    'strong',
  ];
  return { score: Math.min(score, 5), label: labels[Math.min(score, 5)] };
}
