# ⚠️ DEPRECATED — DO NOT USE

**Status:** This connector has been **pulled by Strider Labs as of June 5, 2026.**

## Why

This package automated Venmo / PayPal / Cash App access using browser automation with user credentials. We have concluded this is unsafe for users:

1. **Terms of Service.** Automated/unauthorized access violates the user agreements of these services.
2. **Account suspension risk.** These platforms can — and do — permanently suspend accounts they suspect of automation, and may freeze funds and linked bank accounts. Appeals are difficult or impossible.
3. **Credential exposure.** Storing financial-service credentials in MCP client configs creates an unacceptable security surface.
4. **Regulatory category.** Money-transmitter services operate under fraud-prevention regimes (BSA/AML) that are fundamentally hostile to bot traffic — different from commerce platforms.

## Strider Labs policy

We do not ship credential-handover MCP connectors for regulated financial services. Strider Labs builds connectors for commerce platforms (food delivery, travel, reservations) that work with — not against — the operator's terms.

## If you used this package

- Stop running it.
- Rotate your account password.
- Review recent Venmo/PayPal/Cash App activity for anything you didn't authorize.
- If your account was flagged, contact the platform's support — we cannot intervene.

## What's next

We are evaluating safer architectures (OAuth-only, no credential handover, sanctioned partner APIs) for financial connectors. We will not re-publish browser-automation versions.

— Strider Labs, June 5, 2026
