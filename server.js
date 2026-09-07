const path = require('path');
const express = require('express');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

app.use(express.json({ limit: '64kb' }));
app.use(express.static(path.join(__dirname)));

function cleanMoney(money = {}) {
  return {
    month: String(money.month || ''),
    income: Number(money.income || 0),
    expenses: Number(money.expenses || 0),
    budget: Number(money.budget || 0),
    balance: Number(money.balance || 0),
    categories: Array.isArray(money.categories) ? money.categories.slice(0, 10).map(x => ({
      category: String(x.category || ''), amount: Number(x.amount || 0)
    })) : [],
    transactions: Array.isArray(money.transactions) ? money.transactions.slice(-60).map(x => ({
      type: String(x.type || ''), amount: Number(x.amount || 0), category: String(x.category || ''),
      note: String(x.note || '').slice(0, 100), date: String(x.date || '')
    })) : []
  };
}

app.post('/api/ai-coach', async (req, res) => {
  if (!client) return res.status(503).json({ error: 'AI is not configured on this server.' });

  const message = String(req.body?.message || '').trim();
  if (!message) return res.status(400).json({ error: 'Please enter a question.' });

  const history = Array.isArray(req.body?.history) ? req.body.history.slice(-10).map(x => ({
    role: x.role === 'assistant' ? 'assistant' : 'user',
    content: String(x.content || '').slice(0, 2000)
  })) : [];
  const money = cleanMoney(req.body?.money);

  const system = `You are SpendWise AI, a practical personal-finance education assistant for college students in India.\n\nUse the user's SpendWise data below when relevant. Be concise, concrete, and encouraging. Use INR and Indian numbering. Explain assumptions. Never claim certainty about investment returns. Do not provide personalized regulated financial advice, tax/legal advice, or instructions to buy a particular security. You may educate the user about concepts such as emergency funds, budgeting, recurring deposits, index funds, diversification, risk, liquidity, fees and time horizon. If the user asks what to invest in, first discuss goals, horizon and risk, then give general educational categories rather than a guaranteed recommendation. If income is missing, say so. If data is sparse, ask for the missing information.\n\nCurrent SpendWise snapshot:\n${JSON.stringify(money, null, 2)}`;

  try {
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || 'gpt-5.6-luna',
      instructions: system,
      input: [
        ...history,
        { role: 'user', content: message }
      ],
      max_output_tokens: 900
    });
    res.json({ answer: response.output_text || 'I could not generate an answer right now.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'The AI service is temporarily unavailable.' });
  }
});

app.get('/api/health', (_req, res) => res.json({ ok: true, aiConfigured: Boolean(client) }));

app.listen(PORT, () => console.log(`SpendWise running at http://localhost:${PORT}`));
