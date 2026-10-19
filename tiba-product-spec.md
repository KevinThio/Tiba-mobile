# Tiba: Product Spec (Version 1)

## Product name
Tiba

## One line description
A website for desktop and mobile where a solo clinician keeps every patient's visit notes in one place, tied to appointments, signed, easy to find again, and ready to invoice.

## Primary user
A solo clinician (such as a therapist) running their own small practice, who books patients and writes notes without any staff. Today they use Word, fillable PDFs, and Google Forms, so notes are scattered across tools and unreliable to find.

## User types and what each can do
- **Clinician (the only login):** sets up their practice (name and optional logo), adds patients, books appointments, gets an email reminder of tomorrow's appointments, records each visit's time in and time out, writes and signs notes, searches patients, downloads notes, and creates and emails invoices.
- **Patients do not log in.** They sign on the clinician's device during the visit. They may receive their invoice by email.

## Core action
Write and sign a note for a patient visit.

## Sign up and practice details
- **Sign up** asks for the clinician's name, practice name, an optional practice logo (an image, such as PNG or JPG), email, and password.
- The practice name and logo can be changed later from **Practice details** in the account menu.
- The practice name and logo form the **letterhead** at the top of every visit note and invoice, both on screen and in the PDF. With no logo, the letterhead shows the practice name only.

## Screens
1. **Appointments (calendar)**
   - Shows: a calendar with the appointments booked on each day, the chosen day's visits (with time in and time out once recorded), and a **Tomorrow** card with the number of visits booked for tomorrow.
   - User can: click a date and add an appointment (time, type of care, fee, patient, therapist name filled in automatically), add a new patient while booking, click an appointment to open its note, **email themselves tomorrow's list** right away, and **turn on an evening reminder** (6 pm in their time zone, sent to their sign-in email) listing tomorrow's appointments. Reminder emails show patients by first name and last initial only.
2. **Visit note**
   - Shows: the practice letterhead (logo and practice name) with the clinician's name, the patient, appointment date and booked time, **time in and time out**, type of care, a free text note box, and two signature areas.
   - User can: record **time in** and **time out** (one tap on the day of the visit, or type the times), write and edit the note, sign it (required before the note can be finished), collect the patient's signature (optional), and save. Once the note is signed, the note and the visit times are locked, and the time in and time out appear on the signed note and its PDF.
3. **Patient record**
   - Shows: a search bar, the chosen patient's details, and all their visits and notes in date order.
   - User can: search by patient name, update patient details, search for and add diagnosis codes, and open any note and download it as a PDF (with the practice letterhead).
4. **Invoices**
   - Shows: a list of all the clinician's past visits, filtered to the **last week, 2 weeks, month, 2 months, or 6 months**, each with its date and time, patient, type of care, time in and time out, fee, note status, and whether it's already on an invoice. Also shows recent invoices and whether each was emailed.
   - User can: filter by period and by patient name, **tick the visits to include** (one patient per invoice, with "tick all" for that patient), create the invoice (numbered with no gaps), enter an **email address to send the invoice to automatically** as a PDF (remembered for that patient's next invoice), open any invoice's PDF, and email an invoice again.

## Emails
- Sent from the practice's configured email account. Each email notes that it may contain private health information.
- **Tomorrow's appointments** go to the clinician: on request, or every evening if turned on.
- **Invoices** go to the address entered when the invoice is created (or later), with the invoice PDF attached.

## Data
| Table | Fields | Written by | Read by |
|---|---|---|---|
| Clinicians | name, practice name, practice logo (optional image), email, password, evening reminder on/off, time zone | Sign up, Practice details, Appointments | All screens, PDFs, emails |
| Patients | full name, date of birth (age is calculated), gender, address, phone, diagnosis codes, invoice email | Appointments, Patient record, Invoices | All screens |
| Diagnosis codes | code, description (a standard list, loaded once) | Nobody (fixed list) | Patient record |
| Appointments | date, time, type of care, fee, patient, clinician, time in, time out | Appointments, Visit note | Visit note, Patient record, Invoices, reminder emails |
| Notes | appointment, note text, clinician signature, patient signature, date signed | Visit note | Patient record, Invoices |
| Invoices | invoice number, patient, date created, visits included, total, emailed to, date emailed | Invoices | Invoices |

Patient records are private health information, so everything sits behind the login and must be stored securely.

## Out of scope
- Later versions, in this order: appointment reminders to patients, tracking whether invoices are paid, insurance claims
- Group practices, clinics, and hospitals (multiple logins, staff roles, permissions)
- Patient logins and online self-booking
- Fixed note templates, reports, and dashboards

## Brand notes
- Should feel calm, clinical, and friendly.
- Light green and white colour theme, with a darker green for buttons and dark grey for text so everything stays easy to read.
- Plenty of white space, and equally comfortable on a phone and a computer.
