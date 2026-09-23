import type { CardProduct } from "./api";

export function productPresentation(product: CardProduct, ru: boolean) {
  const scheme = product.scheme.toLowerCase() === "mastercard" ? "Mastercard" : "Visa";
  const name = product.name || `${scheme} ${product.currency}`;
  const isVirtual = /virtual|виртуал/i.test(`${product.code} ${product.name}`);
  const type = product.card_type === "CORPORATE" ? (ru ? "Корпоративная" : "Corporate") : ru ? "Личная" : "Personal";
  const format = isVirtual ? (ru ? "Виртуальная карта" : "Virtual card") : ru ? "Платёжная карта" : "Payment card";
  const description = isVirtual
    ? ru
      ? "Виртуальная карта прежде всего для онлайн-покупок и оплаты сервисов."
      : "A virtual card mainly for online purchases and services."
    : ru
      ? "Платёжная карта для покупок. Доступные способы оплаты зависят от условий этого продукта."
      : "A payment card for purchases. Available payment methods depend on this product's terms.";
  const features: string[] = [];
  if (product.features?.has3DS === true) features.push(ru ? "Поддержка 3‑D Secure" : "3‑D Secure support");
  if (product.features?.hasApplePay === true) features.push("Apple Pay");
  if (product.features?.hasGooglePay === true) features.push("Google Pay");
  if (product.features?.hasSpendControl === true) features.push(ru ? "Контроль расходов" : "Spending controls");
  if (product.controls?.isReloadable === true) features.push(ru ? "Можно пополнять" : "Reloadable");
  if (product.controls?.isOneTimeUse === true) features.push(ru ? "Одноразовая карта" : "Single-use card");
  return { name, type, format, description, features, scheme };
}
