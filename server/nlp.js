const Anthropic = require('@anthropic-ai/sdk');
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function parseNaturalLanguageTask(input) {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const todayName = dayNames[today.getDay()];
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate()+1);

  const prompt = `You are a task parser. Extract structured data from natural language. Return ONLY valid JSON, no markdown.

Today: ${todayStr} (${todayName})
Tomorrow: ${tomorrow.toISOString().split('T')[0]}

Schema:
{"title":"clean task title","description":"optional","dueDate":"YYYY-MM-DD or null","dueTime":"HH:MM 24hr or null","priority":"low|medium|high|urgent","tags":[],"projectHint":"project name or null","recurrence":"daily|weekly|monthly or null","subtasks":[]}

Priority: urgent/asap=urgent, important/!=high, someday/eventually=low, default=medium
"next [weekday]" = next occurrence of that day
"this weekend" = Saturday
"next week" = next Monday

Input: "${input}"`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }]
    });
    const text = response.content[0].text.trim().replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(text);
    parsed.naturalInput = input;
    return parsed;
  } catch (err) {
    console.error('NLP error:', err.message);
    return { title: input, description: '', dueDate: null, dueTime: null, priority: 'medium', tags: [], projectHint: null, recurrence: null, subtasks: [], naturalInput: input };
  }
}

module.exports = { parseNaturalLanguageTask };
