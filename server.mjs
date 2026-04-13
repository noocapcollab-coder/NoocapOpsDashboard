// server.mjs — NOOCAP Notion Sync Server
// Run: node server.mjs
// Requires: npm install @notionhq/client express cors dotenv

import { Client } from "@notionhq/client";
import express from "express";
import cors from "cors";
import { config } from "dotenv";

config(); // loads .env

const app = express();
app.use(cors());
app.use(express.json());

const notion = new Client({ auth: process.env.NOTION_TOKEN });

// Your Notion database IDs (from your workspace)
const DATABASES = {
  Brad: "28b508e99dda81738029ce0e348a06be",
  EmTech: "328508e99dda802bb543d2871feaad8c",
  Duncan: "328508e99dda800a939af88618098413",
};

// Status property name and Editor property name per client
const PROPS = {
  Brad:   { status: "Status", editor: "Editor", title: "VIDEO" },
  EmTech: { status: "Status", editor: "EDITOR", title: "VIDEO" },
  Duncan: { status: "Status", editor: "EDITOR", title: "VIDEO" },
};

// Pre-edit pipeline statuses (lowercase for matching)
const PIPELINE_STATUSES = ["idea", "scripting", "to film", "to edit", "not started", "edit - in progress", "brand approval pen", "waiting for approval"];

async function queryDatabase(dbId) {
  const pages = [];
  let cursor = undefined;

  // Paginate through all pages
  while (true) {
    const response = await notion.databases.query({
      database_id: dbId,
      start_cursor: cursor,
      page_size: 100,
    });
    pages.push(...response.results);
    if (!response.has_more) break;
    cursor = response.next_cursor;
  }

  return pages;
}

function extractProperty(page, propName, type) {
  const prop = page.properties[propName];
  if (!prop) return null;

  switch (prop.type) {
    case "title":
      return prop.title?.map(t => t.plain_text).join("") || "";
    case "status":
      return prop.status?.name || null;
    case "select":
      return prop.select?.name || null;
    case "rich_text":
      return prop.rich_text?.map(t => t.plain_text).join("") || "";
    default:
      return null;
  }
}

app.get("/api/sync", async (req, res) => {
  try {
    const result = {};

    for (const [client, dbId] of Object.entries(DATABASES)) {
      const props = PROPS[client];
      const pages = await queryDatabase(dbId);

      const videos = [];
      const statusCounts = {};
      const editorSet = new Set();

      for (const page of pages) {
        const title = extractProperty(page, props.title, "title") || "Untitled";
        const status = extractProperty(page, props.status, "status") || "Unknown";
        const editor = extractProperty(page, props.editor, "select") || "";

        videos.push({ title, status, editor });

        // Count statuses
        statusCounts[status] = (statusCounts[status] || 0) + 1;

        // Collect editors
        if (editor && editor !== "TBD" && editor.trim()) {
          editorSet.add(editor.trim());
        }
      }

      // Calculate pipeline count (pre-edit statuses)
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

    res.json({ success: true, data: result, syncedAt: new Date().toISOString() });
  } catch (err) {
    console.error("Sync error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Also allow syncing a single client
app.get("/api/sync/:client", async (req, res) => {
  const client = req.params.client;
  const dbId = DATABASES[client];
  const props = PROPS[client];

  if (!dbId) return res.status(404).json({ error: `Client "${client}" not found` });

  try {
    const pages = await queryDatabase(dbId);
    const videos = [];
    const statusCounts = {};
    const editorSet = new Set();

    for (const page of pages) {
      const title = extractProperty(page, props.title, "title") || "Untitled";
      const status = extractProperty(page, props.status, "status") || "Unknown";
      const editor = extractProperty(page, props.editor, "select") || "";

      videos.push({ title, status, editor });
      statusCounts[status] = (statusCounts[status] || 0) + 1;
      if (editor && editor !== "TBD" && editor.trim()) editorSet.add(editor.trim());
    }

    let pipelineCount = 0;
    for (const [status, count] of Object.entries(statusCounts)) {
      if (PIPELINE_STATUSES.includes(status.toLowerCase().trim())) {
        pipelineCount += count;
      }
    }

    res.json({
      success: true,
      data: { videos, statusCounts, pipelineCount, editors: [...editorSet], totalVideos: pages.length },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update editor assignment in Notion
app.post("/api/update-editor", async (req, res) => {
  const { pageId, editor, client } = req.body;
  const props = PROPS[client];
  if (!props) return res.status(404).json({ error: "Client not found" });

  try {
    await notion.pages.update({
      page_id: pageId,
      properties: {
        [props.editor]: { select: { name: editor } },
      },
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n  🎬 NOOCAP Sync Server running on http://localhost:${PORT}`);
  console.log(`  📡 Endpoints:`);
  console.log(`     GET  /api/sync          — Sync all clients`);
  console.log(`     GET  /api/sync/:client  — Sync one client`);
  console.log(`     POST /api/update-editor — Update editor in Notion\n`);
});
