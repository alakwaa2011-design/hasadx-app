---
name: Lemon Squeezy PayPal audits
description: Identifying PayPal payments without assuming order or invoice responses contain the payment method.
---

Use the provider subscription's `payment_processor` to identify PayPal subscriptions. In live API responses, orders and subscription invoices omitted that field even for successfully paid PayPal subscriptions. Missing payment-method fields do not establish that PayPal is unsupported or that no PayPal payment occurred.

**Why:** A read-only payment audit confirmed active PayPal subscriptions whose linked paid invoices and orders did not identify their processor.

**How to apply:** Cross-check provider subscriptions, invoices, account linkage, and the customer's receipt. Do not interpret absence under the account email as proof of nonpayment.

PayPal's transaction ID on a buyer receipt is not a Lemon Squeezy order ID. In the observed store API, orders, subscription invoices, and customers could not be searched or joined by that PayPal ID. A buyer receipt may prove a charge while the store has no corresponding order or invoice; do not fabricate a link or grant points based solely on the PayPal ID.

**Why:** A PayPal buyer receipt showed a charge to the merchant, but an exhaustive read-only store inventory, webhook records, and live logs showed no corresponding order, invoice, customer, or account grant. No API field exposed a PayPal-transaction-to-order mapping.

**How to apply:** Ask for the Lemon Squeezy order number or checkout email on the merchant receipt, or investigate the payment on the provider's merchant side with its own PayPal transaction reference. Require provider confirmation before credit changes.

Lemon Squeezy documents that PayPal subscriptions cannot be updated through its subscription API; direct customers to the customer portal for management rather than assuming the card-subscription update route also works for PayPal.

**Why:** PayPal subscription changes require customer confirmation, and the provider explicitly documents this API limitation.

**How to apply:** Recheck https://docs.lemonsqueezy.com/help/orders/paypal-subscriptions before implementing or diagnosing PayPal subscription changes.
