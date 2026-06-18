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

// In-memory email sessions: address → { profile, turn, lastMessageId, references }
const emailSessions = new Map();

function blankEmailProfile(email) {
  return {
    id: `email_${email.replace(/[^a-z0-9]/gi, '_')}`,
    interests: [],
    interestSignals: [],
    intendedMajors: [],
    tasks: [],
    creditWallet: [],
    xp: 0,
    streak: 0,
    completedQuests: [],
    badges: [],
    channelsLinked: ['email'],
    consent: { fields: ['name', 'grade', 'location', 'interests', 'major', 'goal'], shareWithPartners: true },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// In-memory SMS sessions: phone_number → { profile, turn }
const smsSessions = new Map();

function blankSmsProfile(phone) {
  return {
    id: `sms_${phone.replace(/\D/g, '')}`,
    interests: [],
    interestSignals: [],
    intendedMajors: [],
    tasks: [],
    creditWallet: [],
    xp: 0,
    streak: 0,
    completedQuests: [],
    badges: [],
    channelsLinked: ['sms'],
    consent: { fields: ['name', 'grade', 'location', 'interests', 'major', 'goal'], shareWithPartners: true },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
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
// Body: { to: "user@example.com", subject: "...", body: "..." }
app.post('/api/send-email', async (req, res) => {
  const { to, subject, body } = req.body;

  if (!to || !body) {
    return res.status(400).json({ error: 'Missing required fields: to, body' });
  }

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'Halda <onboarding@resend.dev>',
      to,
      subject: subject || 'A message from Halda',
      text: body,
    });

    if (error) return res.status(502).json({ error: error.message });
    return res.status(201).json({ success: true, emailId: data.id });
  } catch (err) {
    return res.status(502).json({ error: err.message ?? 'Failed to send email' });
  }
});

// POST /api/webhook/sms
// Surge calls this when a user texts the Surge number. We pass the message
// through the Halda chat engine and reply via SMS.
app.post('/api/webhook/sms', async (req, res) => {
  // Acknowledge immediately so Surge doesn't retry
  res.sendStatus(200);

  const { type, data: message } = req.body ?? {};
  if (type !== 'message.received' || !message) return;

  const from = message.conversation?.contact?.phone_number;
  const text = message.body?.trim();
  if (!from || !text) return;

  // Get or create a session for this phone number
  if (!smsSessions.has(from)) {
    smsSessions.set(from, { profile: blankSmsProfile(from), turn: 0 });
  }
  const session = smsSessions.get(from);

  try {
    const chatRes = await fetch(`${HALDA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile: session.profile,
        message: text,
        turn: session.turn,
        channel: 'sms',
        revealed: session.profile.completedQuests.includes('q_constellation'),
      }),
    });

    if (!chatRes.ok) {
      console.error('Halda chat error:', await chatRes.text());
      return;
    }

    const result = await chatRes.json();

    // Merge profile patch returned by the agent
    if (result.patch) {
      session.profile = {
        ...session.profile,
        ...result.patch,
        interests: result.patch.interests ?? session.profile.interests,
        intendedMajors: result.patch.intendedMajors ?? session.profile.intendedMajors,
        updatedAt: Date.now(),
      };
    }

    // Track when schools have been revealed so subsequent turns know
    if (result.revealMatches && !session.profile.completedQuests.includes('q_constellation')) {
      session.profile.completedQuests = [...session.profile.completedQuests, 'q_constellation'];
    }

    session.turn++;

    // Reply to the user via SMS
    if (result.text) {
      await surge.messages.create(ACCOUNT_ID, { to: from, body: result.text });
    }
  } catch (err) {
    console.error('SMS webhook handler error:', err);
  }
});

// POST /api/webhook/email
// Postmark calls this when an email arrives at the inbound address.
// We run it through Halda and reply in the same thread via Resend.
app.post('/api/webhook/email', async (req, res) => {
  res.sendStatus(200);

  const payload = req.body;
  const from = payload.From;
  const subject = payload.Subject || 'Your college guide';
  const headers = payload.Headers || [];

  // Prefer StrippedTextReply on follow-up emails so we only see the new text
  const text = (payload.StrippedTextReply?.trim() || payload.TextBody?.trim());
  console.log('[email webhook] from:', from, '| text:', text?.slice(0, 60));
  if (!from || !text) { console.log('[email webhook] missing from or text, skipping'); return; }

  // RFC 2822 Message-ID of the incoming email (for threading)
  const rfcMessageId = headers.find(h => h.Name === 'Message-ID')?.Value
    || `<${payload.MessageID}@inbound.postmarkapp.com>`;
  const existingRefs = headers.find(h => h.Name === 'References')?.Value || '';

  if (!emailSessions.has(from)) {
    emailSessions.set(from, { profile: blankEmailProfile(from), turn: 0, references: '' });
  }
  const session = emailSessions.get(from);

  try {
    const chatRes = await fetch(`${HALDA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile: session.profile,
        message: text,
        turn: session.turn,
        channel: 'email',
        revealed: session.profile.completedQuests.includes('q_constellation'),
      }),
    });

    if (!chatRes.ok) { console.error('Halda chat error:', await chatRes.text()); return; }
    const result = await chatRes.json();

    if (result.patch) {
      session.profile = {
        ...session.profile,
        ...result.patch,
        interests: result.patch.interests ?? session.profile.interests,
        intendedMajors: result.patch.intendedMajors ?? session.profile.intendedMajors,
        updatedAt: Date.now(),
      };
    }
    if (result.revealMatches && !session.profile.completedQuests.includes('q_constellation')) {
      session.profile.completedQuests = [...session.profile.completedQuests, 'q_constellation'];
    }
    session.turn++;

    // Build the References chain so the thread stays linked in email clients
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
