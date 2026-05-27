import { once } from "node:events";
import { closeSync, createReadStream, existsSync, openSync, readSync, statSync } from "node:fs";
import path from "node:path";
import type { Writable } from "node:stream";
import { DATA_DIRECTORY } from "../../db/index.js";
import { getDataAccess } from "../../services/data-access.js";
import type { MediaAsset } from "../../types/domain.js";

type ZipEntry = {
  name: string;
  size: number;
  checksum: number;
  content?: Buffer;
  filePath?: string;
};

function escapeMarkdownLabel(value: string) {
  return value.replaceAll("[", "\\[").replaceAll("]", "\\]");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

function updateCrc32(crc: number, content: Buffer) {
  let result = crc;
  for (const byte of content) {
    result ^= byte;
    for (let index = 0; index < 8; index += 1) {
      result = (result >>> 1) ^ (0xedb88320 & -(result & 1));
    }
  }
  return result;
}

function crc32ForBuffer(content: Buffer) {
  return (updateCrc32(0xffffffff, content) ^ 0xffffffff) >>> 0;
}

function crc32ForFile(filePath: string) {
  const descriptor = openSync(filePath, "r");
  const buffer = Buffer.alloc(64 * 1024);
  let checksum = 0xffffffff;
  try {
    let bytesRead = 0;
    while ((bytesRead = readSync(descriptor, buffer, 0, buffer.length, null)) > 0) {
      checksum = updateCrc32(checksum, buffer.subarray(0, bytesRead));
    }
  } finally {
    closeSync(descriptor);
  }
  return (checksum ^ 0xffffffff) >>> 0;
}

function createLocalHeader(entry: ZipEntry, fileName: Buffer) {
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0x0800, 6);
  header.writeUInt32LE(entry.checksum, 14);
  header.writeUInt32LE(entry.size, 18);
  header.writeUInt32LE(entry.size, 22);
  header.writeUInt16LE(fileName.length, 26);
  return header;
}

function createCentralHeader(entry: ZipEntry, fileName: Buffer, localOffset: number) {
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(0x0800, 8);
  header.writeUInt32LE(entry.checksum, 16);
  header.writeUInt32LE(entry.size, 20);
  header.writeUInt32LE(entry.size, 24);
  header.writeUInt16LE(fileName.length, 28);
  header.writeUInt32LE(localOffset, 42);
  return header;
}

async function writeBuffer(output: Writable, content: Buffer) {
  if (!output.write(content)) {
    await once(output, "drain");
  }
}

async function writeEntryContent(output: Writable, entry: ZipEntry) {
  if (entry.content) {
    await writeBuffer(output, entry.content);
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(entry.filePath!);
    stream.on("error", reject);
    stream.on("end", resolve);
    stream.pipe(output, { end: false });
  });
}

export async function streamMediaArchive(markdown: string, output: Writable) {
  const dataAccess = getDataAccess();
  const mediaEntries: ZipEntry[] = [];
  const includedMedia = new Map<string, string>();
  function includeAsset(asset: MediaAsset) {
    const existingPath = includedMedia.get(asset.id);
    if (existingPath) {
      return existingPath;
    }

    const filePath = path.join(DATA_DIRECTORY, "media", asset.storageName);
    if (!existsSync(filePath)) {
      return null;
    }
    const archivePath = `media/${asset.id}${path.extname(asset.storageName)}`;
    includedMedia.set(asset.id, archivePath);
    mediaEntries.push({
      name: archivePath,
      size: statSync(filePath).size,
      checksum: crc32ForFile(filePath),
      filePath
    });
    return archivePath;
  }

  const videoPattern =
    /!video\[([^\]]*)\]\(\/api\/media\/([^)\s/]+)\/content\)(?:\{width=(\d{2,4})\})?/g;
  const imagePattern =
    /!image\[([^\]]*)\]\(\/api\/media\/([^)\s/]+)\/content\)(?:\{width=(\d{2,4})\})?/g;
  const markdownImagePattern =
    /!\[([^\]]*)\]\(\/api\/media\/([^)\s/]+)\/content\)/g;

  let documentContent = markdown.replace(
    videoPattern,
    (_source, label: string, encodedAssetId: string, width: string | undefined) => {
      const asset = dataAccess.mediaAssets.getAssetById(decodeURIComponent(encodedAssetId));
      if (!asset || asset.mediaType !== "video") {
        return `[视频资源不可用：${label || "未命名视频"}]`;
      }
      const archivePath = includeAsset(asset);
      if (!archivePath) {
        return `[视频文件缺失：${label || asset.originalName}]`;
      }
      const title = escapeHtml(label || asset.originalName);
      const widthAttribute = width ? ` width="${width}"` : "";
      return `<video controls src="${archivePath}"${widthAttribute} title="${title}"></video>`;
    }
  );

  documentContent = documentContent.replace(
    imagePattern,
    (_source, label: string, encodedAssetId: string) => {
      const asset = dataAccess.mediaAssets.getAssetById(decodeURIComponent(encodedAssetId));
      if (!asset || asset.mediaType !== "image") {
        return `[图片资源不可用：${label || "未命名图片"}]`;
      }
      const archivePath = includeAsset(asset);
      return archivePath
        ? `![${escapeMarkdownLabel(label || asset.originalName)}](${archivePath})`
        : `[图片文件缺失：${label || asset.originalName}]`;
    }
  );

  documentContent = documentContent.replace(
    markdownImagePattern,
    (_source, label: string, encodedAssetId: string) => {
      const asset = dataAccess.mediaAssets.getAssetById(decodeURIComponent(encodedAssetId));
      if (!asset || asset.mediaType !== "image") {
        return `[图片资源不可用：${label || "未命名图片"}]`;
      }
      const archivePath = includeAsset(asset);
      return archivePath
        ? `![${escapeMarkdownLabel(label || asset.originalName)}](${archivePath})`
        : `[图片文件缺失：${label || asset.originalName}]`;
    }
  );

  const markdownBuffer = Buffer.from(documentContent, "utf8");
  const entries: ZipEntry[] = [
    {
      name: "document.md",
      size: markdownBuffer.length,
      checksum: crc32ForBuffer(markdownBuffer),
      content: markdownBuffer
    },
    ...mediaEntries
  ];
  const centralParts: Buffer[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const fileName = Buffer.from(entry.name, "utf8");
    const localHeader = createLocalHeader(entry, fileName);
    await writeBuffer(output, localHeader);
    await writeBuffer(output, fileName);
    await writeEntryContent(output, entry);
    centralParts.push(createCentralHeader(entry, fileName, localOffset), fileName);
    localOffset += localHeader.length + fileName.length + entry.size;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localOffset, 16);
  await writeBuffer(output, centralDirectory);
  await writeBuffer(output, end);
  output.end();
}
