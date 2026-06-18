import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import Surge from '@surgeapi/node';
import { Resend } from 'resend';
import postmark from 'postmark';

const app = express();
const PORT = process.env.PORT || 3001;

const surge = new Surge({ apiKey: process.env.SURGE_API_KEY });
const ACCOUNT_ID = process.env.SURGE_ACCOUNT_ID;
const HALDA_URL = process.env.HALDA_URL || 'http://localhost:3000';
const resend = new Resend(process.env.RESEND_API_KEY);
const postmarkClient = new postmark.ServerClient(process.env.POSTMARK_API_TOKEN);
const POSTMARK_INBOUND = process.env.POSTMARK_INBOUND_ADDRESS;
const POSTMARK_FROM = process.env.POSTMARK_FROM || 'jensshumway@greatergas.com';

// Cross-channel sessions: key (phone or email) → { studentId, turn, revealed, newProfile? }
// newProfile is only set on the first message for a brand-new student — it's passed
// inline to /api/chat so the store upserts it, then dropped from the session.
const smsSessions = new Map();
const emailSessions = new Map();

async function lookupStudent(key, type) {
  try {
    const param = type === 'phone' ? `phone=${encodeURIComponent(key)}` : `email=${encodeURIComponent(key)}`;
    const res = await fetch(`${HALDA_URL}/api/students/lookup?${param}`);
    if (res.ok) {
      const { studentId, profile } = await res.json();
      return { studentId, profile };
    }
  } catch {}
  return null;
}

function blankProfile(id, channelField, channelValue) {
  return {
    id,
    [channelField]: channelValue,
    interests: [],
    interestSignals: [],
    intendedMajors: [],
    tasks: [],
    creditWallet: [],
    xp: 0,
    streak: 0,
    completedQuests: [],
    badges: [],
    channelsLinked: [channelField === 'phone' ? 'sms' : 'email'],
    consent: { fields: ['name', 'grade', 'location', 'interests', 'major', 'goal'], shareWithPartners: true },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

async function chatWithHalda(session, message, channel) {
  const body = session.newProfile
    ? { profile: session.newProfile, message, turn: session.turn, channel, revealed: session.revealed }
    : { studentId: session.studentId, message, turn: session.turn, channel, revealed: session.revealed };

  const res = await fetch(`${HALDA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Halda chat error: ${await res.text()}`);
  const result = await res.json();

  // After the first call the profile is in the store — stop sending it inline
  delete session.newProfile;
  if (result.revealMatches) session.revealed = true;
  session.turn++;

  return result;
}

app.use(cors());
app.use(express.json());

// POST /api/send-sms
// Body: { to: "+18015551234", body: "Your message here" }
app.post('/api/send-sms', async (req, res) => {
  const { to, body } = req.body;

  if (!to || !body) {
    return res.status(400).json({ error: 'Missing required fields: to, body' });
  }

  // Basic E.164 format check
  if (!/^\+[1-9]\d{7,14}$/.test(to)) {
    return res.status(400).json({ error: 'Invalid phone number. Use E.164 format (e.g. +18015551234)' });
  }

  try {
    const message = await surge.messages.create(ACCOUNT_ID, { to, body });
    return res.status(201).json({ success: true, messageId: message.id });
  } catch (err) {
    const status = err.status ?? 502;
    const detail = err.error?.message ?? err.message ?? 'Failed to send message';
    return res.status(status).json({ error: detail });
  }
});

// GET /api/messages
// Query params: after, before (pagination cursors), phone, name (client-side filters)
app.get('/api/messages', async (req, res) => {
  const { after, before, phone, name } = req.query;

  try {
    const result = await surge.messages.list(ACCOUNT_ID, {
      ...(after && { after }),
      ...(before && { before }),
    });

    let messages = result.data ?? [];

    if (phone) {
      messages = messages.filter(m => m.conversation?.contact?.phone_number === phone);
    }

    if (name) {
      const lower = name.toLowerCase();
      messages = messages.filter(m => {
        const contact = m.conversation?.contact;
        if (!contact) return false;
        const full = `${contact.first_name ?? ''} ${contact.last_name ?? ''}`.toLowerCase();
        return full.includes(lower);
      });
    }

    return res.status(200).json({ data: messages, pagination: result.pagination });
  } catch (err) {
    const status = err.status ?? 502;
    const detail = err.error?.message ?? err.message ?? 'Failed to list messages';
    return res.status(status).json({ error: detail });
  }
});

// GET /api/messages/:id
// Returns a single message by its Surge message ID
app.get('/api/messages/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const message = await surge.messages.retrieve(id);
    return res.status(200).json(message);
  } catch (err) {
    const status = err.status ?? 502;
    const detail = err.error?.message ?? err.message ?? 'Failed to retrieve message';
    return res.status(status).json({ error: detail });
  }
});

// POST /api/send-email
// Body: { to: "user@example.com", subject: "...", body: "...", html?: "..." }
app.post('/api/send-email', async (req, res) => {
  const { to, subject, body, html } = req.body;

  if (!to || (!body && !html)) {
    return res.status(400).json({ error: 'Missing required fields: to, body' });
  }

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'Halda <onboarding@resend.dev>',
      to,
      subject: subject || 'A message from Halda',
      ...(html ? { html, text: body || '' } : { text: body }),
    });

    if (error) return res.status(502).json({ error: error.message });
    return res.status(201).json({ success: true, emailId: data.id });
  } catch (err) {
    return res.status(502).json({ error: err.message ?? 'Failed to send email' });
  }
});

// POST /api/webhook/sms
// Surge calls this when a user texts the Surge number. We look up the student
// by phone (cross-channel continuity), then pass the message through Halda and reply.
app.post('/api/webhook/sms', async (req, res) => {
  res.sendStatus(200);

  const { type, data: message } = req.body ?? {};
  if (type !== 'message.received' || !message) return;

  const from = message.conversation?.contact?.phone_number;
  const text = message.body?.trim();
  if (!from || !text) return;

  // Re-check on every turn: if the user linked their phone on the web since
  // the session was created, switch to that richer web profile immediately.
  const freshLookup = await lookupStudent(from, 'phone');
  if (freshLookup) {
    const cached = smsSessions.get(from);
    if (!cached || cached.studentId !== freshLookup.studentId) {
      smsSessions.set(from, {
        studentId: freshLookup.studentId,
        turn: cached?.turn ?? 0,
        revealed: freshLookup.profile.completedQuests?.includes('q_constellation') ?? false,
      });
    }
  } else if (!smsSessions.has(from)) {
    const id = `sms_${from.replace(/\D/g, '')}`;
    smsSessions.set(from, {
      studentId: id,
      turn: 0,
      revealed: false,
      newProfile: blankProfile(id, 'phone', from),
    });
  }
  const session = smsSessions.get(from);

  try {
    const result = await chatWithHalda(session, text, 'sms');
    if (result.text) {
      await surge.messages.create(ACCOUNT_ID, { to: from, body: result.text });
    }
  } catch (err) {
    console.error('SMS webhook handler error:', err);
  }
});

// POST /api/webhook/email
// Postmark calls this when an email arrives. We look up the student by email
// (cross-channel continuity), run it through Halda, and reply via Resend.
app.post('/api/webhook/email', async (req, res) => {
  res.sendStatus(200);

  const payload = req.body;
  const from = payload.From;
  const subject = payload.Subject || 'Your college guide';
  const headers = payload.Headers || [];

  const text = (payload.StrippedTextReply?.trim() || payload.TextBody?.trim());
  console.log('[email webhook] from:', from, '| text:', text?.slice(0, 60));
  if (!from || !text) { console.log('[email webhook] missing from or text, skipping'); return; }

  const rfcMessageId = headers.find(h => h.Name === 'Message-ID')?.Value
    || `<${payload.MessageID}@inbound.postmarkapp.com>`;
  const existingRefs = headers.find(h => h.Name === 'References')?.Value || '';

  // Re-check on every turn: if the user linked their email on the web since
  // the session was created, switch to that richer web profile immediately.
  const freshLookup = await lookupStudent(from, 'email');
  if (freshLookup) {
    const cached = emailSessions.get(from);
    if (!cached || cached.studentId !== freshLookup.studentId) {
      emailSessions.set(from, {
        studentId: freshLookup.studentId,
        turn: cached?.turn ?? 0,
        revealed: freshLookup.profile.completedQuests?.includes('q_constellation') ?? false,
        references: cached?.references ?? '',
      });
    }
  } else if (!emailSessions.has(from)) {
    const id = `email_${from.replace(/[^a-z0-9]/gi, '_')}`;
    emailSessions.set(from, {
      studentId: id,
      turn: 0,
      revealed: false,
      newProfile: blankProfile(id, 'email', from),
      references: '',
    });
  }
  const session = emailSessions.get(from);

  try {
    const result = await chatWithHalda(session, text, 'email');

    const newReferences = [existingRefs, rfcMessageId].filter(Boolean).join(' ').trim();
    session.references = newReferences;

    const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;

    console.log('[email webhook] sending reply to:', from, '| text:', result.text?.slice(0, 60));
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'Halda <onboarding@resend.dev>',
      to: process.env.EMAIL_OVERRIDE || from,
      replyTo: POSTMARK_INBOUND,
      subject: replySubject,
      text: result.text,
      headers: {
        'In-Reply-To': rfcMessageId,
        'References': newReferences,
      },
    });
    if (emailError) console.error('[email webhook] Resend error:', emailError);
    else console.log('[email webhook] reply sent, id:', emailData?.id);
  } catch (err) {
    console.error('Email webhook handler error:', err);
  }
});

app.listen(PORT, () => {
  console.log(`SMS backend running on port ${PORT}`);
});
