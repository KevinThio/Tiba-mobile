# Tiba: Product Spec (Version 1)

## Product name
Tiba

## One line description
A website for desktop and mobile where a solo clinician keeps every patient's visit notes in one place, tied to appointments, signed, easy to find again, and ready to invoice.

## Primary user
A solo clinician (such as a therapist) running their own small practice, who books patients and writes notes without any staff. Today they use Word, fillable PDFs, and Google Forms, so notes are scattered across tools and unreliable to find.

## User types and what each can do
- **Clinician (the only login):** adds patients, books appointments, writes and signs notes, searches patients, downloads notes, and generates invoices.
- **Patients do not log in.** They sign on the clinician's device during the visit.

## Core action
Write and sign a note for a patient visit.

## Screens
1. **Appointments (calendar)**
   - Shows: a calendar with the appointments booked on each day.
   - User can: click a date and add an appointment (time, type of care, fee, patient, therapist name filled in automatically), add a new patient while booking, and click an appointment to open its note.
2. **Visit note**
   - Shows: the patient, appointment date and time, type of care, a free text note box, and two signature areas.
   - User can: write and edit the note, sign it (required before the note can be finished), collect the patient's signature (optional), and save.
3. **Patient record**
   - Shows: a search bar, the chosen patient's details, and all their visits and notes in date order.
   - User can: search by patient name, update patient details, search for and add diagnosis codes, open any note and download it as a PDF, and tick completed visits to generate an invoice as a PDF.

## Data
| Table | Fields | Written by | Read by |
|---|---|---|---|
| Clinicians | name, practice name, email, password | Sign up | All three screens |
| Patients | full name, date of birth (age is calculated), gender, address, phone, diagnosis codes | Appointments, Patient record | All three screens |
| Diagnosis codes | code, description (a standard list, loaded once) | Nobody (fixed list) | Patient record |
| Appointments | date, time, type of care, fee, patient, clinician | Appointments | Visit note, Patient record |
| Notes | appointment, note text, clinician signature, patient signature, date signed | Visit note | Patient record |
| Invoices | invoice number, patient, date created, visits included, total | Patient record | Patient record |

Patient records are private health information, so everything sits behind the login and must be stored securely.

## Out of scope
- Later versions, in this order: appointment reminders, tracking whether invoices are paid, insurance claims
- Group practices, clinics, and hospitals (multiple logins, staff roles, permissions)
- Patient logins and online self-booking
- Fixed note templates, reports, and dashboards

## Brand notes
- Should feel calm, clinical, and friendly.
- Light green and white colour theme, with a darker green for buttons and dark grey for text so everything stays easy to read.
- Plenty of white space, and equally comfortable on a phone and a computer.
