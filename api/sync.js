// api/sync.js — Notion Sync (To Film + To Edit only)

// Brad has multi-source DB — use search API as workaround
const BRAD_DB_ID = "28b508e9-9dda-8173-8029-ce0e348a06be";

const DATABASES = {
  Brad:    { useSearch: true, dbId: BRAD_DB_ID },
  Lindsay: { ids: [{ id: "301508e99dda81afaca1c218fb551b46", version: "2022-06-28" }] },
  Chris:   { ids: [{ id: "2a1508e99dda81698188c34e5ac3f4f5", version: "2022-06-28" }] },
  EmTech:  { ids: [{ id: "328508e99dda802bb543d2871feaad8c", version: "2022-06-28" }] },
  Duncan:  { ids: [{ id: "328508e99dda800a939af88618098413", version: "2022-06-28" }] },
  Cinday:  { ids: [{ id: "340508e99dda80469c3ee9df0342e02a", version: "2022-06-28" }] },
  Joshua:  { ids: [{ id: "305508e99dda811b8351e935bb5068be", version: "2022-06-28" }] },
};

const PROPS = {
  Brad:    { status: "Status", editor: "Editor",  title: "VIDEO" },
  Lindsay: { status: "Status", editor: "Editor",  title: "Video Title" },
  Chris:   { status: "Status", editor: "EDITOR",  title: "Video Title" },
  EmTech:  { status: "Status", editor: "EDITOR",  title: "VIDEO" },
  Duncan:  { status: "Status", editor: "EDITOR",  title: "VIDEO" },
  Cinday:  { status: "Status", editor: null,       title: "IDEA" },
  Joshua:  { status: "Status", editor: "Editor",  title: "Video Title" },
};

async function tryQuery(dbId, token, apiVersion) {
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
      throw new Error(`(${resp.status}) ${errText}`);
    }
    const data = await resp.json();
    pages.push(...data.results);
    if (!data.has_more) break;
    cursor = data.next_cursor;
  }
  return pages;
}

// Try each ID+version combo until one works
async function queryWithFallback(entries, token) {
  let lastErr = null;
  for (const entry of entries) {
    try {
      return await tryQuery(entry.id, token, entry.version);
    } catch (e) {
      lastErr = e;
      continue;
    }
  }
  throw lastErr;
}

// Search API fallback for multi-source databases (Brad)
async function searchPages(dbId, token) {
  const allPages = [];
  let cursor = undefined;
  // Search in batches — collect all pages belonging to this database
  while (true) {
    const body = { filter: { property: "object", value: "page" }, page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    const resp = await fetch("https://api.notion.com/v1/search", {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Search API (${resp.status}): ${errText}`);
    }
    const data = await resp.json();
    // Filter pages whose parent is this database
    const dbPages = data.results.filter(p =>
      p.parent && p.parent.type === "database_id" && p.parent.database_id && p.parent.database_id.replace(/-/g, "") === dbId.replace(/-/g, "")
    );
    allPages.push(...dbPages);
    if (!data.has_more) break;
    cursor = data.next_cursor;
    // Safety limit
    if (allPages.length > 500) break;
  }
  return allPages;
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

// Editors who no longer work with us — excluded from dashboard
const EXCLUDED_EDITORS = ["sanjai", "prateek"];

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const token = process.env.NOTION_TOKEN;
  if (!token) return res.status(500).json({ success: false, error: "NOTION_TOKEN not configured" });

  try {
    const result = {};
    for (const [client, config] of Object.entries(DATABASES)) {
      const props = PROPS[client];
      let pages;
      try {
        if (config.useSearch) {
          pages = await searchPages(config.dbId, token);
        } else {
          pages = await queryWithFallback(config.ids, token);
        }
      } catch (e) {
        result[client] = { videos: [], statusCounts: {}, toEditCount: 0, toFilmCount: 0, pipelineCount: 0, editors: [], totalVideos: 0, editorProp: props.editor, error: e.message };
        continue;
      }

      const videos = [];
      const statusCounts = {};
      const editorSet = new Set();
      let toEditCount = 0;
      let toFilmCount = 0;

      for (const page of pages) {
        const title = extract(page, props.title) || "Untitled";
        const status = extract(page, props.status) || "Unknown";
        const editor = props.editor ? (extract(page, props.editor) || "") : "";
        const sLow = status.toLowerCase().trim();

        videos.push({ title, status, editor, id: page.id });
        statusCounts[status] = (statusCounts[status] || 0) + 1;
        if (editor && editor !== "TBD" && editor.trim() && !EXCLUDED_EDITORS.includes(editor.trim().toLowerCase())) editorSet.add(editor.trim());
        if (sLow === "to edit") toEditCount++;
        if (sLow === "to film") toFilmCount++;
      }

      result[client] = { videos, statusCounts, toEditCount, toFilmCount, pipelineCount: toEditCount + toFilmCount, editors: [...editorSet], totalVideos: pages.length, editorProp: props.editor };
    }
    res.status(200).json({ success: true, data: result, syncedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}
