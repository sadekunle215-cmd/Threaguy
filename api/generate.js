export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { prompt, length, tone } = req.body;
  if (!prompt) return res.status(400).json({ error: "Prompt required" });

  const systemPrompt = `You are an expert Twitter/X thread writer. Rules:
- No hype words: no "game-changer", "mind-blowing", "revolutionary"
- No filler openers like "A thread:" or "Let me break this down"
- Max 1 emoji per tweet, only if natural
- Each tweet = one clear idea
- Hook must be strong and specific
- Tone: ${tone}
- Keep every tweet under 260 characters

Respond ONLY with valid JSON, no markdown, no backticks:
{
  "title": "short thread title",
  "tweets": [
    { "id": 1, "text": "tweet text", "isGraphic": true },
    { "id": 2, "text": "tweet text", "isGraphic": false }
  ]
}
Mark tweets 1, 4, 7, 10 as isGraphic: true. All others false. Exactly ${length} tweets.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-6",
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: "user", content: `Write a ${length}-tweet ${tone} thread about: ${prompt}` }],
      }),
    });

    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: data?.error?.message || "API error" });

    const raw = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");

    let jsonStr = raw;
    const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) { jsonStr = fence[1]; }
    else {
      const s = raw.indexOf("{"), e = raw.lastIndexOf("}");
      if (s !== -1 && e !== -1) jsonStr = raw.slice(s, e + 1);
    }

    const parsed = JSON.parse(jsonStr.trim());
    res.status(200).json(parsed);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
}
