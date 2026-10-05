---
name: Lemon Squeezy PayPal audits
description: Identifying PayPal payments without assuming order or invoice responses contain the payment method.
---

Use the provider subscription's `payment_processor` to identify PayPal subscriptions. In live API responses, orders and subscription invoices omitted that field even for successfully paid PayPal subscriptions. Missing payment-method fields do not establish that PayPal is unsupported or that no PayPal payment occurred.

**Why:** A read-only payment audit confirmed active PayPal subscriptions whose linked paid invoices and orders did not identify their processor.

**How to apply:** Cross-check provider subscriptions, invoices, account linkage, and the customer's receipt. Do not interpret absence under the account email as proof of nonpayment.

Lemon Squeezy documents that PayPal subscriptions cannot be updated through its subscription API; direct customers to the customer portal for management rather than assuming the card-subscription update route also works for PayPal.

**Why:** PayPal subscription changes require customer confirmation, and the provider explicitly documents this API limitation.

**How to apply:** Recheck https://docs.lemonsqueezy.com/help/orders/paypal-subscriptions before implementing or diagnosing PayPal subscription changes.
