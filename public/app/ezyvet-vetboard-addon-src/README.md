# RoomBoard ezyVet Capture Addon

A Chrome/Opera extension for capturing appointments from the ezyVet calendar and sending them directly into VetBoard.

Built as a parallel addon to the Pulse capture — same badge, auth, and send flow, with ezyVet-specific parsing.

## What it does

- Shows a small green `VB` badge in the bottom-left corner of ezyVet (and any calendar page).
- Left-click `VB` to arm capture. Click it again before selecting a patient to cancel.
- Right-click `VB` to open the RoomBoard login panel.
- While armed, hover an appointment until ezyVet's appointment summary appears.
- When the ezyVet summary is outlined, click while it is visible to open the Quick Send panel and disarm capture.
- The send panel shows Owner name and Case # pulled from the ezyVet card text.
- After login, it loads your clinic rooms, types, doctors, and quick notes.
- Clicking **Send to VetBoard** writes the patient directly into the shared board.

## ezyVet-specific parsing

ezyVet calendar cards use the format:

```
"*PatientName" OwnerLastName (Species (Breed)) - CaseNumber - Reason
```

The addon extracts:
- **Patient name** — from the quoted section (strips the `*` VIP flag)
- **Owner last name** — text between the closing quote and the opening paren
- **Case number** — the 6–8 digit number after the first dash
- **Reason** — from the hover summary's REASON field before falling back to everything after the second dash
- **Notes** — the presenting problem/reason only; chart sections like Health Status, Visit Exams, Medications, and communications are ignored
- **Appointment type** — from the ezyVet hover summary or detail panel's TYPE field (e.g. `ECC- Emergency`)
- **Doctor** — from the CASE OWNER field in the hover summary or detail panel
- **Appointment time** — from the hover summary's TIME field when available

### ezyVet type → VetBoard type mapping

| ezyVet type | VetBoard label |
|---|---|
| ECC- Emergency, Emergency | Emergency |
| Wellness, Annual Exam, New Puppy/Kitten | Exam |
| ECC- Recheck, Recheck, Follow Up, Post Op | Exam |
| Surgery Consult, Surgical Referral, Specialist Consult | Sx Consult |
| Surgery, Spay, Neuter, Dental | Sx Consult |
| Tech Visit, Tech Appointment, Walk Back | Tech/Walkback |
| Illness/Injury, Sick Visit | Illness/Injury |
| Ultrasound, Echo | Ultrasound |
| Drop Off, Day Patient | Drop-Off |
| Outside Contagious, Curbside | Outside Contagious |
| Euthanasia, Quality of Life | Euthanasia |
| Work-In, Urgent Care | Work-In |

## Files

- `manifest.json` — Chrome/Opera extension manifest targeting `*.ezyvet.com`
- `background.js` — badge state for pending appointments
- `scheduler-capture.js` — badge, hover/capture, login panel, ezyVet parser, send to RoomBoard

## Install in Chrome or Opera

1. Open `chrome://extensions` (or Opera's Extensions page).
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder:
   `public/app/ezyvet-vetboard-addon-src`

Refresh the ezyVet tab after loading.

## How to use

1. Right-click the green `VB` badge → enter your RoomBoard credentials and server URL.
2. Left-click `VB` to arm capture (badge turns bright green).
3. Hover an appointment until ezyVet's appointment summary appears and the green outline moves to it.
4. Click while that summary is visible.
5. In the right-side panel, confirm the room, patient name, and type.
6. Click **Send to VetBoard**.

To cancel before picking: click `VB` again.  
To cancel after the panel opens: close the panel or click `VB`.

## Notes

- The visible ezyVet hover summary is treated as the selected appointment. Hover the appointment first, then click while the summary is visible.
- If ezyVet's DOM changes in a future update, the card text regex and hover/detail panel heuristics may need adjusting.
- The Pulse addon and this addon are independent — they share the same Supabase/RoomBoard backend but do not interfere with each other.
