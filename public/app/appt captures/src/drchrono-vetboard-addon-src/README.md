# VetBoard DrChrono Capture

Starter appointment-capture extension for DrChrono.

This tool is intentionally separate from the Pulse and ezyVet captures. It uses the same VetBoard Quick Add/send flow, but the parser is a first-pass medical/dental capture that targets visible appointment cards and appointment detail flyouts/panels.

## Current capture strategy

1. Load this folder as an unpacked extension in Chromium/Chrome.
2. Open the DrChrono schedule/calendar page.
3. Click the floating `VB` badge to arm capture.
4. Click an appointment card. The extension lets the app open its appointment detail panel, reads visible patient/provider/time/type/reason fields, then opens the VetBoard send modal.

## Expected fields

- Patient/client name
- Appointment time/date when visible
- Provider/clinician/therapist/appointment provider when visible
- Service/procedure/appointment type when visible
- Reason/chief complaint/visit reason/appointment memo when visible
- Dental room/operatory/chair/location when visible

Because this was built from public UI research and not a live DrChrono account, the selectors are conservative. Tighten the parser against a real clinic login once you can test it.
