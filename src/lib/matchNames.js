// Loose patient-name matching between lists typed in different places, e.g. SimplyBook "yandi 1117"
// vs a folder named "Yandi Pratama". Titles (Hj, Ir, dr…) and punctuation are ignored. Two names match
// when the first word is the same, a second word (if both have one) is the same, and any phone digits
// (if both have them) are the same. Matches are suggestions: staff confirm them before anything changes.
const TITLES = new Set(['hj', 'h', 'ir', 'dr', 'drg', 'bu', 'pak', 'ibu', 'bpk', 'tn', 'ny', 'sdr']);

function parts(name) {
  const tokens = name.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  return {
    words: tokens.filter((w) => !TITLES.has(w) && !/^\d+$/.test(w)),
    digits: tokens.filter((w) => /^\d+$/.test(w)),
  };
}

export function namesMatch(a, b) {
  const pa = parts(a);
  const pb = parts(b);
  if (!pa.words.length || !pb.words.length || pa.words[0] !== pb.words[0]) return false;
  if (pa.digits.length && pb.digits.length && pa.digits[0] !== pb.digits[0]) return false;
  if (pa.words.length > 1 && pb.words.length > 1 && pa.words[1] !== pb.words[1]) return false;
  return true;
}
