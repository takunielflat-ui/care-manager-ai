/**
 * 購入ボタンのリンク先。
 * Stripeの決済リンクが決まるまでは、紹介ページ内の「準備中」の案内を指す仮のリンク。
 * 決まったら、ここを決済リンク（https://buy.stripe.com/...）に置き換える。
 */
export const PURCHASE_URL = "#purchase-pending";

/** 問い合わせ先。決まったらここを置き換える（紹介ページ・特商法・プライバシーポリシーに反映される） */
export const CONTACT_EMAIL = "【アプリ用Gmail】";
