// api/remove-assignment.js — Revert Notion when removing a video

const EDITORS_DB_ID = "2ba508e99dda8001a63cdd29a252e2aa";
const OPS_MEMBERS = ["anurag"];

const TO_FILM_STATUS = {
  Brad: "To Film", Lindsay: "To Film", Chris: "To Film",
  EmTech: "TO FILM", Duncan: "TO FILM", Cinday: "Not started",
  Joshua: "To Film", Valerie: "5- To Film",
};

const STATUS_TYPE = { Valerie: "select" };
const getStatusType = (client) => STATUS_TYPE[client] || "status";

const ASSETS_COL = { Brad: "Assets 2" };
const getAssetsCol = (client) => ASSETS_COL[client] || "Assets";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const token = process.env.NOTION_TOKEN;
  if (!token) return res.status(500).json({ success: false, error: "NOTION_TOKEN not set" });

  const { notionPageId, client, videoTitle, editor } = req.body;
  const isOps = editor && OPS_MEMBERS.includes(editor.toLowerCase());
  const results = { clientUpdate: false, editorsUpdate: false, isOps };

  // 1. Revert client's content planner
  if (notionPageId) {
    try {
      let updateProps;
      if (isOps) {
        updateProps = { [getAssetsCol(client)]: { status: { name: "Not started" } } };
      } else {
        const toFilmVal = TO_FILM_STATUS[client] || "To Film";
        const sType = getStatusType(client);
        updateProps = { "Status": { [sType]: { name: toFilmVal } } };
      }

      const resp = await fetch(`https://api.notion.com/v1/pages/${notionPageId}`, {
        method: "PATCH",
        headers: { "Authorization": `Bearer ${token}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" },
        body: JSON.stringify({ properties: updateProps }),
      });
      results.clientUpdate = resp.ok;
      if (!resp.ok) results.clientError = await resp.text();
    } catch (err) { results.clientError = err.message; }
  }

  // 2. Archive the row in Editors Data (only for editors, not ops)
  if (!isOps && videoTitle && editor) {
    try {
      const searchResp = await fetch(`https://api.notion.com/v1/databases/${EDITORS_DB_ID}/query`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" },
        body: JSON.stringify({
          filter: { and: [
            { property: "Video Title", title: { equals: videoTitle } },
            { property: "Editor", select: { equals: editor } },
          ]},
          page_size: 1,
        }),
      });
      if (searchResp.ok) {
        const searchData = await searchResp.json();
        if (searchData.results.length > 0) {
          const archiveResp = await fetch(`https://api.notion.com/v1/pages/${searchData.results[0].id}`, {
            method: "PATCH",
            headers: { "Authorization": `Bearer ${token}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" },
            body: JSON.stringify({ archived: true }),
          });
          results.editorsUpdate = archiveResp.ok;
        }
      }
    } catch (err) { results.editorsError = err.message; }
  }

  res.status(200).json({ success: true, results });
}
