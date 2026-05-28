import { nanoid } from "nanoid";
import type Database from "better-sqlite3";
import type { DocumentMeta } from "../../types/domain.js";

type DocumentRow = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  created_by_name: string;
  is_deleted: number;
};

export type CreateDocumentInput = {
  createdByName: string;
  title?: string;
  now: string;
};

function mapDocumentRow(row: DocumentRow): DocumentMeta {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdByName: row.created_by_name,
    isDeleted: row.is_deleted === 1
  };
}

export function createDocumentsRepository(database: Database.Database) {
  const insertDocumentStatement = database.prepare(`
    INSERT INTO documents (
      id,
      title,
      created_at,
      updated_at,
      created_by_name,
      is_deleted
    ) VALUES (
      @id,
      @title,
      @createdAt,
      @updatedAt,
      @createdByName,
      @isDeleted
    )
  `);

  const selectDocumentByIdStatement = database.prepare(`
    SELECT
      id,
      title,
      created_at,
      updated_at,
      created_by_name,
      is_deleted
    FROM documents
    WHERE id = ?
  `);

  const updateDocumentStatement = database.prepare(`
    UPDATE documents
    SET title = @title,
        updated_at = @updatedAt
    WHERE id = @id
  `);

  const deleteDocumentStatement = database.prepare(`
    UPDATE documents
    SET is_deleted = 1,
        updated_at = @updatedAt
    WHERE id = @id AND is_deleted = 0
  `);

  const selectAllDocumentsStatement = database.prepare(`
    SELECT
      id,
      title,
      created_at,
      updated_at,
      created_by_name,
      is_deleted
    FROM documents
    WHERE is_deleted = 0
    ORDER BY updated_at DESC
  `);

  return {
    createDocument(input: CreateDocumentInput) {
      const document: DocumentMeta = {
        id: nanoid(),
        title: input.title ?? "未命名文档",
        createdAt: input.now,
        updatedAt: input.now,
        createdByName: input.createdByName,
        isDeleted: false
      };

      insertDocumentStatement.run({
        id: document.id,
        title: document.title,
        createdAt: document.createdAt,
        updatedAt: document.updatedAt,
        createdByName: document.createdByName,
        isDeleted: 0
      });

      return document;
    },
    getDocumentById(documentId: string) {
      const row = selectDocumentByIdStatement.get(documentId) as DocumentRow | undefined;
      return row ? mapDocumentRow(row) : null;
    },
    getAllDocuments() {
      const rows = selectAllDocumentsStatement.all() as DocumentRow[];
      return rows.map(mapDocumentRow);
    },
    updateDocumentMeta(documentId: string, title: string, updatedAt: string) {
      updateDocumentStatement.run({
        id: documentId,
        title,
        updatedAt
      });
    },
    deleteDocument(documentId: string, updatedAt: string) {
      const result = deleteDocumentStatement.run({
        id: documentId,
        updatedAt
      });
      return result.changes > 0;
    }
  };
}
