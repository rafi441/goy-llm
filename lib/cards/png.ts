const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]!) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function isPng(buf: Buffer): boolean {
  return buf.length >= 8 && buf.subarray(0, 8).equals(PNG_SIGNATURE);
}

interface Chunk {
  type: string;
  data: Buffer;
}

function readChunks(buf: Buffer): Chunk[] {
  const chunks: Chunk[] = [];
  let offset = 8;
  while (offset + 8 <= buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString('latin1', offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > buf.length) break;
    chunks.push({ type, data: buf.subarray(dataStart, dataEnd) });
    offset = dataEnd + 4;
    if (type === 'IEND') break;
  }
  return chunks;
}

function decodeTextChunk(data: Buffer): { keyword: string; text: string } | null {
  const sep = data.indexOf(0);
  if (sep === -1) return null;
  const keyword = data.toString('latin1', 0, sep);
  const text = data.toString('latin1', sep + 1);
  return { keyword, text };
}

function encodeTextChunk(keyword: string, text: string): Buffer {
  const kw = Buffer.from(keyword, 'latin1');
  const sep = Buffer.from([0]);
  const txt = Buffer.from(text, 'latin1');
  const data = Buffer.concat([kw, sep, txt]);
  const typeAndData = Buffer.concat([Buffer.from('tEXt', 'latin1'), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([length, typeAndData, crc]);
}

export interface ExtractedCard {
  raw: string;
  keyword: 'chara' | 'ccv3';
}

export function extractCardText(buf: Buffer): ExtractedCard | null {
  if (!isPng(buf)) return null;
  const chunks = readChunks(buf);
  let chara: string | null = null;
  let ccv3: string | null = null;
  for (const c of chunks) {
    if (c.type !== 'tEXt') continue;
    const t = decodeTextChunk(c.data);
    if (!t) continue;
    if (t.keyword === 'ccv3') ccv3 = decodeBase64Utf8(t.text);
    else if (t.keyword === 'chara') chara = decodeBase64Utf8(t.text);
  }
  if (ccv3) return { raw: ccv3, keyword: 'ccv3' };
  if (chara) return { raw: chara, keyword: 'chara' };
  return null;
}

function decodeBase64Utf8(text: string): string {
  return Buffer.from(text.trim(), 'base64').toString('utf8');
}

function encodeBase64Utf8(json: string): string {
  return Buffer.from(json, 'utf8').toString('base64');
}

export function embedCardText(
  pngBuf: Buffer,
  entries: { keyword: 'chara' | 'ccv3'; json: string }[],
): Buffer {
  if (!isPng(pngBuf)) throw new Error('Not a valid PNG file');
  const chunks = readChunks(pngBuf);
  const out: Buffer[] = [Buffer.from(PNG_SIGNATURE)];

  const skipKeywords = new Set(entries.map((e) => e.keyword));
  let inserted = false;

  const rebuildChunk = (c: Chunk): Buffer => {
    const typeAndData = Buffer.concat([Buffer.from(c.type, 'latin1'), c.data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(c.data.length, 0);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typeAndData), 0);
    return Buffer.concat([length, typeAndData, crc]);
  };

  for (const c of chunks) {
    if (c.type === 'tEXt') {
      const t = decodeTextChunk(c.data);
      if (t && skipKeywords.has(t.keyword as 'chara' | 'ccv3')) continue;
    }
    if (c.type === 'IEND' && !inserted) {
      for (const e of entries) out.push(encodeTextChunk(e.keyword, encodeBase64Utf8(e.json)));
      inserted = true;
    }
    out.push(rebuildChunk(c));
  }
  return Buffer.concat(out);
}
