import type Database from "better-sqlite3";
import type { MediaAsset } from "../../types/domain.js";

type MediaAssetRow = {
  id: string;
  original_name: string;
  media_type: "image" | "video";
  mime_type: string;
  size_bytes: number;
  storage_name: string;
  uploaded_by_name: string;
  created_at: string;
};

function mapMediaAssetRow(row: MediaAssetRow): MediaAsset {
  return {
    id: row.id,
    originalName: row.original_name,
    mediaType: row.media_type,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    storageName: row.storage_name,
    uploadedByName: row.uploaded_by_name,
    createdAt: row.created_at
  };
}

export function createMediaAssetsRepository(database: Database.Database) {
  const insertAssetStatement = database.prepare(`
    INSERT INTO media_assets (
      id,
      original_name,
      media_type,
      mime_type,
      size_bytes,
      storage_name,
      uploaded_by_name,
      created_at
    ) VALUES (
      @id,
      @originalName,
      @mediaType,
      @mimeType,
      @sizeBytes,
      @storageName,
      @uploadedByName,
      @createdAt
    )
  `);
  const selectAssetByIdStatement = database.prepare(`
    SELECT
      id,
      original_name,
      media_type,
      mime_type,
      size_bytes,
      storage_name,
      uploaded_by_name,
      created_at
    FROM media_assets
    WHERE id = ?
  `);
  const selectAssetsStatement = database.prepare(`
    SELECT
      id,
      original_name,
      media_type,
      mime_type,
      size_bytes,
      storage_name,
      uploaded_by_name,
      created_at
    FROM media_assets
    ORDER BY created_at DESC
  `);
  const deleteAssetStatement = database.prepare(`
    DELETE FROM media_assets
    WHERE id = ?
  `);

  return {
    createAsset(asset: MediaAsset) {
      insertAssetStatement.run(asset);
      return asset;
    },
    getAssetById(assetId: string) {
      const row = selectAssetByIdStatement.get(assetId) as MediaAssetRow | undefined;
      return row ? mapMediaAssetRow(row) : null;
    },
    getAssets() {
      const rows = selectAssetsStatement.all() as MediaAssetRow[];
      return rows.map(mapMediaAssetRow);
    },
    deleteAsset(assetId: string) {
      deleteAssetStatement.run(assetId);
    }
  };
}
