import type { DocumentMeta, DocumentState } from "../../types/domain.js";
import { HttpError } from "../../services/http-errors.js";
import { getDataAccess } from "../../services/data-access.js";
import {
  forcePersistDocumentState,
  getCurrentDocumentState
} from "../yjs/index.js";

type DocumentDetail = {
  document: DocumentMeta;
  content: string;
  stateRevision: number;
  latestSnapshotVersion: number;
  updatedAt: string;
};

type SaveDocumentInput = {
  docId: string;
  name: string;
  title?: string;
};

function emptyState(docId: string, updatedAt: string): DocumentState {
  return {
    docId,
    yjsState: new Uint8Array(),
    plainText: "",
    markdownText: "",
    stateRevision: 0,
    updatedAt
  };
}

export function createDocumentService() {
  return {
    getAllDocuments() {
      const dataAccess = getDataAccess();
      return dataAccess.documents.getAllDocuments();
    },
    createDocument(name: string, title?: string) {
      const dataAccess = getDataAccess();
      const now = new Date().toISOString();
      const document = dataAccess.documents.createDocument({
        createdByName: name,
        title,
        now
      });

      const state = emptyState(document.id, now);
      dataAccess.yjs.upsertDocumentState({
        docId: state.docId,
        yjsState: state.yjsState,
        plainText: state.plainText,
        markdownText: state.markdownText,
        stateRevision: state.stateRevision,
        updatedAt: state.updatedAt
      });

      return {
        id: document.id,
        title: document.title,
        createdByName: document.createdByName
      };
    },
    getDocumentDetail(docId: string): DocumentDetail {
      const dataAccess = getDataAccess();
      const document = dataAccess.documents.getDocumentById(docId);

      if (!document || document.isDeleted) {
        throw new HttpError(404, "Document not found.");
      }

      const state =
        getCurrentDocumentState(docId) ??
        dataAccess.yjs.getDocumentState(docId) ??
        emptyState(docId, document.updatedAt);

      const latestSnapshotVersion = dataAccess.history.getLatestSnapshotVersion(docId);

      return {
        document,
        content: state.markdownText,
        stateRevision: state.stateRevision,
        latestSnapshotVersion,
        updatedAt: state.updatedAt
      };
    },
    saveDocument(input: SaveDocumentInput) {
      const dataAccess = getDataAccess();
      const detail = this.getDocumentDetail(input.docId);
      const now = new Date().toISOString();
      const nextTitle = input.title ?? detail.document.title;
      const savedState = forcePersistDocumentState(input.docId);

      dataAccess.documents.updateDocumentMeta(input.docId, nextTitle, now);

      const nextSnapshotVersion =
        dataAccess.history.getLatestSnapshotVersion(input.docId) + 1;

      const snapshot = dataAccess.history.createSnapshot({
        docId: input.docId,
        snapshotVersion: nextSnapshotVersion,
        title: nextTitle,
        content: savedState.markdownText,
        savedByName: input.name,
        savedAt: now
      });

      dataAccess.systemEvents.createSystemEvent({
        docId: input.docId,
        eventType: "document_saved",
        payloadJson: JSON.stringify({
          snapshotVersion: nextSnapshotVersion,
          name: input.name
        }),
        createdAt: now
      });

      return {
        snapshot,
        stateRevision: savedState.stateRevision,
        title: nextTitle,
        updatedAt: now
      };
    },
    updateDocumentTitle(docId: string, title: string) {
      const dataAccess = getDataAccess();
      const document = dataAccess.documents.getDocumentById(docId);

      if (!document || document.isDeleted) {
        throw new HttpError(404, "文档未找到。");
      }

      const now = new Date().toISOString();
      dataAccess.documents.updateDocumentMeta(docId, title, now);

      return {
        id: docId,
        title,
        updatedAt: now
      };
    },
    deleteDocument(docId: string) {
      const dataAccess = getDataAccess();
      const document = dataAccess.documents.getDocumentById(docId);

      if (!document || document.isDeleted) {
        throw new HttpError(404, "文档未找到。");
      }

      const now = new Date().toISOString();
      const deleted = dataAccess.documents.deleteDocument(docId, now);

      if (!deleted) {
        throw new HttpError(404, "文档未找到。");
      }

      return { id: docId, deletedAt: now };
    }
  };
}
