// ─── OCR Language Support Module ─────────────────────────────────────────────
// Post-correction dictionaries and scoring for DE, FR, ES, IT, PT languages

const commonSubstitutions = [
  [/\bIl\b/g, 'Il'],
  [/\s{2,}/g, ' '],
];

const languageProfiles = {
  rus: {
    name: 'Russian',
    alphabet: /[А-Яа-яЁё]/g,
    commonWords: ['и', 'в', 'на', 'не', 'что', 'он', 'как', 'это', 'по', 'но', 'из', 'за', 'для', 'его', 'от', 'до', 'при', 'уже', 'все', 'она', 'так', 'они', 'был', 'бы', 'ещё', 'же', 'ни', 'ко', 'то', 'да'],
    fixes: [
      [/rnе/g, 'те'],
      [/rn/g, 'т'],
      [/\bпо3/g, 'поз'],
      [/0([А-Яа-я])/g, 'О$1'],
      [/([А-Яа-я])0/g, '$1О'],
    ],
  },
  eng: {
    name: 'English',
    alphabet: /[A-Za-z]/g,
    commonWords: ['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she'],
    fixes: [
      [/\brn\b/g, 'm'],
      [/\bcI\b/g, 'cl'],
      [/\btI\b/g, 'tl'],
    ],
  },
  deu: {
    name: 'German',
    alphabet: /[A-Za-zÄäÖöÜüß]/g,
    commonWords: ['der', 'die', 'und', 'in', 'den', 'von', 'zu', 'das', 'mit', 'sich', 'des', 'auf', 'für', 'ist', 'im', 'dem', 'nicht', 'ein', 'eine', 'als', 'auch', 'es', 'an', 'werden', 'aus', 'er', 'hat', 'dass', 'sie', 'nach'],
    fixes: [
      [/\brn/g, 'm'],
      [/ii/g, 'ü'],
      [/oe/g, 'ö'],
      [/ae/g, 'ä'],
      [/Ii/g, 'Ü'],
      [/\bfiir\b/g, 'für'],
      [/\bDaf3\b/g, 'Daß'],
      [/13/g, 'ß'],
    ],
  },
  fra: {
    name: 'French',
    alphabet: /[A-Za-zÀ-ÿ]/g,
    commonWords: ['de', 'la', 'le', 'et', 'les', 'des', 'en', 'un', 'du', 'une', 'que', 'est', 'dans', 'qui', 'par', 'pour', 'au', 'il', 'sur', 'pas', 'plus', 'ce', 'ne', 'ou', 'se', 'son', 'avec', 'sont', 'tout', 'mais'],
    fixes: [
      [/\brn/g, 'm'],
      [/I'/g, "l'"],
      [/c'/g, "c'"],
      [/n'/g, "n'"],
      [/\bqu '/g, "qu'"],
      [/\bl '/g, "l'"],
      [/\bd '/g, "d'"],
      [/oeu/g, 'œu'],
    ],
  },
  spa: {
    name: 'Spanish',
    alphabet: /[A-Za-záéíóúñüÁÉÍÓÚÑÜ¿¡]/g,
    commonWords: ['de', 'la', 'que', 'el', 'en', 'y', 'a', 'los', 'del', 'se', 'las', 'por', 'un', 'para', 'con', 'no', 'una', 'su', 'al', 'lo', 'como', 'más', 'pero', 'sus', 'le', 'ya', 'o', 'fue', 'este', 'ha'],
    fixes: [
      [/\brn/g, 'm'],
      [/ii/g, 'ñ'],
      [/\b;/g, '¡'],
      [/\b\?$/g, '¿'],
    ],
  },
  ita: {
    name: 'Italian',
    alphabet: /[A-Za-zÀ-ÿ]/g,
    commonWords: ['di', 'che', 'è', 'e', 'la', 'il', 'un', 'a', 'per', 'in', 'una', 'mi', 'sono', 'ho', 'non', 'lo', 'ma', 'ha', 'le', 'si', 'no', 'al', 'da', 'del', 'dei', 'con', 'come', 'io', 'ci', 'questo'],
    fixes: [
      [/\brn/g, 'm'],
      [/I'/g, "l'"],
      [/c'/g, "c'"],
      [/d'/g, "d'"],
      [/n'/g, "n'"],
      [/\bpiu\b/g, 'più'],
      [/\bperche\b/g, 'perché'],
    ],
  },
  por: {
    name: 'Portuguese',
    alphabet: /[A-Za-záàâãéèêíóòôõúçÁÀÂÃÉÈÊÍÓÒÔÕÚÇ]/g,
    commonWords: ['de', 'a', 'o', 'que', 'e', 'do', 'da', 'em', 'um', 'para', 'é', 'com', 'não', 'uma', 'os', 'no', 'se', 'na', 'por', 'mais', 'as', 'dos', 'como', 'mas', 'foi', 'ao', 'ele', 'das', 'tem', 'seu'],
    fixes: [
      [/\brn/g, 'm'],
      [/\bcao\b/g, 'ção'],
      [/cao\b/g, 'ção'],
      [/\bnao\b/gi, 'não'],
      [/\be\b(?=[a-z])/g, 'é'],
    ],
  },
};

export function getLanguageProfile(lang) {
  return languageProfiles[lang] || languageProfiles.eng;
}

export function getSupportedLanguages() {
  return Object.keys(languageProfiles);
}

export function getLanguageName(lang) {
  return languageProfiles[lang]?.name || lang;
}

export function postCorrectByLanguage(text, lang) {
  if (!text) return text;
  let out = text;
  const profile = languageProfiles[lang];
  if (!profile) return out;

  for (const [pattern, replacement] of commonSubstitutions) {
    out = out.replace(pattern, replacement);
  }
  for (const [pattern, replacement] of profile.fixes) {
    out = out.replace(pattern, replacement);
  }

  out = out.replace(/\s{2,}/g, ' ').trim();
  return out;
}

// Russian bigram frequency pairs (most common)
const russianBigrams = ['ст', 'но', 'то', 'на', 'ен', 'не', 'ов', 'ко', 'ро', 'по', 'ра', 'ер', 'ни', 'пр', 'ор', 'ре', 'ал', 'ан', 'ос', 'го', 'ед', 'ел', 'ли', 'ле', 'ка', 'ат', 'от', 'де', 'ол', 'ет'];

// English bigram frequency pairs (most common)
const englishBigrams = ['th', 'he', 'in', 'en', 'nt', 'er', 'on', 're', 'an', 'ti', 'es', 'at', 'ed', 'nd', 'to', 'or', 'ea', 'is', 'ou', 'it', 'al', 'ar', 'st', 'ng', 'te', 'se', 'ha', 'as', 'le', 'of'];

function scoreBigrams(text, bigrams) {
  if (!text || text.length < 4) return 0;
  const lower = text.toLowerCase();
  let hits = 0;
  for (const bg of bigrams) {
    if (lower.includes(bg)) hits++;
  }
  return (hits / bigrams.length) * 30;
}

function scoreCyrillicWordQuality(text) {
  if (!text) return 0;
  const words = text.match(/[А-Яа-яЁё]{2,}/g) || [];
  if (!words.length) return 0;
  let goodWords = 0;
  for (const w of words) {
    const hasVowel = /[АЕИОУЫЭЮЯаеиоуыэюяЁё]/.test(w);
    const reasonable = w.length >= 2 && w.length <= 25;
    if (hasVowel && reasonable) goodWords++;
  }
  return (goodWords / words.length) * 20;
}

function hasMixedCyrillicLatinToken(text) {
  return /[А-Яа-яЁё][A-Za-z]|[A-Za-z][А-Яа-яЁё]/.test(text);
}

export function scoreTextByLanguage(text, lang) {
  if (!text) return 0;
  const profile = languageProfiles[lang];
  if (!profile) return 0;

  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return 0;

  let score = 0;

  // Check alphabet match
  const alphaMatches = text.match(profile.alphabet) || [];
  const alphaRatio = alphaMatches.length / Math.max(1, text.replace(/\s/g, '').length);
  score += alphaRatio * 40;

  // Check common words
  const commonHits = words.filter((w) => profile.commonWords.includes(w)).length;
  const commonRatio = commonHits / Math.max(1, words.length);
  score += commonRatio * 40;

  // Bigram scoring for Russian and English
  if (lang === 'rus') {
    score += scoreBigrams(text, russianBigrams);
    score += scoreCyrillicWordQuality(text);
    if (hasMixedCyrillicLatinToken(text)) score -= 15;
  } else if (lang === 'eng') {
    score += scoreBigrams(text, englishBigrams);
    if (hasMixedCyrillicLatinToken(text)) score -= 15;
  }

  // Penalize very short garbage text
  const digits = (text.match(/[0-9]/g) || []).length;
  score += Math.min(5, digits);

  return Math.round(Math.max(0, score));
}

export function detectLanguage(text) {
  if (!text || text.length < 20) return 'eng';

  let bestLang = 'eng';
  let bestScore = 0;

  for (const lang of Object.keys(languageProfiles)) {
    const score = scoreTextByLanguage(text, lang);
    if (score > bestScore) {
      bestScore = score;
      bestLang = lang;
    }
  }

  return bestLang;
}
