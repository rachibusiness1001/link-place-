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

  let linktoDomain = "";
  try {
    linktoDomain = new URL(linkto).hostname.replace(/^www\./, "");
  } catch (e) {
    linktoDomain = linkto;
  }

  const systemPrompt = `You are a link building expert. Your job is to find the best paragraph in an article where an anchor text can be naturally inserted.

STEPS:
1. Search: site:${domain} ${anchor}
2. Pick the most relevant article from "${domain}" (skip tool/software articles, skip if domain matches "${linktoDomain}")
3. Fetch ONLY the first 2000 characters of that article
4. Find the best paragraph for anchor insertion following all rules below
5. Return ONLY a JSON object — no markdown, no backticks, no explanation

RULES:
- Positive or neutral tone paragraphs only
- Skip intro and conclusion paragraphs
- Skip paragraphs that already have links
- Skip paragraphs about tools or products
- Anchor must be topically relevant to paragraph
- Add max 1-2 lines only if needed — do NOT rewrite existing text

OUTPUT — return this exact JSON and nothing else:
{"article_url":"","paragraph":"","suggested_sentence":null,"suggested_edit":"sentence with [[ANCHOR]] inside","edit_type":"sentence_edit","reason":"","relevance_score":80,"natural_fit":"high"}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 600,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `Domain: ${domain}\nAnchor: "${anchor}"\nLink to: ${linkto}\nAvoid domain: ${linktoDomain}\n\nReturn JSON only.`,
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

    // Extract JSON from response — handles extra text before/after
    const jsonMatch = fullText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({ error: "No valid placement found. Try a different domain or anchor." });
    }

    let result;
    try {
      result = JSON.parse(jsonMatch[0]);
    } catch (e) {
      return res.status(500).json({ error: "No valid placement found. Try a different domain or anchor." });
    }

    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message || "Something went wrong" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`LinkPlace running on port ${PORT}`));
