/** Preferred language from resident surname — English when unclear or for any ethnicity */

function surnameKey(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  const last = parts[parts.length - 1]?.replace(/['']/g, "'") ?? '';
  return last
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

const LANGUAGE_BY_SURNAME: Record<string, string> = {
  // French Canadian / Québécois
  tremblay: 'French',
  gagnon: 'French',
  leblanc: 'French',
  lavoie: 'French',
  roy: 'French',
  bouchard: 'French',
  desrosiers: 'French',
  cote: 'French',
  dubois: 'French',
  fournier: 'French',
  martin: 'French',

  // Chinese — Mandarin
  chen: 'Mandarin',
  li: 'Mandarin',
  wang: 'Mandarin',
  zhang: 'Mandarin',
  lee: 'Mandarin',

  // Chinese — Cantonese
  wong: 'Cantonese',
  lam: 'Cantonese',
  chow: 'Cantonese',

  // Korean
  kim: 'Korean',

  // Vietnamese
  nguyen: 'Vietnamese',

  // South Asian
  singh: 'Punjabi',
  patel: 'Punjabi',
  kumar: 'Punjabi',
  kaur: 'Punjabi',
  sharma: 'Punjabi',
  verma: 'Punjabi',

  // Arabic / Muslim (non–South Asian surnames in facility roster)
  ahmed: 'Arabic',
  ali: 'Arabic',
  hassan: 'Arabic',
  ibrahim: 'Arabic',
  malik: 'Arabic',
  khan: 'Urdu',

  // Spanish / Latin American
  garcia: 'Spanish',
  lopez: 'Spanish',
  sanchez: 'Spanish',
  hernandez: 'Spanish',
  rivera: 'Spanish',
  morales: 'Spanish',
  diaz: 'Spanish',
  cruz: 'Spanish',
  vargas: 'Spanish',
  flores: 'Spanish',
  silva: 'Spanish',

  // Italian
  rossi: 'Italian',
};

export function preferredLanguageForName(fullName: string): string {
  return LANGUAGE_BY_SURNAME[surnameKey(fullName)] ?? 'English';
}
