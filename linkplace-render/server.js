const express = require("express");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.post("/api/analyze", async (req, res) => {
  const { domain, anchor, linkto } = req.body;

  if (!domain || !anchor || !linkto) {
    return res.status(400).json({ error: "domain, anchor, and linkto are required" });
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "API key not configured on server" });
  }

  const systemPrompt = `You are a professional link building expert specializing in link insertion and niche edits.

Your task:
1. Use web search with query: site:${domain} ${anchor}
2. Find the most relevant article URL from the search results on domain "${domain}"
3. Fetch and read that article's content
4. Identify the single best paragraph where anchor text "${anchor}" can be naturally inserted as a hyperlink to "${linkto}"
5. Rewrite ONLY that one sentence so the anchor "${anchor}" fits naturally and fluently — not forced. Keep the rest of the paragraph unchanged.
6. Return ONLY valid JSON, no markdown, no extra text:

{
  "article_url": "full URL of the article",
  "paragraph": "exact full paragraph text from article",
  "suggested_sentence": "the original sentence before edit",
  "suggested_edit": "rewritten sentence with anchor naturally embedded — use [[ANCHOR]] as placeholder where the hyperlink goes",
  "reason": "1-2 sentence explanation of why this is the best spot",
  "relevance_score": 85,
  "natural_fit": "high"
}

natural_fit must be: "high", "medium", or "low"
relevance_score is 0-100 integer`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `Domain: ${domain}\nAnchor text: "${anchor}"\nDestination URL: ${linkto}\n\nFind the best link placement. Return JSON only.`,
          },
        ],
        tools: [{ type: "web_search_20250305", name: "web_search" }],
      }),
    });

    const data = await response.json();

    if (data.error) {
      return res.status(500).json({ error: data.error.message });
    }

    const fullText = (data.content || [])
      .map((i) => (i.type === "text" ? i.text : ""))
      .filter(Boolean)
      .join("\n");

    const clean = fullText.replace(/```json|```/g, "").trim();

    let result;
    try {
      result = JSON.parse(clean);
    } catch (e) {
      const match = clean.match(/\{[\s\S]*\}/);
      if (match) result = JSON.parse(match[0]);
      else throw new Error("Could not parse AI response");
    }

    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message || "Something went wrong" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`LinkPlace running on port ${PORT}`));
