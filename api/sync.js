// api/sync.js — Notion Sync

const DATABASES = {
  Brad:    "28b508e99dda81738029ce0e348a06be",
  Lindsay: "301508e99dda81afaca1c218fb551b46",
  Chris:   "2a1508e99dda81698188c34e5ac3f4f5",
  EmTech:  "328508e99dda802bb543d2871feaad8c",
  Duncan:  "328508e99dda800a939af88618098413",
  Cinday:  "340508e99dda80469c3ee9df0342e02a",
};

const PROPS = {
  Brad:    { status: "Status", editor: "Editor",  title: "VIDEO" },
  Lindsay: { status: "Status", editor: "Editor",  title: "Video Title" },
  Chris:   { status: "Status", editor: "EDITOR",  title: "Video Title" },
  EmTech:  { status: "Status", editor: "EDITOR",  title: "VIDEO" },
  Duncan:  { status: "Status", editor: "EDITOR",  title: "VIDEO" },
  Cinday:  { status: "Status", editor: null,       title: "IDEA" },
};

const PIPELINE_STATUSES = [
  "idea", "scripting", "to film", "to edit", "not started",
  "edit - in progress", "brand approval pen", "waiting for approval",
  "to post", "approval pen", "waiting", "in progress"
];

async function queryDB(dbId, token, apiVersion) {
  const pages = [];
  let cursor = undefined;
  while (true) {
    const body = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    const resp = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Notion-Version": apiVersion, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const errText = await resp.text();
      if (apiVersion === "2022-06-28" && errText.includes("multiple_data_sources")) {
        return await queryDB(dbId, token, "2025-09-03");
      }
      throw new Error(`Notion (${resp.status}): ${errText}`);
    }
    const data = await resp.json();
    pages.push(...data.results);
    if (!data.has_more) break;
    cursor = data.next_cursor;
  }
  return pages;
}

function extract(page, propName) {
  if (!propName) return null;
  const p = page.properties[propName];
  if (!p) return null;
  switch (p.type) {
    case "title": return p.title?.map(t => t.plain_text).join("") || "";
    case "status": return p.status?.name || null;
    case "select": return p.select?.name || null;
    case "rich_text": return p.rich_text?.map(t => t.plain_text).join("") || "";
    default: return null;
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const token = process.env.NOTION_TOKEN;
  if (!token) return res.status(500).json({ success: false, error: "NOTION_TOKEN not configured" });

  try {
    const result = {};
    for (const [client, dbId] of Object.entries(DATABASES)) {
      const props = PROPS[client];
      let pages;
      try { pages = await queryDB(dbId, token, "2022-06-28"); }
      catch (e) { result[client] = { videos: [], statusCounts: {}, pipelineCount: 0, editors: [], totalVideos: 0, editorProp: props.editor, error: e.message }; continue; }

      const videos = [];
      const statusCounts = {};
      const editorSet = new Set();

      for (const page of pages) {
        const title = extract(page, props.title) || "Untitled";
        const status = extract(page, props.status) || "Unknown";
        const editor = props.editor ? (extract(page, props.editor) || "") : "";
        videos.push({ title, status, editor, id: page.id });
        statusCounts[status] = (statusCounts[status] || 0) + 1;
        if (editor && editor !== "TBD" && editor.trim()) editorSet.add(editor.trim());
      }

      let pipelineCount = 0;
      for (const [s, c] of Object.entries(statusCounts)) {
        if (PIPELINE_STATUSES.includes(s.toLowerCase().trim())) pipelineCount += c;
      }

      result[client] = { videos, statusCounts, pipelineCount, editors: [...editorSet], totalVideos: pages.length, editorProp: props.editor };
    }
    res.status(200).json({ success: true, data: result, syncedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}
