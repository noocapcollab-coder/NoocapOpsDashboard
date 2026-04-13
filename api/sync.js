// api/sync.js — Notion Sync using DATABASE IDs (not data source IDs)
 
// These are the actual Notion DATABASE IDs
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
 
async function queryNotionDB(dbId, token) {
  const pages = [];
  let cursor = undefined;
  while (true) {
    const body = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
 
    // Use newer API version to support multi-source databases (Brad)
    const resp = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
 
    if (!resp.ok) {
      const errText = await resp.text();
      // If multi-source error, try with newer API version
      if (errText.includes("multiple_data_sources")) {
        return await queryWithNewerAPI(dbId, token);
      }
      throw new Error(`Notion API (${resp.status}): ${errText}`);
    }
 
    const data = await resp.json();
    pages.push(...data.results);
    if (!data.has_more) break;
    cursor = data.next_cursor;
  }
  return pages;
}
 
// Fallback for multi-source databases using newer API version
async function queryWithNewerAPI(dbId, token) {
  const pages = [];
  let cursor = undefined;
  while (true) {
    const body = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
 
    const resp = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Notion-Version": "2025-09-03",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
 
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Notion API v2 (${resp.status}): ${errText}`);
    }
 
    const data = await resp.json();
    pages.push(...data.results);
    if (!data.has_more) break;
    cursor = data.next_cursor;
  }
  return pages;
}
 
function extractProperty(page, propName) {
  if (!propName) return null;
  const prop = page.properties[propName];
  if (!prop) return null;
  switch (prop.type) {
    case "title": return prop.title?.map(t => t.plain_text).join("") || "";
    case "status": return prop.status?.name || null;
    case "select": return prop.select?.name || null;
    case "rich_text": return prop.rich_text?.map(t => t.plain_text).join("") || "";
    default: return null;
  }
}
 
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
 
  const token = process.env.NOTION_TOKEN;
  if (!token) {
    return res.status(500).json({ success: false, error: "NOTION_TOKEN not configured" });
  }
 
  try {
    const result = {};
 
    for (const [client, dbId] of Object.entries(DATABASES)) {
      const props = PROPS[client];
      let pages;
      try {
        pages = await queryNotionDB(dbId, token);
      } catch (queryErr) {
        console.error(`Failed ${client}:`, queryErr.message);
        result[client] = { videos: [], statusCounts: {}, pipelineCount: 0, editors: [], totalVideos: 0, error: queryErr.message };
        continue;
      }
 
      const videos = [];
      const statusCounts = {};
      const editorSet = new Set();
 
      for (const page of pages) {
        const title = extractProperty(page, props.title) || "Untitled";
        const status = extractProperty(page, props.status) || "Unknown";
        const editor = props.editor ? (extractProperty(page, props.editor) || "") : "";
 
        videos.push({ title, status, editor, id: page.id });
        statusCounts[status] = (statusCounts[status] || 0) + 1;
        if (editor && editor !== "TBD" && editor.trim()) editorSet.add(editor.trim());
      }
 
      let pipelineCount = 0;
      for (const [status, count] of Object.entries(statusCounts)) {
        if (PIPELINE_STATUSES.includes(status.toLowerCase().trim())) {
          pipelineCount += count;
        }
      }
 
      result[client] = { videos, statusCounts, pipelineCount, editors: [...editorSet], totalVideos: pages.length };
    }
 
    res.status(200).json({ success: true, data: result, syncedAt: new Date().toISOString() });
  } catch (err) {
    console.error("Sync error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}
