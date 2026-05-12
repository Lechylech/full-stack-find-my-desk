import express from 'express';
import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-sonnet-4-6';
const MAX_ITERATIONS = 10;
const MAX_TOKENS = 4096;

export function createChatRouter({ port }) {
  const router = express.Router();
  const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
  const SELF_BASE = `http://127.0.0.1:${port}/api`;

  const TOOLS = [
    {
      name: 'list_desks',
      description: 'List desks for a given date with their current state (available, booked, active), zone, floor, and attributes. Use this to find candidate desks before booking. Filter by floor or availability to keep the response small.',
      input_schema: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Booking date in YYYY-MM-DD format' },
          floor: { type: 'string', enum: ['ground', 'first'], description: 'Optional floor filter' },
          zone: { type: 'string', description: 'Optional zone filter (e.g. "Windows", "Support", "Virtualisation")' },
          availableOnly: { type: 'boolean', description: 'If true, only return desks that are currently available' },
          hotDeskOnly: { type: 'boolean', description: 'If true, only return desks flagged as hot-desks' },
          wheelchairOnly: { type: 'boolean', description: 'If true, only return wheelchair-accessible desks' },
        },
        required: ['date'],
      },
    },
    {
      name: 'get_suggestions',
      description: 'Get personalised desk suggestions for the current user on a given date. Prefers desks near teammates and matching the user\'s preferences (dual-monitor, quiet zone, near window, height adjustable, accessibility). Also returns a list of hot-desk zones with availability as a fallback.',
      input_schema: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Booking date in YYYY-MM-DD format' },
        },
        required: ['date'],
      },
    },
    {
      name: 'create_booking',
      description: 'Book a specific desk for the current user. Use a deskId returned by list_desks or get_suggestions. Defaults to 9:00-17:00 if hours are not specified. Confirm with the user before calling this unless they have already picked a specific desk and time.',
      input_schema: {
        type: 'object',
        properties: {
          deskId: { type: 'string', description: 'Desk id (e.g. "G-005")' },
          date: { type: 'string', description: 'Booking date in YYYY-MM-DD format' },
          startHour: { type: 'integer', description: 'Start hour 0-23 (default 9)' },
          endHour: { type: 'integer', description: 'End hour 0-24 (default 17). Must be > startHour.' },
        },
        required: ['deskId', 'date'],
      },
    },
  ];

  async function callTool(name, input, viewerId) {
    try {
      if (name === 'list_desks') {
        const url = `${SELF_BASE}/desks?date=${encodeURIComponent(input.date)}&viewerId=${encodeURIComponent(viewerId)}`;
        const r = await fetch(url);
        if (!r.ok) return { error: `list_desks failed: ${r.status}` };
        let desks = await r.json();
        if (input.floor) desks = desks.filter((d) => d.floor === input.floor);
        if (input.zone) desks = desks.filter((d) => d.zone === input.zone);
        if (input.availableOnly) desks = desks.filter((d) => d.state === 'available');
        if (input.hotDeskOnly) desks = desks.filter((d) => d.hotDesk);
        if (input.wheelchairOnly) desks = desks.filter((d) => d.attributes?.wheelchairAccess);
        // Trim to essentials so we don't waste tokens.
        return desks.slice(0, 60).map((d) => ({
          id: d.id,
          label: d.label,
          floor: d.floor,
          zone: d.zone,
          state: d.state,
          hotDesk: !!d.hotDesk,
          attrs: d.attributes,
          occupant: d.occupant?.fullName || null,
        }));
      }
      if (name === 'get_suggestions') {
        const url = `${SELF_BASE}/suggestions?userId=${encodeURIComponent(viewerId)}&date=${encodeURIComponent(input.date)}`;
        const r = await fetch(url);
        if (!r.ok) return { error: `get_suggestions failed: ${r.status}` };
        const body = await r.json();
        return {
          suggestions: (body.suggestions || []).map((s) => ({
            id: s.id, label: s.label, zone: s.zone, floor: s.floor,
            hotDesk: !!s.hotDesk, reason: s.reason,
          })),
          hotDeskFallback: body.hotDeskFallback || [],
        };
      }
      if (name === 'create_booking') {
        const payload = {
          deskId: input.deskId,
          userId: viewerId,
          actorId: viewerId,
          date: input.date,
          startHour: Number.isFinite(input.startHour) ? input.startHour : 9,
          endHour: Number.isFinite(input.endHour) ? input.endHour : 17,
        };
        const r = await fetch(`${SELF_BASE}/bookings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const body = await r.json();
        if (!r.ok) return { success: false, error: body.error || `Booking failed (${r.status})` };
        return { success: true, bookingId: body.id, deskId: body.deskId, date: body.date, startHour: body.startHour, endHour: body.endHour };
      }
      return { error: `Unknown tool: ${name}` };
    } catch (e) {
      return { error: String(e?.message || e) };
    }
  }

  router.get('/health', (_req, res) => {
    res.json({ enabled: !!client, model: client ? MODEL : null });
  });

  router.post('/', async (req, res) => {
    if (!client) {
      return res.status(503).json({
        error: 'AI agent is not configured. Set ANTHROPIC_API_KEY in your .env file to enable it.',
      });
    }
    const { userId, messages: clientMessages, userName } = req.body || {};
    if (!userId || !Array.isArray(clientMessages)) {
      return res.status(400).json({ error: 'userId and messages array are required' });
    }

    const today = new Date().toISOString().slice(0, 10);
    const systemPrompt = `You are a friendly desk-booking assistant inside the Spacio app. The current user is ${userName || 'a colleague'} (user id: ${userId}). Today is ${today}.

You have three tools:
- list_desks: list desks for a date with their state, zone, floor, hot-desk flag, and accessibility. Use filters to keep responses small (floor, zone, availableOnly, hotDeskOnly, wheelchairOnly).
- get_suggestions: personalised recommendations near teammates plus a hot-desk fallback. Prefer this when the user is open to suggestions.
- create_booking: book a specific desk. Defaults to 9:00-17:00.

Rules:
- Default to today's date when the user doesn't specify one.
- Always identify a desk by its label (e.g. G005), zone (e.g. Windows), and floor (Ground/First) when proposing it.
- Don't dump full desk lists at the user — summarise. Surface 2-3 strong candidates.
- Confirm with the user before calling create_booking, unless they already named the desk and time.
- If a tool returns an error, explain it in plain language and offer the most useful next step (e.g. try another time, try another zone).
- Be concise. Aim for under 4 sentences per reply unless the user asks for detail.
- You only book for the current user; do not ask whose desk to book.`;

    const conversation = clientMessages.slice();
    const usage = { input: 0, output: 0, cacheRead: 0, cacheCreate: 0 };
    const toolTrace = [];

    try {
      for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
        const response = await client.messages.create({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
          tools: TOOLS,
          messages: conversation,
        });

        usage.input += response.usage.input_tokens || 0;
        usage.output += response.usage.output_tokens || 0;
        usage.cacheRead += response.usage.cache_read_input_tokens || 0;
        usage.cacheCreate += response.usage.cache_creation_input_tokens || 0;

        conversation.push({ role: 'assistant', content: response.content });

        if (response.stop_reason !== 'tool_use') {
          const text = response.content
            .filter((b) => b.type === 'text')
            .map((b) => b.text)
            .join('\n')
            .trim();
          return res.json({
            reply: text || '(no reply)',
            messages: conversation,
            usage,
            toolTrace,
            stopReason: response.stop_reason,
          });
        }

        const toolResults = [];
        for (const block of response.content) {
          if (block.type !== 'tool_use') continue;
          const result = await callTool(block.name, block.input, userId);
          toolTrace.push({
            name: block.name,
            input: block.input,
            summary: summarise(result),
          });
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(result),
            is_error: !!result?.error,
          });
        }
        conversation.push({ role: 'user', content: toolResults });
      }
      return res.status(500).json({ error: 'Agent exceeded max tool-use iterations' });
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError) {
        return res.status(429).json({ error: 'Anthropic rate limit hit — try again in a moment.' });
      }
      if (e instanceof Anthropic.AuthenticationError) {
        return res.status(401).json({ error: 'Anthropic API key is invalid. Check ANTHROPIC_API_KEY.' });
      }
      if (e instanceof Anthropic.APIError) {
        return res.status(502).json({ error: `Anthropic API error (${e.status}): ${e.message}` });
      }
      return res.status(500).json({ error: String(e?.message || e) });
    }
  });

  return router;
}

function summarise(result) {
  if (!result) return 'no result';
  if (Array.isArray(result)) return `${result.length} desk(s)`;
  if (result.error) return `error: ${result.error}`;
  if (result.success === true) return `booked ${result.deskId || ''}`.trim();
  if (Array.isArray(result.suggestions)) return `${result.suggestions.length} suggestion(s)`;
  return 'ok';
}
