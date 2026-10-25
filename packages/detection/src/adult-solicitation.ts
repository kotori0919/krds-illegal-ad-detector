/** Bounded Korean service/CTA grammar; not international or legal classification. */
import { restoreText, type SourceSpan, type TextMatch } from "./text-policy.js";

// These name the service/purpose an action refers to, rather than vetoing
// ambiguous nouns such as 자료(실), 상담 or a mention of 차단 anywhere on a page.
const INFORMATION_ROLE = /성교육|보건|건강검진|도서관|전자책|도서|교육|예방|중독|치료상담|피해(?:예방|신고|보도|통계|사례)|(?:차단(?!없이|해제)|통계|단속|보도|기사|신고|사례|절차|도움말)/u;
const ACTION = /가입(?!광고)|(?:즉시|무료|무제한)시청|시청하기|지금입장|입장하기|무료체험(?:신청|제공|받기)/gu;
// Only a particle and up to two short emphasis modifiers may intervene
// between this CTA and its negation. An emphasis word alone is not a veto.
const NEGATED_ACTION = /^(?:은|는|을|를|이|가)?(?:절대로?|결코|반드시|무조건){0,2}(?:하지(?:마|말|않)|하면안|금지|불가|중단|삼가)/u;

export function adultInformationContext(raw: string): boolean {
  return INFORMATION_ROLE.test(restoreText(raw).matchText);
}

/** Sentence punctuation separates services. A dot inside a restored category
 * is a disguise; a newline within one DOM owner is banner layout, not a sentence.
 */
function sentences(raw: string, categories: TextMatch[]): SourceSpan[] {
  const result: SourceSpan[] = [];
  let start = 0;
  for (let index = 0; index < raw.length; index++) {
    if (!/[.!?。;,]/u.test(raw[index]!)) continue;
    if (raw[index] === "." && categories.some(category => category.start <= index && index < category.end)) continue;
    result.push({ start, end: index, raw: raw.slice(start, index) });
    start = index + 1;
  }
  result.push({ start, end: raw.length, raw: raw.slice(start) });
  return result;
}

export function adultSolicitations(raw: string, categories: TextMatch[]): { offers: SourceSpan[]; categories: TextMatch[] } {
  const offers: SourceSpan[] = [];
  const supported = new Set<TextMatch>();
  for (const sentence of sentences(raw, categories)) {
    const localCategories = categories.filter(category => category.start >= sentence.start && category.end <= sentence.end);
    if (!localCategories.length) continue;
    const representation = restoreText(sentence.raw);
    const units = representation.units.flatMap(unit => Array.from({ length: unit.text.length }, () => unit));
    for (const action of representation.matchText.matchAll(ACTION)) {
      const first = units[action.index]; const last = units[action.index + action[0].length - 1];
      if (!first || !last) continue;
      const after = representation.matchText.slice(action.index + action[0].length);
      if (NEGATED_ACTION.test(after)) continue;
      const actionStart = sentence.start + first.start; const actionEnd = sentence.start + last.end;
      // Bind the CTA to its nearest category in this sentence, with a bounded
      // gap. Do not borrow an unrelated enrollment action from distant text.
      const nearest = localCategories.reduce((best, category) => {
        const distance = (candidate: TextMatch): number => Math.max(0, candidate.start - actionEnd, actionStart - candidate.end);
        return distance(category) < distance(best) ? category : best;
      });
      const left = Math.min(nearest.start, actionStart); const right = Math.max(nearest.end, actionEnd);
      if (restoreText(raw.slice(left, right)).matchText.length > 64) continue;
      // A named educational/reporting service near this category/CTA pair
      // changes its target. Context in another sentence is never a veto.
      const context = raw.slice(Math.max(sentence.start, left - 24), Math.min(sentence.end, right + 24));
      if (adultInformationContext(context)) continue;
      offers.push({ start: actionStart, end: actionEnd, raw: raw.slice(actionStart, actionEnd) });
      supported.add(nearest);
    }
  }
  return { offers, categories: [...supported] };
}
