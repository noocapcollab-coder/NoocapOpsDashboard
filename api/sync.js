// api/sync.js — Notion Sync via REST API (uses data source IDs, not database IDs)
 
// These are the DATA SOURCE IDs (not database IDs) — required for multi-source databases
const DATABASES = {
  Brad:   "28b508e9-9dda-81ba-8d7f-000b84b83fbd",
  EmTech: "328508e9-9dda-8000-b3c9-000b0d791507",
  Duncan: "328508e9-9dda-8186-b4ca-000bd212e84b",
};
 
const PROPS = {
  Brad:   { status: "Status", editor: "Editor", title: "VIDEO" },
  EmTech: { status: "Status", editor: "EDITOR", title: "VIDEO" },
  Duncan: { status: "Status", editor: "EDITOR", title: "VIDEO" },
};
 
const PIPELINE_STATUSES = [
  "idea", "scripting", "to film", "to edit", "not started",
  "edit - in progress", "brand approval pen", "waiting for approval",
  "to post"
];
 
async function queryNotionDB(dbId, token) {
  const pages = [];
  let cursor = undefined;
 
  while (true) {
    const body = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
 
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
      const err = await resp.text();
      throw new Error(`Notion API error for ${dbId} (${resp.status}): ${err}`);
    }
 
    const data = await resp.json();
    pages.push(...data.results);
    if (!data.has_more) break;
    cursor = data.next_cursor;
  }
 
  return pages;
}
 
function extractProperty(page, propName) {
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
 
    for (const [client, dsId] of Object.entries(DATABASES)) {
      const props = PROPS[client];
 
      let pages;
      try {
        pages = await queryNotionDB(dsId, token);
      } catch (queryErr) {
        console.error(`Failed to query ${client}:`, queryErr.message);
        result[client] = {
          videos: [],
          statusCounts: {},
          pipelineCount: 0,
          editors: [],
          totalVideos: 0,
          error: queryErr.message,
        };
        continue;
      }
 
      const videos = [];
      const statusCounts = {};
      const editorSet = new Set();
 
      for (const page of pages) {
        const title = extractProperty(page, props.title) || "Untitled";
        const status = extractProperty(page, props.status) || "Unknown";
        const editor = extractProperty(page, props.editor) || "";
 
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
 
      result[client] = {
        videos,
        statusCounts,
        pipelineCount,
        editors: [...editorSet],
        totalVideos: pages.length,
      };
    }
 
    res.status(200).json({ success: true, data: result, syncedAt: new Date().toISOString() });
  } catch (err) {
    console.error("Sync error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}
