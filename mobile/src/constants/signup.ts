/** Built-in signup options — used when API is unavailable (e.g. production backend mismatch). */
export interface UniversityOption {
  name: string;
  abbreviations: string[];
}

export const UNIVERSITY_OPTIONS: UniversityOption[] = [
  { name: 'University of Nairobi', abbreviations: ['UoN', 'UON'] },
  { name: 'Kenyatta University', abbreviations: ['KU'] },
  { name: 'Strathmore University', abbreviations: ['SU', 'Strathmore'] },
  { name: 'United States International University', abbreviations: ['USIU', 'USIU-Africa'] },
  { name: 'Jomo Kenyatta University of Agriculture and Technology', abbreviations: ['JKUAT'] },
  { name: 'Moi University', abbreviations: ['MU', 'Moi'] },
  { name: 'Egerton University', abbreviations: ['EU', 'Egerton'] },
  { name: 'Maseno University', abbreviations: ['MSU', 'Maseno'] },
  { name: 'Technical University of Kenya', abbreviations: ['TUK'] },
  { name: 'Dedan Kimathi University of Technology', abbreviations: ['DeKUT', 'DKUT'] },
  { name: 'Other', abbreviations: ['Other'] },
];

export const UNIVERSITIES = UNIVERSITY_OPTIONS.map((u) => u.name);

const ABBREVIATION_LOOKUP = new Map<string, string[]>(
  UNIVERSITY_OPTIONS.map((u) => [u.name, u.abbreviations.map((a) => a.toLowerCase())])
);

/** Match university by full name or abbreviation (e.g. UoN, JKUAT, USIU). */
export function filterUniversities(query: string, universities: string[]): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return universities;

  return universities.filter((name) => {
    if (name.toLowerCase().includes(q)) return true;
    const abbrevs = ABBREVIATION_LOOKUP.get(name) || [];
    return abbrevs.some((a) => a.includes(q) || a.replace(/[^a-z0-9]/g, '') === q.replace(/[^a-z0-9]/g, ''));
  });
}

export function getUniversityAbbreviations(name: string): string[] {
  return UNIVERSITY_OPTIONS.find((u) => u.name === name)?.abbreviations ?? [];
}

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
