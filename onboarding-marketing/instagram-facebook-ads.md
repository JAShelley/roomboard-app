# RoomBoard — Instagram / Facebook Ad Copy Bank

Source positioning: landing page hero ("Never ask 'who's in room 3?' again"), trust strip (No PHI stored ·
Unlimited staff, one price · Works with your scheduler · Live in ~5 min), per-clinic/unlimited-staff pricing,
founding offer (first 40 clinics lock Advanced at $29.99/mo for life, monthly only).

Do NOT say "card required" in ad copy (standing landing-page rule). Say "14-day free trial" / "no charge
until trial ends, cancel anytime" instead.

---

## Ad Set 1 — General / broad (feed, all specialties)

**Headline:** Stop asking "who's in room 3?"
**Primary text:**
Whiteboards get erased. Group texts get buried. Walking the hall wastes your team's day.

RoomBoard is one live board your whole clinic watches — patients, providers, timers, and room status,
synced in real time across every screen. Set up in about 5 minutes, works with the scheduler you already use.

✅ Unlimited staff, one price per clinic
✅ No PHI stored
✅ 14-day free trial
**Description:** One board. Every screen. Always in sync.
**CTA button:** Start Free Trial

---

## Ad Set 2 — Founding offer / urgency (feed + story)

**Headline:** Lock in $29.99/mo for life — 40 spots only
**Primary text:**
We're opening RoomBoard to the first 40 clinics at our Advanced tier for $29.99/mo — forever. No catch,
no code needed, it applies automatically at signup.

Advanced includes custom branding, per-patient checklists, and a stats dashboard — everything you need to
stop losing track of who's where.

Once the 40 spots are gone, this price is gone too.
**Description:** Founding member pricing, locked in for life.
**CTA button:** Claim Your Spot

---

## Ad Set 3 — Veterinary-specific

**Headline:** Know which exam room every patient is in — instantly
**Primary text:**
Busy vet days shouldn't mean techs shouting down the hall or checking three different apps to find a patient.

RoomBoard puts your whole clinic — front desk, techs, DVMs — on one live board that updates in real time.
Patients, providers, wait timers, room status. One glance, not one hunt.

Works with your existing scheduler. Live in about 5 minutes.
**Description:** Built for veterinary teams that move fast.
**CTA button:** Try the Live Demo

---

## Ad Set 4 — Dental-specific

**Headline:** Every chair, every hygienist, one screen
**Primary text:**
No more sticky notes on the monitor or yelling across the hallway to find out if Op 4 is ready.

RoomBoard shows your whole team — front desk to hygienists to the doctor — exactly who's in which chair,
right now, synced across every device in the office.

Unlimited staff. One price per location. 14-day free trial.
**Description:** The live board your dental office has been missing.
**CTA button:** Start Free Trial

---

## Ad Set 5 — Physical Therapy / rehab-specific

**Headline:** Stop losing track of who's on which table
**Primary text:**
Between overlapping appointments, multiple PTs, and a packed gym floor, it's easy to lose track of where
patients are in their visit.

RoomBoard gives your clinic one live status board — patient, provider, and time-in-room, updated in real
time on every screen in the building.

Works with your existing scheduling software. Set up in minutes.
**Description:** Real-time patient flow, built for PT clinics.
**CTA button:** Learn More

---

## Ad Set 6 — Medical / Urgent Care / DO-specific

**Headline:** Your care team, always on the same page
**Primary text:**
When rooms fill up fast, a shared whiteboard or a group text can't keep up. RoomBoard replaces both with
one live board that shows patient status, provider assignment, and time-in-room across every screen —
updated the instant something changes.

No PHI stored. Unlimited staff, one price per location.
**Description:** Real-time visibility for busy practices.
**CTA button:** Start Free Trial

---

## Instagram Story / Reel variant (short, punchy — 15-20 words per frame)

**Frame 1 (hook):** "Who's in room 3?" 🙄
**Frame 2:** Stop asking. Start knowing.
**Frame 3:** RoomBoard — one live board, every screen, real time.
**Frame 4:** Unlimited staff. One price. Live in 5 min.
**CTA sticker:** Swipe up / Start Free Trial

---

## Targeting notes (not verified against actual Ads Manager — sanity-check before launch)

- **Job titles/interests:** practice owner, office manager, practice manager, clinic administrator,
  veterinarian, dentist, physical therapist, DO/osteopathic physician, urgent care.
- **Placements:** Instagram feed + stories, Facebook feed — this is a B2B SMB purchase decided by an
  owner/manager, so feed (considered) tends to outperform stories (impulse) for the offer; test both.
- **Landing destination:** point traffic at the `#demo` anchor (live interactive board) rather than the
  homepage top, per the existing "Try the live demo" CTA pattern already on the landing page.
- **Founding-offer ads specifically:** only run these once the Stripe founding coupon
  (`STRIPE_COUPON_FOUNDING`) is actually live — per [[landing-conversion-pass]] memory this was still
  pending as of 2026-06-25/07-02. Don't advertise a claim mechanism that isn't wired up yet.

## Open items I did not resolve

- ~~No real product screenshots exist~~ — **Partially resolved 2026-07-03.** Captured real desktop
  (1600x900-ish hero + live demo board, full room-card grid with timers/doctor badges) and mobile
  (375x812, same board responsive) screenshots of the actual `#demo` interactive board on the landing page
  — not AI mockups, the genuine running UI. Good enough to replace placeholders for Ad Set 1 (General) and
  the Story/Reel variant. Still missing: per-vertical screenshots (the demo board is one generic
  "Riverside Family Medicine" instance, not swapped per specialty, so Ad Sets 3-6 vet/dental/PT/medical
  still don't have a matching real visual), and no screen recording/video exists for anything beyond static
  screenshots. Founding-offer coupon (`STRIPE_COUPON_FOUNDING`) is still not set up in Stripe — see
  [[landing-conversion-pass]] — so Ad Set 2 still can't run yet either.
