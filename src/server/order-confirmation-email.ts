function formatPrice(cents: number) {
  return new Intl.NumberFormat("nl-BE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

type OrderEmailData = {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  fulfillmentType: "pickup" | "delivery";
  pickupLabel?: string | null;
  pickupDate?: string | null;
  pickupTime?: string | null;
  addressLine1?: string | null;
  postalCode?: string | null;
  city?: string | null;
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  items: Array<{
    productName: string;
    variantName: string;
    quantity: number;
    lineTotalCents: number;
  }>;
};

function normalizeForMatch(value: string) {
  return value
    .normalize("NFD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function buildOrderConfirmationEmail(order: OrderEmailData) {
  const greetingName = order.customerName.trim() || "daar";
  const has2026Tshirt = order.items.some((item) => {
    const productName = normalizeForMatch(item.productName);
    return productName.includes("2026") && productName.includes("shirt");
  });
  const lines = order.items.map((item) => {
    const variantPart = item.variantName ? ` (${item.variantName})` : "";
    return `- ${item.productName}${variantPart} x ${item.quantity}: ${formatPrice(item.lineTotalCents)}`;
  });
  const tshirtDeliveryNote = has2026Tshirt
    ? "Als jouw T-shirt nog beschikbaar is van de eerste druk, dan zullen we deze komen leveren in regio Groot-Aalst. Woon je buiten Groot-Aalst of dient jouw T-shirt nog bijbesteld te worden, dan zal deze enkel af te halen zijn tijdens het Herderrock-weekend."
    : null;

  const fulfillmentText =
    order.fulfillmentType === "pickup"
      ? [
          "Afhalen",
          order.pickupLabel,
          [order.pickupDate, order.pickupTime].filter(Boolean).join(" "),
        ]
          .filter(Boolean)
          .join(" - ")
      : [
          "Levering",
          [order.addressLine1, order.postalCode, order.city]
            .filter(Boolean)
            .join(", "),
        ]
          .filter(Boolean)
          .join(" - ");

  const itemsHtml = order.items
    .map((item) => {
      const variantPart = item.variantName
        ? ` <span style="opacity:0.8;">(${escapeHtml(item.variantName)})</span>`
        : "";

      return `<tr>
        <td style="padding:8px 0;">${escapeHtml(item.productName)}${variantPart}</td>
        <td style="padding:8px 0; text-align:center;">${item.quantity}</td>
        <td style="padding:8px 0; text-align:right;">${escapeHtml(formatPrice(item.lineTotalCents))}</td>
      </tr>`;
    })
    .join("");

  const subject = `Bevestiging bestelling ${order.orderNumber}`;

  const text = [
    `Dag ${greetingName},`,
    "",
    "Bedankt voor je bestelling bij Herderrock.",
    `Je betaling voor bestelling ${order.orderNumber} is goed ontvangen.`,
    "",
    "Besteloverzicht:",
    ...lines,
    "",
    `Subtotaal: ${formatPrice(order.subtotalCents)}`,
    `Totaal: ${formatPrice(order.totalCents)}`,
    "",
    `Ontvangst: ${fulfillmentText}`,
    "",
    ...(tshirtDeliveryNote ? [tshirtDeliveryNote, ""] : []),
    "We sturen je later nog verdere info indien nodig.",
    "",
    "Tot binnenkort,",
    "Herderrock",
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;color:#19203B;line-height:1.6;max-width:640px;margin:0 auto;">
      <h1 style="background:#ED1C24;color:#F9EED5;padding:18px 20px;display:inline-block;margin:0 0 24px;">
        Bestelling bevestigd
      </h1>
      <p>Dag ${escapeHtml(greetingName)},</p>
      <p>
        Bedankt voor je bestelling bij Herderrock. Je betaling voor bestelling
        <strong>${escapeHtml(order.orderNumber)}</strong> is goed ontvangen.
      </p>
      <p><strong>Ontvangst:</strong> ${escapeHtml(fulfillmentText)}</p>

      <table style="width:100%;border-collapse:collapse;margin:24px 0;">
        <thead>
          <tr>
            <th style="text-align:left;padding:10px 0;border-bottom:2px solid #19203B;">Product</th>
            <th style="text-align:center;padding:10px 0;border-bottom:2px solid #19203B;">Aantal</th>
            <th style="text-align:right;padding:10px 0;border-bottom:2px solid #19203B;">Totaal</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <p style="margin:6px 0;"><strong>Subtotaal:</strong> ${escapeHtml(formatPrice(order.subtotalCents))}</p>
      <p style="margin:6px 0 24px;"><strong>Totaal:</strong> ${escapeHtml(formatPrice(order.totalCents))}</p>

      ${
        tshirtDeliveryNote
          ? `<p style="margin:0 0 24px;"><strong>Opgelet:</strong> ${escapeHtml(tshirtDeliveryNote)}</p>`
          : ""
      }

      <p>We sturen je later nog verdere info indien nodig.</p>
      <p>Tot binnenkort,<br />Herderrock</p>
    </div>
  `;

  return {
    to: order.customerEmail,
    subject,
    text,
    html,
  };
}
