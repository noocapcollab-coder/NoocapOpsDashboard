// api/mark-done.js — Mark video as Done in Editors Data + Client DB

const EDITORS_DB_ID = "2ba508e99dda8001a63cdd29a252e2aa";

// Map client names to their DB IDs for status update
const CLIENT_DBS = {
  Brad:    "28b508e99dda81738029ce0e348a06be",
  Lindsay: "301508e99dda81afaca1c218fb551b46",
  Chris:   "2a1508e99dda81698188c34e5ac3f4f5",
  EmTech:  "328508e99dda802bb543d2871feaad8c",
  Duncan:  "328508e99dda800a939af88618098413",
  Cinday:  "340508e99dda80469c3ee9df0342e02a",
};

// Status property names per client (some use "Status")
const STATUS_PROPS = {
  Brad: "Status", Lindsay: "Status", Chris: "Status",
  EmTech: "Status", Duncan: "Status", Cinday: "Status",
};

// Done status names per client (some use "READY", "Done", etc.)
const DONE_STATUS = {
  Brad: "READY", Lindsay: "READY", Chris: "READY",
  EmTech: "READY", Duncan: "READY", Cinday: "POSTED",
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const token = process.env.NOTION_TOKEN;
  if (!token) return res.status(500).json({ success: false, error: "NOTION_TOKEN not set" });

  const { notionPageId, client, videoTitle, editor } = req.body;
  if (!client) return res.status(400).json({ success: false, error: "client required" });

  const results = { clientUpdate: false, editorsUpdate: false };

  // 1. Update client's content planner — set status to Done/READY
  if (notionPageId) {
    try {
      const statusProp = STATUS_PROPS[client] || "Status";
      const doneValue = DONE_STATUS[client] || "READY";
      const resp = await fetch(`https://api.notion.com/v1/pages/${notionPageId}`, {
        method: "PATCH",
        headers: { "Authorization": `Bearer ${token}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" },
        body: JSON.stringify({ properties: { [statusProp]: { status: { name: doneValue } } } }),
      });
      results.clientUpdate = resp.ok;
      if (!resp.ok) results.clientError = await resp.text();
    } catch (err) {
      results.clientError = err.message;
    }
  }

  // 2. Find and update the row in Editors Data
  try {
    // Search for the row by video title
    const searchResp = await fetch(`https://api.notion.com/v1/databases/${EDITORS_DB_ID}/query`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" },
      body: JSON.stringify({
        filter: {
          and: [
            { property: "Video Title", title: { equals: videoTitle || "" } },
            ...(editor ? [{ property: "Editor", select: { equals: editor } }] : []),
          ]
        },
        page_size: 1,
      }),
    });

    if (searchResp.ok) {
      const searchData = await searchResp.json();
      if (searchData.results.length > 0) {
        const editorPageId = searchData.results[0].id;
        const updateResp = await fetch(`https://api.notion.com/v1/pages/${editorPageId}`, {
          method: "PATCH",
          headers: { "Authorization": `Bearer ${token}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" },
          body: JSON.stringify({
            properties: {
              "Status": { status: { name: "Done" } },
              "Submission Date": { date: { start: new Date().toISOString().split("T")[0] } },
            }
          }),
        });
        results.editorsUpdate = updateResp.ok;
        if (!updateResp.ok) results.editorsError = await updateResp.text();
      } else {
        results.editorsError = "Row not found in Editors Data";
      }
    }
  } catch (err) {
    results.editorsError = err.message;
  }

  res.status(200).json({ success: true, results });
}
