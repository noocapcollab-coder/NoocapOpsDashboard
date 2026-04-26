// api/update-editor.js — Assign video: editors get Editor column, Anurag gets Assets column

const EDITORS_DB_ID = "2ba508e99dda8001a63cdd29a252e2aa";

// Ops team members — they update Assets, not Editor column
const OPS_MEMBERS = ["anurag"];

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

  const isOps = OPS_MEMBERS.includes(editor.toLowerCase());
  const results = { clientUpdate: false, editorsRow: false, isOps };

  // 1. Update client's content planner
  try {
    let updateProps;

    if (isOps) {
      // Anurag (Ops) → set Assets to "In progress", DON'T touch Editor column
      updateProps = {
        "Assets": { status: { name: "In progress" } }
      };
    } else {
      // Regular editor → set Editor column
      if (editorProp) {
        updateProps = {
          [editorProp]: { select: { name: editor } }
        };
      }
    }

    if (updateProps) {
      const resp = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ properties: updateProps }),
      });
      results.clientUpdate = resp.ok;
      if (!resp.ok) results.clientError = await resp.text();
    }
  } catch (err) {
    results.clientError = err.message;
  }

  // 2. Create row in Editors Data database
  try {
    const today = new Date().toISOString().split("T")[0];

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
            status: { name: "In progress" }
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
      results.editorsError = err;
    }
  } catch (err) {
    results.editorsError = err.message;
  }

  res.status(200).json({ success: true, results });
}
