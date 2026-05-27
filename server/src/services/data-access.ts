import { getDatabase } from "../db/index.js";
import { createChatRepository } from "../modules/chat/index.js";
import { createDocumentsRepository } from "../modules/documents/index.js";
import { createHistoryRepository } from "../modules/history/index.js";
import { createMediaAssetsRepository } from "../modules/media-assets/index.js";
import { createSystemEventsRepository } from "../modules/system-events/index.js";
import { createYjsRepository } from "../modules/yjs/index.js";

export function getDataAccess() {
  const database = getDatabase();

  return {
    documents: createDocumentsRepository(database),
    history: createHistoryRepository(database),
    chat: createChatRepository(database),
    mediaAssets: createMediaAssetsRepository(database),
    systemEvents: createSystemEventsRepository(database),
    yjs: createYjsRepository(database)
  };
}

export type DataAccess = ReturnType<typeof getDataAccess>;
