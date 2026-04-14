// api/update-editor.js — Updates editor in client DB + creates row in Editors Data
 
const EDITORS_DB_ID = "2ba508e99dda8001a63cdd29a252e2aa";
 
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
 
  const token = process.env.NOTION_TOKEN;
  if (!token) return res.status(500).json({ success: false, error: "NOTION_TOKEN not set" });
 
  const { pageId, editor, editorProp, videoTitle, client } = req.body;
  if (!pageId || !editor) {
    return res.status(400).json({ success: false, error: "pageId and editor required" });
  }
 
  const results = { clientUpdate: false, editorsRow: false };
 
  // 1. Update editor column in client's content planner
  if (editorProp) {
    try {
      const resp = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          properties: {
            [editorProp]: { select: { name: editor } }
          }
        }),
      });
      if (resp.ok) {
        results.clientUpdate = true;
      } else {
        const err = await resp.text();
        console.error("Client DB update failed:", err);
      }
    } catch (err) {
      console.error("Client DB update error:", err);
    }
  }
 
  // 2. Create row in Editors Data database
  try {
    const today = new Date().toISOString().split("T")[0];
 
    const properties = {
      "Video Title": {
        title: [{ text: { content: videoTitle || "Untitled" } }]
      },
      "Editor": {
        select: { name: editor }
      },
      "date:Assigned Date:start": today,
      "Status": {
        status: { name: "Not started" }
      },
    };
 
    // Add CLIENT as multi_select if provided
    if (client) {
      properties["CLIENT"] = {
        multi_select: [{ name: client.toUpperCase() }]
      };
    }
 
    const resp = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        parent: { database_id: EDITORS_DB_ID },
        properties: {
          "Video Title": {
            title: [{ text: { content: videoTitle || "Untitled" } }]
          },
          "Editor": {
            select: { name: editor }
          },
          "Assigned Date": {
            date: { start: today }
          },
          "Status": {
            status: { name: "Not started" }
          },
          ...(client ? {
            "CLIENT": {
              multi_select: [{ name: client.toUpperCase() }]
            }
          } : {}),
        }
      }),
    });
 
    if (resp.ok) {
      results.editorsRow = true;
    } else {
      const err = await resp.text();
      console.error("Editors Data row creation failed:", err);
      results.editorsError = err;
    }
  } catch (err) {
    console.error("Editors Data error:", err);
    results.editorsError = err.message;
  }
 
  res.status(200).json({ success: true, results });
}
 
