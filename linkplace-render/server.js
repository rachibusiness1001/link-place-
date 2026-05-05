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

  const systemPrompt = `You are a professional link building expert specializing in link insertion and niche edits.

Your task:
1. Use web search with query: site:${domain} ${anchor}
2. Find the most relevant article URL from the search results on domain "${domain}"
3. Fetch and read that article's content
4. Identify the single best paragraph where anchor text "${anchor}" can be naturally inserted as a hyperlink to "${linkto}"
5. If needed, add a maximum of 1-2 new lines to the paragraph to naturally include the anchor. Do NOT rewrite or modify the existing paragraph content beyond that. Keep the edit strictly aligned with the blog intent and topic.
6. Return ONLY valid JSON. No markdown, no backticks, no extra text — pure JSON only.

STRICT RULES — violating any of these means you must skip that article/paragraph and find another:

PLACEMENT RULES:
- The surrounding text must have a positive or neutral tone. Do NOT place links in negative, critical, or warning-heavy paragraphs.
- The anchor and paragraph must be clearly topically relevant. Do not force unrelated placements.
- Do NOT place the link in the Introduction or Conclusion sections of the article.
- Do NOT place the link in any paragraph that already contains a hyperlink.
- Only one link per paragraph is allowed.
- Do NOT place the link in overly promotional or sales-heavy paragraphs.
- Do NOT place the link in paragraphs about a tool, software, or product feature list.

ARTICLE SKIP RULES — skip the article entirely if any of these are true:
- The article is primarily about a tool or software product (review, tutorial, or feature breakdown).
- The article domain matches the destination domain "${linktoDomain}" — find a different article on "${domain}".

EDIT RULES:
- Do NOT rewrite the entire paragraph.
- You may only add 1-2 new lines to naturally include the anchor, if existing text does not allow a clean fit.
- Any addition must be strictly aligned with the blog topic and intent.
- The placement must feel natural and fluent, not forced.

Return ONLY this JSON object, nothing else:
{"article_url":"full URL","paragraph":"exact paragraph text before edit","suggested_sentence":"original sentence being edited or null","suggested_edit":"edited content with [[ANCHOR]] placeholder","edit_type":"sentence_edit or lines_added","reason":"1-2 sentence explanation","relevance_score":85,"natural_fit":"high"}

natural_fit: "high", "medium", or "low"
relevance_score: integer 0-100
edit_type: "sentence_edit" or "lines_added"`;

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
        max_tokens: 1200,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `Domain: ${domain}\nAnchor text: "${anchor}"\nDestination URL: ${linkto}\nDestination domain to avoid: ${linktoDomain}\n\nFind the best placement. Return pure JSON only, no markdown.`,
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
      if (match) {
        try {
          result = JSON.parse(match[0]);
        } catch (e2) {
          return res.status(500).json({ error: "Could not parse AI response", raw: clean });
        }
      } else {
        return res.status(500).json({ error: "Could not parse AI response", raw: clean });
      }
    }

    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message || "Something went wrong" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`LinkPlace running on port ${PORT}`));
