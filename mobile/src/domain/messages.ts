/**
 * Messages people send to their group chat, in English or Hinglish (how many Indian friend groups actually write).
 * Only the wording changes; names, dates, amounts and links are filled in the same way.
 */
export type Lang = 'en' | 'hinglish';

export const M = {
  invite: (l: Lang, trip: string, when: string, where: string, each: string, link: string) => l === 'hinglish'
    ? [`“${trip}” ka plan ban gaya hai! ${when}${where ? `, ${where}` : ''}.`, each ? `Abhi tak ${each} lag raha hai.` : '', `Batao aa rahe ho ya nahi, plans pe vote karo aur kharcha split karo yahan: ${link}`].filter(Boolean).join(' ')
    : [`Join “${trip}” on Tripsloom: ${when}${where ? ` in ${where}` : ''}.`, each ? `So far it’s ${each}.` : '', `Say if you’re in, add places, vote on the plan and split costs here: ${link}`].filter(Boolean).join(' '),
  nudgeHead: (l: Lang, trip: string, days: number) => l === 'hinglish'
    ? `${trip}${days > 0 ? `, sirf ${days} din baaki` : ''}! Quick ready check:`
    : `${trip}${days > 0 ? `, ${days} ${days === 1 ? 'day' : 'days'} to go` : ''}. Quick ready check:`,
  nudgeTail: (l: Lang, link: string) => (l === 'hinglish' ? `Apna tick karo yahan: ${link}` : `Tick yours here: ${link}`),
  me: (l: Lang) => (l === 'hinglish' ? 'Main' : 'Me'),
  staying: (l: Lang) => (l === 'hinglish' ? 'Rukna' : 'Staying'),
  planLink: (l: Lang) => (l === 'hinglish' ? 'Plan aur kharcha' : 'Plan and costs'),
  anyTime: (l: Lang) => (l === 'hinglish' ? 'Kabhi bhi' : 'Any time'),
  day: (l: Lang) => (l === 'hinglish' ? 'Din' : 'Day'),
  recapEach: (l: Lang, each: string) => (l === 'hinglish' ? `${each} har ek ka, sab settle Tripsloom pe` : `${each} each, all settled in Tripsloom`),
};
