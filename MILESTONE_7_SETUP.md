# Milestone 7 — Credits and release foundation

This is the independently buildable foundation, not a completed payment/store launch.

## Implemented

- Private, paginated credit activity reads the existing server ledger under owner-only RLS. Welcome grants, reservations, successful use and refunds have distinct explanations. Successful completion does not display a second deduction.
- Credit-pack preview explains what uses a credit and how failed generations refund it. It lists no invented packs, prices, subscriptions or active purchase/restore buttons.
- `StorePurchaseAdapter` defines the integration boundary. Its only current implementation is unavailable and rejects purchase/restore attempts. No receipt endpoint, payment webhook, SDK credentials or client credit-grant mechanism was added. A real adapter must verify receipts server-side and reconcile the authoritative wallet before reporting success.
- Typed analytics abstraction has a runtime property/value allowlist, strips undeclared fields, isolates synchronous/asynchronous provider failures, and keeps optional deduplication only in memory. The singleton has **no sink**, so it sends, logs and stores no events. No provider is connected.
- Hooks cover Explore opens/saves, successful try-on starts/observed terminal states, saved AI looks, battle create/share/vote, shopping source/product actions, paywall preview and guest onboarding. `signup_completed` is reserved until a reliable confirmed-signup event is available. These client observations are not authoritative billing or server funnel counts; production metrics require a provider/consent/retention and server-deduplication design.
- Photos & Privacy screen explains the actual private collection, explicit AI action, public battle snapshots, voting identity, deletion limits and current sample-shopping/analytics state. It is a factual test-release screen, not a substitute for the final legal privacy policy, support channel or account-deletion flow.

## Validation

The combined Node suite has 40 passing tests. New credit accounting tests execute the actual original database migration: welcome grant idempotence, repeated reservation, single provider claim, successful completion without double charge, failure/refund idempotence, owner-only ledger access and rejected client balance/ledger/RPC writes. Other new tests cover purchase failure-closed behavior and analytics field filtering/failure isolation. Two separate Deno image conversion tests remain part of release checks.

TypeScript, server checks and web/iOS/Android bundle exports are verified for the combined release. Bundles do not prove physical-device behavior. Browser checks and the final release audit are recorded in `TESTING.md` and `qa/`.

## Owner/device work still required

- Choose store approach, pack amounts/prices and launch countries. Connect Apple/Google developer accounts and the chosen receipt service (for example RevenueCat) yourself. No enrollment or paid plan is selected.
- Design the receipt ledger migration, replay-safe verified purchase grant/refund workflow, server notifications and restoration semantics against that actual provider before enabling any payment.
- Supply final support/contact and privacy terms; implement and test account-wide deletion before broader public launch.
- Decide whether analytics is needed and approve its provider, consent requirements, retention and event definitions. Current measurement is off.
- Run physical iOS/Android acceptance: camera/gallery permission denial and recovery, orientation/font scaling/safe areas, keyboards, native auth confirmation/recovery, cold session restoration, incoming shares, image result sharing, battle share sheets/clipboard and interrupted generation/refund.
- Perform store sandbox purchases/restoration only after real receipt verification is implemented. No device, store or payment test has been falsely marked complete.
