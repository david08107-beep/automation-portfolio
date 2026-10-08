# Marketing Agent business and workflow review

Reviewed by simulating a grooming-business owner’s tasks in the running app: filling three Saturday appointments, responding to a serious complaint, checking in after a first visit, generating a weekly pack, editing brand settings, revisiting history, and using mobile navigation. This is a product review, not evidence of customer adoption or sales performance. Source code was inspected to distinguish intended behavior from what the app actually does. Application source was not changed during this review.

## Business assessment

The app is currently a template-based content drafting workspace. It can save typing and organize drafts, but it does not yet provide a complete marketing dashboard. There is no connection to customer records, publication, inquiries, bookings, or revenue. Suggested measures in a pack are instructions, not measured results.

Prioritize feedback, fixes, sales, income, and outcomes. Keep controls when they help attract, convert, retain, or measure customers. Replace decorative dashboard information with useful next actions, and show unavailable business data honestly.

## Confirmed findings

| Priority | Finding and evidence | Business effect | Recommended fix |
|---|---|---|---|
| Critical | The first-visit quick prompt appeared verbatim in the email: “Check in with a customer after their puppy’s first grooming visit.” | Owner must rewrite instructions before sending; customer copy is not ready. | Separate instructions from customer facts; produce a customer-facing draft and flag missing facts. |
| High | A review alleging an injury received “your visit did not meet your expectations.” | Serious concerns are handled too generically. | Recognize serious concerns, suggest personal handling, and draft an appropriate acknowledgement without inventing facts or commitments. |
| High | The third generation returned the first draft exactly. | “Try another” encourages repeated clicks without new ideas. | Label template alternatives honestly; deduplicate versions; offer targeted changes such as shorten, improve CTA, or make more specific. |
| High | With a signature line set, Bold & punchy and Polished & helpful social outputs were identical for both variants. | Tone selection can become wasted work. | Keep the tagline separate from tone-sensitive copy; hide choices that do not change the result. |
| High | Negative review templates ignored goal and tone selections. | Unnecessary settings make a simple response take longer. | Use workflow-specific controls; review replies need the review and response context, not a promotion goal. |
| High | Changing the audience did not affect social output; the audience is primarily a label in weekly packs. | Apparent targeting does not deliver useful personalization. | Make audience change wording and content decisions; explain what profile settings actually affect. |
| High | Switching from a social post to a review retained the social brief and Instagram output. | Owner can confuse old output with the newly selected workflow. | Keep separate working briefs per tool; clearly identify the displayed draft; regenerate from its own context. |
| High | Refresh discarded the unsaved brief. | Interrupted work requires re-entry. | Restore working briefs; distinguish unsaved work from saved versions. |
| High | Repeated regeneration filled history; after 22 generations only 20 remained. | Valuable drafts can be pushed out by duplicate alternatives. | Group alternatives under one creation; deduplicate; allow explicit save/favorite and deletion, with clear retention behavior. |
| Medium | Three pack captions had identical bodies after their hooks. | Weekly content can sound repetitive. | Give each asset a distinct purpose: education, proof, or booking, with matching body and CTA. |
| Medium | A tested pack was 666 words in one scrollable text block. | Finding one caption or changing one video is harder than necessary. | Separate assets into cards with individual edit/copy controls; keep whole-pack export. |
| Medium | On a 390×844 viewport the generation button started at y=864. | The owner must scroll before taking the main action. | Reduce overview height and keep creation near the top; consider a mobile action bar. |

## Duplicates and unnecessary effort

- History has three entry points: sidebar, topbar icon, and overview card. Keep one clear library link in the persistent navigation; a contextual recent-drafts section can serve a different purpose.
- Brand settings has sidebar and avatar entry points. Keep the settings link; reserve the avatar for a real user/account menu when one exists.
- Campaign idea, content calendar, and weekly pack overlap. Combine them into **Plan a campaign**, then let the owner choose which assets to produce. Keep quick standalone posts available.
- The bottom customer-story suggestion duplicates the social quick prompts. Move it into suggestions instead of adding a separate page section.
- “6 marketing workflows” counts features rather than business progress. Replace this card with an actual next action or remove it.
- “Create content” only scrolls to the current workspace; it does not start a fresh brief. Rename it or give it a clear new-draft function that preserves ongoing work.
- Editing requires opening a dialog and saving before copying. Inline editing can make routine corrections quicker while preserving versions.
- A booking-focused post asks readers both to message and to follow a booking link; Facebook adds another comment/message invitation. Choose one primary next step per asset and platform. A raw URL in an Instagram caption is not a substitute for the actual booking path used by the business.
- Downloads are useful for a full pack or backup; copy is more useful for a single post. Match the primary action to the content type.

## Keep, combine, or postpone

**Keep:** business context, real goal selection, booking path, customer-facing copy, editing, useful history, review handling, rebooking messages, mobile support.

**Combine:** campaign ideas, calendars, and weekly packs into a campaign workflow; repeated navigation controls; regeneration versions.

**Make optional:** per-draft tone changes, word/character counts except when relevant to format, long filming guidance, full-pack export.

**Postpone:** more agent tiles, invented activity metrics, automatic posting without an integration, and new suite modules before the existing modules are connected.

## Recommended dashboard

1. **Overview:** what needs attention today—draft to finish, review to answer, campaign to run, or results to log. Show empty states when there is no real data.
2. **Campaigns:** one brief → goal, audience, offer, deadline, channel, booking path → selected assets. Single posts stay quick.
3. **Customer care:** separate complaint responses, first-visit follow-ups, and rebooking messages. These have different purposes and should not inherit irrelevant promotion settings.
4. **Results:** manual or integrated logging of inquiries, bookings, attributable booked value, completed-sale revenue, campaign costs, and source. Distinguish estimates and booked value from realized revenue; show attribution limits.

## Implementation order

1. Fix instruction leakage, serious-complaint wording, stale workflow context, unsaved brief recovery, and repeated alternatives.
2. Simplify controls, navigation, mobile spacing, history grouping, and editing.
3. Make campaign assets coherent, distinct, and ready to adapt for the chosen channel.
4. Add draft/ready/published states and results logging; connect publishing and booking integrations when available.
5. Use observed business outcomes to decide whether advanced features earn their place.

## Evidence

`business-audit-observations.json` contains captured outputs and workflow observations. `business-audit-comparisons.json` contains direct comparisons confirming ineffective tone/goal settings and repeated caption bodies. Browser checks support these product findings; they do not establish sales lift.

## Changes implemented after review

The app now combines campaign, calendar, and pack into one campaign workspace. Customer care has separate review and message controls. The three history entry points and two settings entry points were reduced to one each, and the decorative overview cards and duplicate bottom suggestion were removed. Advanced voice/offer/deadline settings are optional.

Drafts are edited inline. Scripts, captions, filming guidance, strategy, and a seven-day plan are separate campaign assets. Each workflow recovers its own working brief and edits after reload. Template alternatives are labeled honestly and grouped into creations; edited versions and old history are preserved. Archive/restore is reversible. Common instruction-style briefs are rejected before generation. Serious review concerns are flagged for personal handling. Social messages use one channel-appropriate CTA, and tone remains independent of the signature line.

Results supports manual inquiries, bookings, expected booked value, completed-sale revenue, spend, editing, duplicate-period detection, undo removal, and CSV exports. Different currencies have separate totals. Empty data remains empty. These are manual records and do not establish causation, attribution, or profit. On mobile, the generation action stays accessible at the bottom of the screen.

Remaining limitations: the engine still uses two local templates, and audience adaptation is limited to explicit context rather than model-based targeting. There are no live publication, customer database, booking, attribution, or revenue integrations. The tool needs human review and does not infer every nuance of an arbitrary brief.
