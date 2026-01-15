# Quiz → Booking → Sales Rep Email Integration

## Overview

When a user completes the Prism quiz and then books a consultation, the assigned sales rep should automatically receive an email containing:
- The quiz answers
- The AI-generated assessment
- Booking details

---

## How It Works

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  1. USER COMPLETES QUIZ                                                     │
│     └─► Quiz saved to Redis (quizId = "abc-123")                           │
│     └─► User sees assessment + "Book a Consultation" button                │
│                                                                             │
│  2. USER CLICKS BOOKING BUTTON                                              │
│     └─► URL: https://prism.miami/booking?QUIZID=abc-123                    │
│                                                                             │
│  3. RAY'S BOOKING PAGE                                                      │
│     └─► Extracts QUIZID from URL                                           │
│     └─► Passes to YCBM iframe                                              │
│     └─► YCBM stores in hidden field                                        │
│                                                                             │
│  4. USER COMPLETES BOOKING                                                  │
│     └─► YCBM fires webhook to our endpoint                                 │
│     └─► Payload includes: QUIZID + booking details + rep info              │
│                                                                             │
│  5. OUR WEBHOOK ENDPOINT                                                    │
│     └─► Receives webhook                                                   │
│     └─► Fetches quiz submission + assessment from Redis                    │
│     └─► Sends formatted email to assigned rep                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## PART 1: Our Side (This Repo)

### Task 1: Add "Book a Consultation" Button with Quiz ID

**File:** `app/quiz/page.tsx`

**What:** In the result view (lines 630-680), add a prominent CTA button that links to booking with the quiz ID.

**Current state:** User sees assessment with AI-generated booking link (no quiz ID attached).

**New state:** User sees assessment + explicit "Book a Consultation" button that includes `?QUIZID={result.id}`.

```tsx
// In the result view, after the Download PDF button:
<Button
  asChild
  className="bg-gradient-to-r from-orange-500 to-red-500 ..."
>
  <a
    href={`https://prism.miami/booking?QUIZID=${result.id}`}
    target="_blank"
    rel="noopener noreferrer"
  >
    Book a Free Consultation
  </a>
</Button>
```

**Why a button instead of modifying the AI output:**
- Cleaner separation of concerns
- AI doesn't need to know about URL parameters
- More prominent/reliable CTA
- User might still click AI's link (without ID) - that's okay, just means we won't have quiz data for that booking

---

### Task 2: Create Webhook Endpoint

**File:** `app/api/quiz/booking-webhook/route.ts` (new file)

**Purpose:** Receive YCBM webhook, fetch quiz data, send email to rep.

**Endpoint:** `POST /api/quiz/booking-webhook`

**Expected payload from YCBM:**
```json
{
  "quizId": "abc-123-def-456",
  "booking": {
    "startsAt": "2026-01-20T14:00:00Z",
    "endsAt": "2026-01-20T14:45:00Z",
    "timezone": "America/New_York"
  },
  "client": {
    "firstName": "Jane",
    "lastName": "Doe",
    "email": "jane@example.com",
    "phone": "+1234567890"
  },
  "rep": {
    "name": "Ray",
    "email": "ray@prism.miami"
  },
  "appointmentType": "Prism Health Introductory Call"
}
```

**Logic:**
1. Parse and validate incoming payload
2. If `quizId` is present and not empty:
   - Fetch `getQuizSubmission(quizId)`
   - Fetch `getQuizResult(quizId)`
3. Format email with all available data
4. Send to `rep.email`
5. Return 200 OK

**Edge cases:**
- No quizId → Send email with just booking details (no quiz data)
- Invalid quizId → Log warning, send email with just booking details
- Email send fails → Return 500, YCBM will retry

---

### Task 3: Set Up Email Service

**Recommended:** Resend (simple, Vercel-friendly, good free tier)

**Steps:**
1. Create Resend account at resend.com
2. Add domain verification for sending (or use Resend's test domain initially)
3. Get API key
4. Add to Vercel environment variables:
   - `RESEND_API_KEY`
5. Install package: `npm install resend`

**Alternative:** SendGrid, Postmark, or any transactional email service

---

### Task 4: Email Template

**Content to include:**

```
Subject: New Quiz Booking: {client.firstName} {client.lastName}

─────────────────────────────────────────

BOOKING DETAILS

Client: {client.firstName} {client.lastName}
Email: {client.email}
Phone: {client.phone}
Appointment: {appointmentType}
Time: {formatted date/time in rep's timezone}
Assigned To: {rep.name}

─────────────────────────────────────────

QUIZ RESPONSES

Energy Level: {energyLevel}/10
Crashes after lunch: {yes/no}
Difficulty waking: {yes/no}
Wakes at night: {yes/no} {reasons if yes}
Brain fog: {yes/no}
Bowel issues: {list or "None"}
Cold extremities: {yes/no}
White tongue coating: {yes/no}

Typical eating:
{typicalEating}

Health goals:
{healthGoals}

─────────────────────────────────────────

AI ASSESSMENT

{full assessment markdown}

─────────────────────────────────────────
```

---

### Summary: Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `app/quiz/page.tsx` | Modify | Add booking CTA button with quizId |
| `app/api/quiz/booking-webhook/route.ts` | Create | Webhook endpoint |
| `lib/email/sendRepEmail.ts` | Create | Email formatting + sending |
| `.env.local` | Modify | Add RESEND_API_KEY |
| `package.json` | Modify | Add resend dependency |

---

## PART 2: Ray's Side (YCBM Configuration)

### Task 1: Create Hidden Question for Quiz ID

**Location:** YCBM Dashboard → Booking Page → Edit Settings → Booking Form → Questions

**Steps:**
1. Add new question
2. Question type: **Hidden** (not visible to booker)
3. Label: `Quiz ID` (internal reference only)
4. Shorthand code: `QUIZID` (MUST be all caps)
5. Save

**Result:** YCBM will now accept `?QUIZID=xxx` in the URL and store it with the booking.

---

### Task 2: Ensure Quiz ID Passes from Page URL to YCBM

**Context:** The booking page at `prism.miami/booking` embeds YCBM.

**Requirement:** When someone arrives at `prism.miami/booking?QUIZID=abc123`, that parameter must reach YCBM.

**If YCBM is embedded via iframe:**
```javascript
// On the booking page, extract URL params and append to iframe src
const urlParams = new URLSearchParams(window.location.search);
const quizId = urlParams.get('QUIZID');
const iframeSrc = `https://prism.youcanbook.me/${quizId ? '?QUIZID=' + quizId : ''}`;
```

**If YCBM is embedded via script/direct:** It may automatically pick up URL parameters. Test to confirm.

---

### Task 3: Configure Webhook

**Location:** YCBM Dashboard → Booking Page → Edit Settings → Additional Options → Notifications → After new booking made

**Steps:**
1. Add new webhook
2. Configure:
   - **Delay:** 0 (immediate)
   - **URL:** `https://prism-questions.vercel.app/api/quiz/booking-webhook`
   - **Method:** POST
   - **Headers:**
     ```
     Content-Type: application/json
     ```
   - **Payload:** (see below)

**Webhook Payload:**
```json
{
  "quizId": "{QUIZID}",
  "booking": {
    "id": "{ID}",
    "startsAt": "{START-ISO8601}",
    "endsAt": "{END-ISO8601}",
    "timezone": "{TIMEZONE}"
  },
  "client": {
    "firstName": "{FNAME}",
    "lastName": "{LNAME}",
    "email": "{EMAIL}",
    "phone": "{PHONE}"
  },
  "rep": {
    "name": "{TEAM-NAME}",
    "email": "{TEAM-EMAIL}"
  },
  "appointmentType": "{TYPE-NAME}"
}
```

**Note:** Verify these shorthand codes match what's available in your YCBM account. Check YCBM's [Shorthand Code Glossary](https://support.youcanbook.me/hc/en-us/articles/17321743933719-Shorthand-code-glossary) for exact codes.

---

### Task 4: Test the Webhook

1. Make a test booking at `prism.miami/booking?QUIZID=test-123`
2. Check if webhook fires (YCBM shows webhook logs)
3. Verify our endpoint receives the payload correctly
4. Confirm email arrives to rep

---

## PART 3: The Contract (Interface Between Both Sides)

This is the agreed payload structure. Both sides must match this.

### Webhook Endpoint

```
POST https://prism-questions.vercel.app/api/quiz/booking-webhook
Content-Type: application/json
```

### Payload Schema

```typescript
interface BookingWebhookPayload {
  // From our quiz (may be empty if user didn't take quiz)
  quizId: string;

  // Booking details from YCBM
  booking: {
    id: string;
    startsAt: string;      // ISO8601
    endsAt: string;        // ISO8601
    timezone: string;      // e.g., "America/New_York"
  };

  // Client info from YCBM booking form
  client: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };

  // Assigned rep from YCBM
  rep: {
    name: string;
    email: string;
  };

  // Appointment type
  appointmentType: string;
}
```

### Response

- `200 OK` - Webhook processed successfully
- `400 Bad Request` - Invalid payload
- `500 Internal Server Error` - Processing failed (YCBM will retry)

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| User books without taking quiz (no quizId) | Email sent with booking details only, no quiz data |
| User takes quiz, refreshes, navigates to booking manually | No quizId passed, email has booking details only |
| Invalid/expired quizId | Log warning, send email with booking details only |
| Same user takes quiz multiple times | Only the quizId from the clicked link is used |
| Email service fails | Return 500, YCBM retries webhook |

---

## Testing Checklist

### Our Side
- [ ] Button appears in result view with correct URL
- [ ] Webhook endpoint accepts POST requests
- [ ] Webhook correctly fetches quiz data by ID
- [ ] Email sends successfully to rep
- [ ] Edge cases handled (missing quizId, invalid quizId)

### Ray's Side
- [ ] Hidden QUIZID field created in YCBM
- [ ] QUIZID passes from page URL to YCBM
- [ ] Webhook configured with correct URL and payload
- [ ] Test booking triggers webhook
- [ ] Payload contains all expected fields

### End-to-End
- [ ] Complete quiz → Click booking button → Complete booking → Rep receives email with full data

---

## Questions for Ray

1. **Shorthand codes:** Can you confirm the exact shorthand codes available in your YCBM account? Especially for:
   - Team/rep name and email (`{TEAM-NAME}`, `{TEAM-EMAIL}`)
   - Start/end times in ISO format (`{START-ISO8601}`, `{END-ISO8601}`)

2. **Booking page setup:** How is YCBM currently embedded on `prism.miami/booking`? (iframe, script, redirect?)

3. **Rep assignment:** How are reps assigned to bookings? Is it automatic based on calendar, or does the booker choose?

4. **Email format preference:** Plain text vs HTML? Any specific formatting requirements?
