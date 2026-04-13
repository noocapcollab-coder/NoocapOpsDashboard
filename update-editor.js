// api/update-editor.js — Write editor assignment back to Notion

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const token = process.env.NOTION_TOKEN;
  if (!token) return res.status(500).json({ success: false, error: "NOTION_TOKEN not set" });

  const { pageId, editor, editorProp } = req.body;
  if (!pageId || !editor || !editorProp) {
    return res.status(400).json({ success: false, error: "pageId, editor, and editorProp required" });
  }

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

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Notion API (${resp.status}): ${err}`);
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Update error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}
