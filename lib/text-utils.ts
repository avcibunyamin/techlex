export function toLocaleUpper(text: string, lang: string): string {
  if (lang === 'tr') return text.toLocaleUpperCase('tr-TR');
  return text.toUpperCase();
}
