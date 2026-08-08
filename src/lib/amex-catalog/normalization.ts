export function normalizeAmexSelectionText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/\+/g, " plus ")
    .replace(/\bamex\b/gi, " american express ")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/\s+/g, " ");
}
