/**
 * `<input type="date">` 用の YYYY-MM-DD を日本時間で組み立てる。
 * サーバーの TZ に依存させないことで、ハイドレーション時のズレも防ぐ。
 */
export function todayInJapan() {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}
