import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const GRAPH_VERSION = process.env.FB_GRAPH_VERSION || "v20.0";
const ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;

async function callGraph(path, params = {}) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${path}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  });
  url.searchParams.set("access_token", ACCESS_TOKEN);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Facebook API error ${res.status}: ${text}`);
  }
  return res.json();
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.get("/interests", async (req, res) => {
  try {
    const { q, limit = "20", locale = "en_US", method = "search" } = req.query;
    if (!q) return res.status(400).json({ error: "Missing q" });
    if (!ACCESS_TOKEN) return res.status(500).json({ error: "No Access Token" });

    const endpoint = method === "targetingsearch" ? "targetingsearch" : "search";
    const data = await callGraph(endpoint, { type: "adinterest", q, limit, locale });

    const rows = (data?.data || []).map(item => ({
      id: item.id,
      name: item.name,
      topic_path: item.path || [],
      audience_size: item.audience_size || null
    }));

    res.json({ count: rows.length, data: rows });
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`FB Interest Proxy running on ${port}`));
