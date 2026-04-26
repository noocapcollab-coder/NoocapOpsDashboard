// api/mark-done.js — Toggle Done/Undo + Ops (Assets) support

const EDITORS_DB_ID = "2ba508e99dda8001a63cdd29a252e2aa";

const STATUS_PROPS = {
  Brad: "Status", Lindsay: "Status", Chris: "Status",
  EmTech: "Status", Duncan: "Status", Cinday: "Status", Joshua: "Status",
};

const DONE_STATUS = {
  Brad: "READY", Lindsay: "READY", Chris: "READY",
  EmTech: "READY", Duncan: "READY", Cinday: "POSTED", Joshua: "READY",
};

const UNDO_STATUS = {
  Brad: "To Edit", Lindsay: "To Edit", Chris: "To Edit",
  EmTech: "To Edit", Duncan: "TO EDIT", Cinday: "In progress", Joshua: "To Edit",
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const token = process.env.NOTION_TOKEN;
  if (!token) return res.status(500).json({ success: false, error: "NOTION_TOKEN not set" });

  const { notionPageId, client, videoTitle, editor, action, isOps } = req.body;
  if (!client) return res.status(400).json({ success: false, error: "client required" });

  const isDone = action !== "undo";
  const results = { clientUpdate: false, editorsUpdate: false, action: isDone ? "done" : "undo", isOps: !!isOps };

  // 1. Update client's content planner
  if (notionPageId) {
    try {
      let updateProps;

      if (isOps) {
        // Ops (Anurag) → update Assets column, NOT Status
        updateProps = {
          "Assets": { status: { name: isDone ? "Done" : "Not started" } }
        };
      } else {
        // Regular editor → update Status column
        const statusProp = STATUS_PROPS[client] || "Status";
        const statusValue = isDone
          ? (DONE_STATUS[client] || "READY")
          : (UNDO_STATUS[client] || "To Edit");
        updateProps = {
          [statusProp]: { status: { name: statusValue } }
        };
      }

      const resp = await fetch(`https://api.notion.com/v1/pages/${notionPageId}`, {
        method: "PATCH",
        headers: { "Authorization": `Bearer ${token}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" },
        body: JSON.stringify({ properties: updateProps }),
      });
      results.clientUpdate = resp.ok;
      if (!resp.ok) results.clientError = await resp.text();
    } catch (err) {
      results.clientError = err.message;
    }
  }

  // 2. Find and update the row in Editors Data
  try {
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

        const updateProps = isDone
          ? {
              "Status": { status: { name: "Done" } },
              "Submission Date": { date: { start: new Date().toISOString().split("T")[0] } },
            }
          : {
              "Status": { status: { name: "In progress" } },
            };

        const updateResp = await fetch(`https://api.notion.com/v1/pages/${editorPageId}`, {
          method: "PATCH",
          headers: { "Authorization": `Bearer ${token}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" },
          body: JSON.stringify({ properties: updateProps }),
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
