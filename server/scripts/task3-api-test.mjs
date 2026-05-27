import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createServer } from "node:http";
import Database from "better-sqlite3";

const tempDbPath = path.resolve("data/task3-test.db");
process.env.APP_DB_PATH = tempDbPath;
process.env.NODE_ENV = "test";

if (fs.existsSync(tempDbPath)) {
  fs.unlinkSync(tempDbPath);
}

const { closeDatabase, initializeDatabase } = await import("../dist/db/index.js");
const { createApp } = await import("../dist/app/createApp.js");
const {
  clearYjsRuntimeDocuments,
  replaceDocumentTextForTesting
} = await import("../dist/modules/yjs/runtime.js");
const { getDataAccess } = await import("../dist/services/data-access.js");

clearYjsRuntimeDocuments();
initializeDatabase();

const app = createApp();
const server = createServer(app);

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

const address = server.address();
const baseUrl =
  typeof address === "object" && address
    ? `http://127.0.0.1:${address.port}`
    : null;

if (!baseUrl) {
  throw new Error("Failed to determine test server address.");
}

async function request(pathname, init) {
  const response = await fetch(`${baseUrl}${pathname}`, init);
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return {
      status: response.status,
      body: await response.json(),
      headers: response.headers
    };
  }

  return {
    status: response.status,
    body: await response.text(),
    headers: response.headers
  };
}

try {
  const createMissingName = await request("/api/documents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({})
  });
  assert.equal(createMissingName.status, 400);
  assert.equal(createMissingName.body.success, false);

  const createResponse = await request("/api/documents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "张三" })
  });
  assert.equal(createResponse.status, 201);
  assert.equal(createResponse.body.success, true);
  assert.equal(createResponse.body.data.title, "未命名文档");

  const docId = createResponse.body.data.id;

  const missingDocResponse = await request("/api/documents/not-found");
  assert.equal(missingDocResponse.status, 404);
  assert.equal(missingDocResponse.body.success, false);

  const detailResponse = await request(`/api/documents/${docId}`);
  assert.equal(detailResponse.status, 200);
  assert.equal(detailResponse.body.data.latestSnapshotVersion, 0);

  const initialState = getDataAccess().yjs.getDocumentState(docId);
  assert.ok(initialState);

  assert.equal(replaceDocumentTextForTesting(docId, "# Version 1\n\nhello"), "# Version 1\n\nhello");

  const saveOne = await request(`/api/documents/${docId}/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "张三", title: "网络实验文档" })
  });
  assert.equal(saveOne.status, 200);
  assert.equal(saveOne.body.data.snapshotVersion, 1);

  const updatedState = getDataAccess().yjs.getDocumentState(docId);
  assert.ok(updatedState);

  assert.equal(
    replaceDocumentTextForTesting(docId, "# Version 2\n\nhello world"),
    "# Version 2\n\nhello world"
  );

  const saveTwo = await request(`/api/documents/${docId}/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "张三" })
  });
  assert.equal(saveTwo.status, 200);
  assert.equal(saveTwo.body.data.snapshotVersion, 2);

  const snapshotsResponse = await request(`/api/documents/${docId}/snapshots`);
  assert.equal(snapshotsResponse.status, 200);
  assert.equal(snapshotsResponse.body.data.length, 2);

  const globalSnapshotsResponse = await request("/api/snapshots");
  assert.equal(globalSnapshotsResponse.status, 200);
  assert.equal(globalSnapshotsResponse.body.success, true);
  assert.ok(Array.isArray(globalSnapshotsResponse.body.data));
  assert.ok(globalSnapshotsResponse.body.data.length >= 2);
  assert.ok(
    globalSnapshotsResponse.body.data[0].savedAt >=
      globalSnapshotsResponse.body.data[1].savedAt
  );

  const globalSnapshotId = globalSnapshotsResponse.body.data[0].id;
  const globalSnapshotDetail = await request(`/api/snapshots/${globalSnapshotId}`);
  assert.equal(globalSnapshotDetail.status, 200);
  assert.equal(globalSnapshotDetail.body.success, true);
  assert.equal(globalSnapshotDetail.body.data.id, globalSnapshotId);
  assert.ok(typeof globalSnapshotDetail.body.data.content === "string");

  const missingGlobalSnapshot = await request("/api/snapshots/999999");
  assert.equal(missingGlobalSnapshot.status, 404);
  assert.equal(missingGlobalSnapshot.body.success, false);

  const latestSnapshotId = snapshotsResponse.body.data[0].id;
  const olderSnapshotId = snapshotsResponse.body.data[1].id;

  const snapshotDetail = await request(
    `/api/documents/${docId}/snapshots/${latestSnapshotId}`
  );
  assert.equal(snapshotDetail.status, 200);
  assert.equal(snapshotDetail.body.data.snapshotVersion, 2);

  const diffResponse = await request(
    `/api/documents/${docId}/diff?from=${olderSnapshotId}&to=${latestSnapshotId}`
  );
  assert.equal(diffResponse.status, 200);
  assert.ok(diffResponse.body.data.diffHtml.includes("diff-added"));
  assert.ok(diffResponse.body.data.diffTextSummary.includes("Compared snapshot"));

  const markdownExport = await request(
    `/api/documents/${docId}/export?format=markdown`
  );
  assert.equal(markdownExport.status, 200);
  assert.ok(markdownExport.body.includes("# Version 2"));

  const htmlExport = await request(`/api/documents/${docId}/export?format=html`);
  assert.equal(htmlExport.status, 200);
  assert.ok(htmlExport.body.includes("<!doctype html>"));

  const txtExport = await request(`/api/documents/${docId}/export?format=txt`);
  assert.equal(txtExport.status, 200);
  assert.ok(txtExport.body.includes("hello world"));

  const invalidFormat = await request(`/api/documents/${docId}/export?format=pdf`);
  assert.equal(invalidFormat.status, 400);

  const chatResponse = await request(`/api/documents/${docId}/chat`);
  assert.equal(chatResponse.status, 200);
  assert.deepEqual(chatResponse.body.data, []);

  const sqlite = new Database(tempDbPath);
  const tables = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all();
  assert.ok(tables.length >= 5);
  sqlite.close();

  console.log("Task3 API verification passed.");
} finally {
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

  clearYjsRuntimeDocuments();
  closeDatabase();

  if (fs.existsSync(tempDbPath)) {
    fs.unlinkSync(tempDbPath);
  }
}
