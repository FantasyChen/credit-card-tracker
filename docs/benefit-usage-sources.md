# Benefit Usage Guide Sources

This file tracks source grounding for seeded `BenefitUsageWay` content. Guides are written in original wording for Perks Reminder and should avoid copying forum text directly.

## Nitan 白金 Sources Reviewed

| Topic ID | URL | Used for |
| --- | --- | --- |
| 416144 | https://www.uscardforum.com/t/topic/416144 | Broad high-end-card benefit patterns, especially the need to split hotel/travel credits by mechanism: FHR/THC, The Edit, Hilton resort/property credits, Delta Stays, United/UA hotel credits, travel portal credits, airline incidental credits, Resy, Saks, CLEAR, DoorDash/Instacart, Chase dining credits, and risk notes around refund-based workarounds. |
| 494517 | https://www.uscardforum.com/t/topic/494517 | 2026 discussion of benefit methods changing or dying, especially UA TravelBank, Southwest-style airline credits, Lululemon, Hilton Surpass/Aspire, Delta Stay, Resy, and FHR/THC rollover concerns. |
| 494419 | https://www.uscardforum.com/t/topic/494419 | Hilton Aspire/Surpass hotel credit clawback discussion and data-point format; used to add caution around refunds/cancellations and to favor real hotel usage guidance. |
| 494416 | https://www.uscardforum.com/t/topic/494416 | Hilton Aspire airline credit clawback discussion; used to add caution around direct airline refunds and distinguish legitimate airline-fee use from changing workarounds. |
| 470760 | https://www.uscardforum.com/t/topic/470760 | Dell split-payment discussion; used to ground business-service guide warnings that unusual payment flows are fragile and normal checkout is safer. |
| 486545 | https://www.uscardforum.com/t/topic/486545 | Delta Stay modification/refund discussion; used as a cautionary source for travel and hotel credits. |
| 494583 | https://www.uscardforum.com/t/topic/494583 | Amex rewards-abuse discussion; used to avoid recommending aggressive or refund-dependent behavior in user-facing guides. |

## Guide Mapping Notes

- `airline-fee-credits`: airline incidental and airline purchase credits; includes warnings that forum-reported workarounds change and may trigger clawbacks.
- `amex-fhr-thc-hotel-credit`: Amex Travel FHR/THC prepaid hotel credits; keeps THC minimum-stay and Amex Travel checkout separate from generic hotel advice.
- `chase-the-edit-hotel-credit`: Chase The Edit credits; separated because topic 416144 flags The Edit as its own flow and references cancellation/clawback risk.
- `hilton-property-credits`: Hilton Aspire resort and Surpass/Business Hilton property credits; separates resort eligibility and quarterly posting windows.
- `delta-stays-credit`: Delta Stays credits; separates the Delta hotel booking path from flight or airline-fee credits.
- `citi-travel-hotel-benefit`: Citi Travel hotel benefits with minimum-stay rules; written conservatively because topic 416144 notes limited hotel-portal DP.
- `united-hotel-travel-credits`: United purchase, United Hotels, and Renowned Hotels credits; emphasizes matching the exact channel.
- `travel-portal-credits`: broad Capital One/Chase/HSBC-style travel portal credits; includes topic 416144's airline-credit conversion discussion as risky and airline-specific rather than universal advice.
- `hotel-credits`: fallback only for hotel benefits that do not match a more specific guide.
- `saks-credit`, `lululemon-credit`, and `citi-splurge-credit`: split merchant shopping credits because enrollment, merchant lists, period windows, and gift-card behavior differ.
- `stubhub-credit` and `entertainment-credits`: split event-ticket credits from recurring digital entertainment credits.
- `delivery-grocery-credits`: DoorDash, Instacart, and Grubhub-style credits; emphasizes app membership, pickup, order minimums, and monthly expiration.
- `chase-fine-dining-credit`: separate from generic dining because eligible restaurant lists and reservation/payment channels matter.
- `uber-one-credit`, `clear-credit`, `oura-credit`, and `blacklane-credit`: account-based or merchant-specific credits that need renewal, direct-billing, and receipt tracking.
- `southwest-travel-credit`: Southwest annual travel credits; emphasizes direct booking and travel-fund expiration tracking.
- `shopping-credits`: fallback only for merchant credits that do not match a more specific guide.
- `business-service-credits`: Dell, Adobe, Indeed, wireless, shipping, office-supply, and similar business credits; emphasizes normal checkout and reconciliation.
- `dining-credits`, `resy-toast-gift-cards`, and `amex-gold-dunkin-credit`: dining, Resy, food-delivery, and Dunkin flows; written as practical usage rather than refund or abuse playbooks.
- `benefit-checklist`: non-cash perks such as certificates, passes, bonus points, companion fares, elite nights, and category activation.

When adding a new seeded benefit, update `src/lib/benefit-usage-matching.ts` if it needs a more specific guide than the current generic fallback.
