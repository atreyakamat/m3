# M3 Malaria Surveillance Worker App — Final Master UI Presentation

This document presents the complete, modern, production-ready **M3 Malaria Surveillance Worker Mobile Application** for migrant construction workers under the ICMR–NIMR malaria surveillance project in Goa.

All screens are rendered at Android smartphone resolution ($412 \times 892$) with light backgrounds, rounded rectangular buttons, clear icons, and the approved colour system:
- **Teal**: Entry in Goa and registration location capture
- **Blue**: Exit from Goa
- **Red**: Not Feeling Well and symptom reporting
- **Green**: Family
- **Purple**: Roommate
- **Amber/Orange**: Transfer Site
- **Dark Navy**: Headings and important text
- **Light Grey/White**: Screen backgrounds and form fields

---

## Slide 1 — Authentication Screens (Unchanged)

The authentication screens preserve the existing working authentication, 18 Indic language selectors, and 2-step registration with Goa worksite selection.

| 1. Sign In | 2. Choose Language | 3. Sign Up / Register |
| :---: | :---: | :---: |
| ![Sign In](./screenshots/final/slide1_01_sign_in.png) | ![Choose Language](./screenshots/final/slide1_02_choose_language.png) | ![Sign Up](./screenshots/final/slide1_03_sign_up.png) |

---

## Slide 2 — Updated Dashboard → Entry in Goa

The worker dashboard features exactly **six primary actions** in the approved arrangement. Selecting **Entry in Goa** (Top-Right, Teal) opens the streamlined arrival screen with origin selection, travel reason, device GPS location capture, and automatic background timestamping.

| 1. Updated Dashboard (Top-Right: Entry in Goa) | 2. Entry in Goa Screen |
| :---: | :---: |
| ![Dashboard](./screenshots/final/slide2_01_dashboard.png) | ![Entry in Goa](./screenshots/final/slide2_02_entry_in_goa.png) |

---

## Slide 3 — Updated Dashboard → Exit from Goa

Selecting **Exit from Goa** (Top-Left, Blue) opens the departure screen with destination selection, departure reason (Work Completed, Vacation, etc.), device GPS location capture, and automatic background timestamping.

| 1. Updated Dashboard (Top-Left: Exit from Goa) | 2. Exit from Goa Screen |
| :---: | :---: |
| ![Dashboard](./screenshots/final/slide2_01_dashboard.png) | ![Exit from Goa](./screenshots/final/slide3_02_exit_from_goa.png) |

---

## Slide 4 — Updated Dashboard → Direct Add Family Member Form

Selecting **Family** (Middle-Right, Green) directly displays the single-screen **Add Family Member form** (Name, Relationship, Age). No unnecessary list or extra screens.

| 1. Updated Dashboard (Middle-Right: Family) | 2. Direct Add Family Member Form |
| :---: | :---: |
| ![Dashboard](./screenshots/final/slide2_01_dashboard.png) | ![Add Family Member](./screenshots/final/slide4_02_add_family_member.png) |

---

## Slide 5 — Updated Dashboard → Direct Add Roommate Form

Selecting **Roommate** (Bottom-Left, Purple) directly displays the single-screen **Add Roommate form** with only essential fields: Name and Age (no phone, no Aadhaar, no gender required).

| 1. Updated Dashboard (Bottom-Left: Roommate) | 2. Direct Add Roommate Form |
| :---: | :---: |
| ![Dashboard](./screenshots/final/slide2_01_dashboard.png) | ![Add Roommate](./screenshots/final/slide5_02_add_roommate.png) |

---

## Slide 6 — Updated Dashboard → Single-Screen Not Feeling Well Form

Selecting **Not Feeling Well** (Middle-Left, Red) opens a combined, single-screen reporting form:
1. **Who is feeling unwell**: Conditional options (Self always visible; Family shown only when family records exist; Roommate shown only when roommates exist).
2. **Approved Symptoms**: 7 multi-select symptom cards (Fever, Chills, Headache, Sweating, Body ache, Nausea, Weakness).
3. **Optional Voice Recording**: Integrated mic recorder with live timer, playback, and re-record.
4. **Device Location**: Embedded GPS capture card with automatic timestamping.
5. **Non-Diagnostic Policy**: Enforces clinical advisory disclaimer without automated diagnosis.

| 1. Updated Dashboard (Middle-Left: Not Feeling Well) | 2. Combined Single-Screen Symptom Reporting |
| :---: | :---: |
| ![Dashboard](./screenshots/final/slide2_01_dashboard.png) | ![Not Feeling Well](./screenshots/final/slide6_02_not_feeling_well.png) |

---

## Slide 7 — Updated Dashboard → Transfer Site

Selecting **Transfer Site** (Bottom-Right, Amber/Orange) displays the worker's current assigned worksite, searchable destination site picker, device location capture, and status tracking under the approved multi-stage contractor clearance protocol.

| 1. Updated Dashboard (Bottom-Right: Transfer Site) | 2. Transfer Site Screen |
| :---: | :---: |
| ![Dashboard](./screenshots/final/slide2_01_dashboard.png) | ![Transfer Site](./screenshots/final/slide7_02_transfer_site.png) |

---

## Slide 8 — Post-Registration Device Location Capture Screen

Immediately after successful worker account registration in Sign Up, the application transitions to this dedicated post-registration location capture step. It requests GPS permission, records coordinates with the registration timestamp, displays a clear location-captured state, and provides a graceful fallback before continuing to the dashboard.

| Post-Registration Location Capture Step (Registration Step 2 of 2) |
| :---: |
| ![Post-Registration Location](./screenshots/final/slide8_01_register_location.png) |

---

### Media & Connected Journey Recording
- **Connected Worker Journey Recording (MP4)**: `artifacts/recordings/connected_worker_journey.mp4`
- **Connected Worker Journey Recording (WebM)**: `artifacts/recordings/connected_worker_journey.webm`
- **All Final Screen Captures**: `artifacts/screenshots/final/`
