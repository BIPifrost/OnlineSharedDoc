import type Database from "better-sqlite3";
import type {
  DocumentSnapshot,
  DocumentSnapshotSummary
} from "../../types/domain.js";

type DocumentSnapshotRow = {
  id: number;
  doc_id: string;
  snapshot_version: number;
  title: string;
  content: string;
  saved_by_name: string;
  saved_at: string;
};

export type CreateDocumentSnapshotInput = {
  docId: string;
  snapshotVersion: number;
  title: string;
  content: string;
  savedByName: string;
  savedAt: string;
};

const SNAPSHOT_PREVIEW_LENGTH = 180;

function mapSnapshotRow(row: DocumentSnapshotRow): DocumentSnapshot {
  return {
    id: row.id,
    docId: row.doc_id,
    snapshotVersion: row.snapshot_version,
    title: row.title,
    content: row.content,
    savedByName: row.saved_by_name,
    savedAt: row.saved_at
  };
}

function buildContentPreview(content: string) {
  const normalized = content.replace(/\s+/g, " ").trim();
  return normalized.length <= SNAPSHOT_PREVIEW_LENGTH
    ? normalized
    : `${normalized.slice(0, SNAPSHOT_PREVIEW_LENGTH)}...`;
}

export function createHistoryRepository(database: Database.Database) {
  const insertSnapshotStatement = database.prepare(`
    INSERT INTO document_snapshots (
      doc_id,
      snapshot_version,
      title,
      content,
      saved_by_name,
      saved_at
    ) VALUES (
      @docId,
      @snapshotVersion,
      @title,
      @content,
      @savedByName,
      @savedAt
    )
  `);

  const selectSnapshotsStatement = database.prepare(`
    SELECT
      id,
      doc_id,
      snapshot_version,
      title,
      content,
      saved_by_name,
      saved_at
    FROM document_snapshots
    WHERE doc_id = ?
    ORDER BY snapshot_version DESC, id DESC
  `);

  const selectSnapshotByIdStatement = database.prepare(`
    SELECT
      id,
      doc_id,
      snapshot_version,
      title,
      content,
      saved_by_name,
      saved_at
    FROM document_snapshots
    WHERE doc_id = ? AND id = ?
  `);

  const selectAllSnapshotsStatement = database.prepare(`
    SELECT
      id,
      doc_id,
      snapshot_version,
      title,
      content,
      saved_by_name,
      saved_at
    FROM document_snapshots
    ORDER BY saved_at DESC, id DESC
  `);

  const selectGlobalSnapshotByIdStatement = database.prepare(`
    SELECT
      id,
      doc_id,
      snapshot_version,
      title,
      content,
      saved_by_name,
      saved_at
    FROM document_snapshots
    WHERE id = ?
  `);

  const selectLatestSnapshotVersionStatement = database.prepare(`
    SELECT COALESCE(MAX(snapshot_version), 0) AS snapshot_version
    FROM document_snapshots
    WHERE doc_id = ?
  `);

  return {
    createSnapshot(input: CreateDocumentSnapshotInput) {
      const result = insertSnapshotStatement.run(input);
      return {
        id: Number(result.lastInsertRowid),
        docId: input.docId,
        snapshotVersion: input.snapshotVersion,
        title: input.title,
        content: input.content,
        savedByName: input.savedByName,
        savedAt: input.savedAt
      } satisfies DocumentSnapshot;
    },
    getSnapshotsByDocumentId(documentId: string) {
      const rows = selectSnapshotsStatement.all(documentId) as DocumentSnapshotRow[];
      return rows.map(mapSnapshotRow);
    },
    getSnapshotById(documentId: string, snapshotId: number) {
      const row = selectSnapshotByIdStatement.get(
        documentId,
        snapshotId
      ) as DocumentSnapshotRow | undefined;

      return row ? mapSnapshotRow(row) : null;
    },
    getAllSnapshots() {
      const rows = selectAllSnapshotsStatement.all() as DocumentSnapshotRow[];
      return rows.map((row) => ({
        id: row.id,
        docId: row.doc_id,
        snapshotVersion: row.snapshot_version,
        title: row.title,
        savedByName: row.saved_by_name,
        savedAt: row.saved_at,
        contentPreview: buildContentPreview(row.content)
      })) satisfies DocumentSnapshotSummary[];
    },
    getSnapshotByGlobalId(snapshotId: number) {
      const row = selectGlobalSnapshotByIdStatement.get(snapshotId) as
        | DocumentSnapshotRow
        | undefined;

      return row ? mapSnapshotRow(row) : null;
    },
    getLatestSnapshotVersion(documentId: string) {
      const row = selectLatestSnapshotVersionStatement.get(documentId) as {
        snapshot_version: number;
      };

      return row.snapshot_version;
    }
  };
}
