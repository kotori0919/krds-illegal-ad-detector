import ExcelJS from "exceljs";
import { Unzip, UnzipInflate } from "fflate";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import type { ImportedTarget, ImportRow, TargetPreview } from "@krds-detector/contracts";

const MAX_INPUT = 2 * 1024 * 1024;
const MAX_EXPANDED = 8 * 1024 * 1024;
const MAX_ENTRY = 4 * 1024 * 1024;
const MAX_TARGETS = 100;
const MAX_ZIP_ENTRIES = 128;
const MAX_PARSE_MS = 2_000;
const LABEL_ALIASES = new Set(["사이트명", "label", "sitename", "name"]);
const URL_ALIASES = new Set(["시작 주소", "entryurl", "url"]);
const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false, parseAttributeValue: false, trimValues: true });
const decoder = new TextDecoder("utf-8", { fatal: true });

type SourceRow = { row: number; label?: unknown; url?: unknown; kind?: unknown; error?: string };
type ZipEntry = { name: string; expanded: number; compressed: number; offset: number; method: number; flags: number };

function fail(message: string): never { throw new Error(message); }
function text(bytes: Uint8Array): string {
  try { return decoder.decode(bytes).replace(/^\uFEFF/, ""); }
  catch { return fail("UTF-8로 저장한 파일을 사용해 주세요."); }
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function asArray(value: unknown): unknown[] { return value === undefined ? [] : Array.isArray(value) ? value : [value]; }
function withinTime(start: number): void {
  if (performance.now() - start > MAX_PARSE_MS) fail("파일 분석 시간 제한을 초과했습니다.");
}
function unsafeCharacters(value: string, allowTextWhitespace = false, forbidSpace = false): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if ((code < 32 && !(allowTextWhitespace && [9, 10, 13].includes(code))) || code === 127 || (forbidSpace && code === 32)) return true;
  }
  return false;
}

/** Textual validation only. DNS and redirect checks belong to the scan transport. */
function targetOf(source: SourceRow): ImportedTarget {
  if (source.error) fail(source.error);
  if (typeof source.url !== "string" || !source.url.trim()) fail("시작 주소가 비어 있거나 문자열이 아닙니다.");
  const input = source.url.trim();
  if (input.length > 2048 || unsafeCharacters(input, false, true) || input.includes("\\")) fail("시작 주소 길이 또는 문자 형식을 확인해 주세요.");
  let url: URL;
  try { url = new URL(input); } catch { return fail("올바른 시작 주소를 입력해 주세요."); }
  if (!/^https?:$/.test(url.protocol)) fail("http 또는 https 주소만 사용할 수 있습니다.");
  if (url.username || url.password) fail("사용자 정보가 포함된 주소는 사용할 수 없습니다.");
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  // URL canonicalization also exposes octal, hexadecimal and shortened IPv4 literals.
  if (/^[\d.]+$/.test(hostname) || hostname.includes(":")) fail("IP 주소 대신 공개 사이트의 도메인 이름을 사용해 주세요.");
  const labels = hostname.split(".");
  if (hostname.length > 253 || labels.length < 2 || labels.some((part) => !/^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i.test(part))) {
    fail("공개 도메인 이름 형식의 주소를 사용해 주세요.");
  }
  if (/(?:^|\.)(?:localhost|local|internal|lan|home|home\.arpa)$/.test(hostname)
    || /(?:^|\.)metadata(?:\.|$)/.test(hostname)) fail("로컬 또는 메타데이터 주소는 사용할 수 없습니다.");
  const kind = source.kind === undefined ? "site" : source.kind;
  if (kind !== "site" && kind !== "sitemap") fail("대상 종류는 site 또는 sitemap이어야 합니다.");
  if (source.label !== undefined && typeof source.label !== "string") fail("사이트명은 문자열이어야 합니다.");
  const label = typeof source.label === "string" && source.label.trim() ? source.label.trim() : hostname;
  if (label.length > 200 || unsafeCharacters(label, true)) fail("사이트명은 200자 이내의 일반 텍스트로 입력해 주세요.");
  url.hostname = hostname;
  url.hash = "";
  url.searchParams.sort(); // Stable key sort retains repeated-key value order.
  if (url.href.length > 2048) fail("시작 주소는 2048자 이내여야 합니다.");
  return { label, entryUrl: url.href, kind };
}

function preview(format: TargetPreview["format"], sources: SourceRow[]): TargetPreview {
  if (sources.length > MAX_TARGETS) fail("한 파일에는 최대 100개의 점검 대상만 넣을 수 있습니다.");
  if (!sources.length) fail("파일에 점검 대상이 없습니다.");
  const seen = new Set<string>();
  const rows: ImportRow[] = sources.map((source) => {
    try {
      const target = targetOf(source);
      // The same entry URL is one target even if labels/kinds differ.
      if (seen.has(target.entryUrl)) return { row: source.row, target, status: "duplicate", reason: "같은 시작 주소가 앞 행에 있습니다." };
      seen.add(target.entryUrl);
      return { row: source.row, target, status: "valid" };
    } catch (error) {
      return { row: source.row, status: "invalid", reason: error instanceof Error ? error.message : "입력 행을 확인해 주세요." };
    }
  });
  return { format, rows, valid: rows.filter((row) => row.status === "valid").length,
    invalid: rows.filter((row) => row.status === "invalid").length,
    duplicate: rows.filter((row) => row.status === "duplicate").length };
}

function mapping(headers: unknown[]): { label?: number; url: number; kind?: number } {
  let label: number | undefined; let url: number | undefined; let kind: number | undefined;
  for (const [index, value] of headers.entries()) {
    if (value === undefined || value === null || value === "") continue;
    if (typeof value !== "string") fail("열 제목은 텍스트여야 합니다.");
    const name = value.trim().toLowerCase();
    if (LABEL_ALIASES.has(name)) {
      if (label !== undefined) fail("사이트명 열이 여러 개입니다. 한 열만 남겨 주세요.");
      label = index;
    } else if (URL_ALIASES.has(name)) {
      if (url !== undefined) fail("시작 주소 열이 여러 개입니다. 한 열만 남겨 주세요.");
      url = index;
    } else if (name === "kind") {
      if (kind !== undefined) fail("대상 종류 열이 여러 개입니다. 한 열만 남겨 주세요.");
      kind = index;
    }
  }
  if (url === undefined) fail("시작 주소 열을 찾지 못했습니다. '시작 주소', 'entryUrl' 또는 'url'을 사용해 주세요.");
  return { label, url, kind };
}

function tabular(records: { row: number; values: unknown[] }[]): SourceRow[] {
  const nonempty = records.filter(({ values }) => values.some((value) => value !== undefined && value !== null && value !== ""));
  if (!nonempty.length) fail("열 제목과 점검 대상을 입력해 주세요.");
  const header = nonempty[0]!;
  const columns = mapping(header.values);
  return nonempty.slice(1).map(({ row, values }) => ({ row, url: values[columns.url],
    label: columns.label === undefined ? undefined : values[columns.label],
    kind: columns.kind === undefined || values[columns.kind] === "" ? undefined : values[columns.kind],
    error: values.length > header.values.length ? "열 제목보다 많은 값이 있습니다." : undefined }));
}

function csvRows(input: string): SourceRow[] {
  const records: { row: number; values: string[] }[] = [];
  let values: string[] = []; let value = ""; let quoted = false; let closed = false;
  let line = 1; let recordLine = 1;
  const cell = () => { values.push(value); value = ""; closed = false; if (values.length > 64) fail("CSV 열은 64개 이내여야 합니다."); };
  const record = () => {
    cell(); records.push({ row: recordLine, values }); values = [];
    if (records.length > 1000) fail("CSV 행이 너무 많습니다. 최대 100개 점검 대상을 사용해 주세요.");
  };
  for (let index = 0; index < input.length; index++) {
    const char = input[index]!;
    if (quoted) {
      if (char === '"') {
        if (input[index + 1] === '"') { value += '"'; index++; } else { quoted = false; closed = true; }
      } else { value += char; if (char === "\n" || (char === "\r" && input[index + 1] !== "\n")) line++; }
    } else if (char === ",") cell();
    else if (char === "\r" || char === "\n") {
      if (char === "\r" && input[index + 1] === "\n") index++;
      record(); line++; recordLine = line;
    } else if (char === '"' && !value && !closed) quoted = true;
    else {
      if (closed || char === '"') fail(`CSV ${line}행의 따옴표 형식을 확인해 주세요.`);
      value += char;
    }
  }
  if (quoted) fail("CSV 따옴표가 닫히지 않았습니다.");
  if (value || values.length || closed) record();
  return tabular(records);
}

function jsonRows(input: string): SourceRow[] {
  const rows: SourceRow[] = [];
  for (const [index, line] of input.split(/\r\n|\n|\r/).entries()) {
    if (!line.trim()) continue;
    try {
      const entry: unknown = JSON.parse(line);
      if (!object(entry)) fail("JSONL의 각 행은 대상 객체여야 합니다.");
      // JSON.parse otherwise silently replaces duplicate object keys with the last value.
      let depth = 0; let keyExpected = false; const seenKeys = new Set<string>();
      for (const token of line.matchAll(/"(?:[^"\\]|\\[\s\S])*"|[{}[\],:]/g)) {
        const value = token[0];
        if (value === "{" || value === "[") { depth++; if (depth === 1) keyExpected = true; }
        else if (value === "}" || value === "]") depth--;
        else if (depth === 1 && value === ",") keyExpected = true;
        else if (depth === 1 && value.startsWith('"') && keyExpected) {
          const key = JSON.parse(value) as string;
          if (seenKeys.has(key)) fail("JSONL 행에 같은 필드가 여러 번 있습니다.");
          seenKeys.add(key); keyExpected = false;
        }
      }
      const keys = Object.keys(entry);
      const columns = mapping(keys);
      rows.push({ row: index + 1, label: columns.label === undefined ? undefined : entry[keys[columns.label]!],
        url: entry[keys[columns.url]!], kind: columns.kind === undefined ? undefined : entry[keys[columns.kind]!] });
    } catch (error) {
      rows.push({ row: index + 1, error: error instanceof Error ? error.message : "JSONL 행 형식을 확인해 주세요." });
    }
    if (rows.length > MAX_TARGETS) fail("한 파일에는 최대 100개의 점검 대상만 넣을 수 있습니다.");
  }
  return rows;
}

function checkedXml(input: string): Record<string, unknown> {
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(input)) fail("XML DTD 및 entity 선언은 허용하지 않습니다.");
  if (/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);)/i.test(input)) fail("XML의 알 수 없는 entity 참조는 허용하지 않습니다.");
  let depth = 0; let elements = 0;
  for (const match of input.matchAll(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<[^>]*>/g)) {
    const tag = match[0];
    if (tag.startsWith("<!") || tag.startsWith("<?")) continue;
    if (tag.startsWith("</")) depth--;
    else { elements++; if (!tag.endsWith("/>")) depth++; }
    if (depth > 32 || elements > 50_000) fail("XML 구조 또는 항목 수가 제한을 초과했습니다.");
  }
  const valid = XMLValidator.validate(input);
  if (valid !== true) fail("XML 형식이 올바르지 않습니다.");
  const result: unknown = parser.parse(input);
  if (!object(result)) fail("XML 루트 형식이 올바르지 않습니다.");
  return result;
}

function xmlRows(input: string): SourceRow[] {
  const parsed = checkedXml(input);
  const roots = Object.keys(parsed).filter((key) => key !== "?xml");
  if (roots.length !== 1 || !["urlset", "sitemapindex"].includes(roots[0]!)) fail("XML은 sitemap urlset 또는 sitemapindex여야 합니다.");
  const index = roots[0] === "sitemapindex";
  const root = parsed[roots[0]!]!;
  if (!object(root)) fail("XML sitemap에 점검 대상이 없습니다.");
  const namespace = root["@_xmlns"];
  if (namespace !== undefined && namespace !== "http://www.sitemaps.org/schemas/sitemap/0.9") fail("XML sitemap namespace가 올바르지 않습니다.");
  const key = index ? "sitemap" : "url";
  if (Object.keys(root).some((name) => name !== key && !name.startsWith("@_"))) fail("XML sitemap 루트에 지원하지 않는 항목이 있습니다.");
  return asArray(root[key]).map((entry, ordinal) => {
    if (!object(entry) || typeof entry.loc !== "string"
      || Object.keys(entry).some((name) => !["loc", "lastmod", ...(index ? [] : ["changefreq", "priority"])].includes(name))) {
      fail("XML sitemap의 각 항목에는 하나의 loc 주소가 필요합니다.");
    }
    return { row: ordinal + 1, url: entry.loc, kind: index ? "sitemap" : "site" };
  });
}

function zipDirectory(bytes: Uint8Array): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i--) {
    if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === bytes.length) { end = i; break; }
  }
  if (end < 0) fail("XLSX ZIP 파일이 잘렸거나 올바르지 않습니다.");
  const count = view.getUint16(end + 10, true);
  const directorySize = view.getUint32(end + 12, true);
  const directoryOffset = view.getUint32(end + 16, true);
  if (view.getUint16(end + 4, true) || view.getUint16(end + 6, true) || view.getUint16(end + 8, true) !== count
    || count === 0xffff || directoryOffset === 0xffffffff || directorySize === 0xffffffff) fail("XLSX 분할 ZIP 및 ZIP64는 지원하지 않습니다.");
  if (count > MAX_ZIP_ENTRIES) fail("XLSX ZIP entries는 최대 128개입니다.");
  if (directoryOffset + directorySize !== end) fail("XLSX ZIP 중앙 목록이 올바르지 않습니다.");
  const entries: ZipEntry[] = []; const names = new Set<string>();
  let position = directoryOffset;
  for (let i = 0; i < count; i++) {
    if (position + 46 > end || view.getUint32(position, true) !== 0x02014b50) fail("XLSX ZIP 항목이 올바르지 않습니다.");
    const flags = view.getUint16(position + 8, true); const method = view.getUint16(position + 10, true);
    const compressed = view.getUint32(position + 20, true); const expanded = view.getUint32(position + 24, true);
    const nameLength = view.getUint16(position + 28, true); const extraLength = view.getUint16(position + 30, true);
    const commentLength = view.getUint16(position + 32, true); const offset = view.getUint32(position + 42, true);
    const next = position + 46 + nameLength + extraLength + commentLength;
    if (next > end || nameLength > 512 || offset + 30 > directoryOffset) fail("XLSX ZIP 항목 범위가 올바르지 않습니다.");
    const name = text(bytes.subarray(position + 46, position + 46 + nameLength));
    if (!name || names.has(name.toLowerCase()) || unsafeCharacters(name) || /(?:^\/|\\|(?:^|\/)\.\.?(?:\/|$))/.test(name)) fail("XLSX ZIP 항목 경로가 올바르지 않습니다.");
    names.add(name.toLowerCase());
    if ((flags & 1) || ![0, 8].includes(method) || view.getUint16(position + 34, true)) fail("XLSX 암호화 또는 지원하지 않는 압축 형식입니다.");
    if (expanded > MAX_ENTRY || compressed === 0xffffffff || expanded === 0xffffffff) fail("XLSX 압축 해제(expanded) 크기 제한을 초과했습니다.");
    if (view.getUint32(offset, true) !== 0x04034b50 || view.getUint16(offset + 6, true) !== flags || view.getUint16(offset + 8, true) !== method) fail("XLSX ZIP 로컬 항목이 일치하지 않습니다.");
    const localNameLength = view.getUint16(offset + 26, true); const localExtraLength = view.getUint16(offset + 28, true);
    const dataOffset = offset + 30 + localNameLength + localExtraLength;
    if (dataOffset + compressed > directoryOffset || text(bytes.subarray(offset + 30, offset + 30 + localNameLength)) !== name) fail("XLSX ZIP 데이터 범위가 올바르지 않습니다.");
    if (!(flags & 8) && (view.getUint32(offset + 18, true) !== compressed || view.getUint32(offset + 22, true) !== expanded)) fail("XLSX ZIP 크기 목록이 일치하지 않습니다.");
    entries.push({ name, compressed, expanded, offset, flags, method }); position = next;
  }
  if (position !== end) fail("XLSX ZIP 항목 목록이 올바르지 않습니다.");
  return entries;
}

function safeWorkbookArchive(bytes: Uint8Array, start: number): Map<string, Uint8Array> {
  const directory = zipDirectory(bytes);
  const expected = new Map(directory.map((entry) => [entry.name, entry]));
  const files = new Map<string, Uint8Array>();
  let expandedTotal = 0; let entryCount = 0; let error: Error | undefined;
  const unzip = new Unzip((file) => {
    if (error) return;
    const expectedEntry = expected.get(file.name);
    if (!expectedEntry || ++entryCount > MAX_ZIP_ENTRIES || files.has(file.name)) fail("XLSX ZIP 항목이 중앙 목록과 다릅니다.");
    if (/(?:vba|macrosheets|embeddings|activex|externallinks|connections|\.bin$)/i.test(file.name)) fail("XLSX active content 또는 connection은 사용할 수 없습니다.");
    let size = 0; const chunks: Uint8Array[] = [];
    file.ondata = (issue, data, final) => {
      if (error) return;
      if (issue) { error = new Error("XLSX 압축 데이터를 읽을 수 없습니다."); file.terminate(); return; }
      size += data.length; expandedTotal += data.length;
      if (size > MAX_ENTRY || expandedTotal > MAX_EXPANDED) {
        error = new Error("XLSX 실제 압축 해제(expanded) 크기 제한을 초과했습니다."); file.terminate(); return;
      }
      withinTime(start);
      chunks.push(data);
      if (final) {
        if (size !== expectedEntry.expanded) { error = new Error("XLSX 실제 expanded 크기가 목록과 다릅니다."); return; }
        const combined = new Uint8Array(size); let at = 0;
        for (const chunk of chunks) { combined.set(chunk, at); at += chunk.length; }
        files.set(file.name, combined);
      }
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  // Small compressed chunks bound expansion between callbacks, even with lying ZIP sizes.
  for (let at = 0; at < bytes.length; at += 128) {
    withinTime(start);
    try { unzip.push(bytes.subarray(at, at + 128), at + 128 >= bytes.length); }
    catch (issue) { if (!error) error = issue instanceof Error ? issue : new Error("XLSX ZIP 형식 오류입니다."); }
    if (error) throw error;
  }
  if (entryCount !== directory.length || files.size !== directory.length) fail("XLSX ZIP 항목이 잘렸습니다.");
  if (!files.has("[Content_Types].xml") || !files.has("xl/workbook.xml")) fail("XLSX workbook 파일이 없습니다.");
  for (const [name, contents] of files) {
    if (!/\.(?:xml|rels)$/i.test(name)) continue;
    withinTime(start);
    const input = text(contents);
    const parsed = checkedXml(input);
    if (name === "[Content_Types].xml") {
      const root = parsed.Types;
      if (!object(root)) fail("XLSX content types 형식이 올바르지 않습니다.");
      for (const declaration of [...asArray(root.Default), ...asArray(root.Override)]) {
        if (!object(declaration) || typeof declaration["@_ContentType"] !== "string") fail("XLSX content type 형식이 올바르지 않습니다.");
        if (/macroEnabled|vbaProject|oleObject|externalLink|activeX|connections/i.test(declaration["@_ContentType"])) fail("XLSX active content 또는 connection은 사용할 수 없습니다.");
      }
    }
    if (/\.rels$/i.test(name)) {
      const root = parsed.Relationships;
      if (!object(root)) fail("XLSX relationship 형식이 올바르지 않습니다.");
      for (const relation of asArray(root.Relationship)) {
        if (!object(relation)) fail("XLSX relationship 형식이 올바르지 않습니다.");
        const mode = relation["@_TargetMode"]; const destination = relation["@_Target"];
        if ((typeof mode === "string" && mode.toLowerCase() === "external")
          || (typeof destination === "string" && /^(?:[a-z][a-z\d+.-]*:|\/\/|\\\\)/i.test(destination))) fail("XLSX external relationship은 사용할 수 없습니다.");
        if (typeof relation["@_Type"] === "string" && /vbaProject|oleObject|externalLink|activeX|connections/i.test(relation["@_Type"])) fail("XLSX active relationship은 사용할 수 없습니다.");
      }
    }
    if (name === "xl/workbook.xml") {
      const root = parsed.workbook;
      const sheets = object(root) && object(root.sheets) ? asArray(root.sheets.sheet) : [];
      if (sheets.length !== 1) fail("XLSX에는 점검 대상 시트 하나만 넣어 주세요.");
      const sheet = sheets[0];
      if (!object(sheet) || !Number.isInteger(Number(sheet["@_sheetId"]))
        || Number(sheet["@_sheetId"]) < 1 || Number(sheet["@_sheetId"]) > 128) fail("XLSX 시트 번호 범위가 올바르지 않습니다.");
    }
    if (/^xl\/worksheets\/[^/]+\.xml$/i.test(name)) {
      const root = parsed.worksheet;
      if (!object(root)) fail("XLSX worksheet 형식이 올바르지 않습니다.");
      // ExcelJS materializes merges and column ranges. Reject/limit them before load.
      if (root.mergeCells !== undefined) fail("XLSX 점검 대상에 병합 셀은 사용할 수 없습니다.");
      const columns = object(root.cols) ? asArray(root.cols.col) : [];
      if (columns.length > 64) fail("XLSX 열 범위가 너무 큽니다.");
      for (const column of columns) {
        if (!object(column)) fail("XLSX 열 형식이 올바르지 않습니다.");
        const min = Number(column["@_min"]); const max = Number(column["@_max"]);
        if (!Number.isInteger(min) || !Number.isInteger(max) || min < 1 || max < min || max > 64) fail("XLSX 열 범위가 너무 큽니다.");
      }
      const sheetData = root.sheetData;
      const rows = object(sheetData) ? asArray(sheetData.row) : [];
      if (rows.length > 1000) fail("XLSX 행이 너무 많습니다. 최대 100개 대상을 사용해 주세요.");
      for (const row of rows) {
        if (!object(row) || !Number.isInteger(Number(row["@_r"])) || Number(row["@_r"]) < 1 || Number(row["@_r"]) > 1000) fail("XLSX 행 범위가 너무 큽니다.");
        const cells = asArray(row.c);
        if (cells.length > 64) fail("XLSX 열 범위가 너무 큽니다.");
        for (const cell of cells) {
          if (!object(cell)) fail("XLSX 셀 형식이 올바르지 않습니다.");
          if (cell.f !== undefined) fail("XLSX formula(수식) 셀은 사용할 수 없습니다.");
          const reference = cell["@_r"];
          if (typeof reference !== "string" || !/^(?:[A-Z]|A[A-Z]|B[A-L])[1-9]\d{0,2}$/.test(reference)) fail("XLSX 셀 범위가 너무 큽니다.");
          if (Number(reference.replace(/^[A-Z]+/, "")) !== Number(row["@_r"])) fail("XLSX 셀과 행 번호가 일치하지 않습니다.");
        }
      }
    }
    withinTime(start);
  }
  return files;
}

async function xlsxRows(bytes: Uint8Array, start: number): Promise<SourceRow[]> {
  safeWorkbookArchive(bytes, start);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as unknown as ExcelJS.Buffer);
  withinTime(start);
  if (workbook.worksheets.length !== 1) fail("XLSX에는 점검 대상 시트 하나만 넣어 주세요.");
  const sheet = workbook.worksheets[0]!;
  const records: { row: number; values: unknown[] }[] = [];
  sheet.eachRow((row, number) => {
    const values: unknown[] = [];
    row.eachCell({ includeEmpty: true }, (cell, column) => {
      // Rich text is inert text. Hyperlinks/formulas and other object cell values are rejected.
      const value = cell.value;
      values[column - 1] = object(value) && Array.isArray(value.richText)
        ? value.richText.map((run: unknown) => object(run) && typeof run.text === "string" ? run.text : "").join("") : value;
    });
    records.push({ row: number, values });
  });
  return tabular(records);
}

/** Preview local file bytes only; never resolves DNS, follows links or requests targets. */
export async function previewTargets(filename: string, bytes: Uint8Array): Promise<TargetPreview> {
  if (!(bytes instanceof Uint8Array)) fail("파일 바이트 형식을 확인해 주세요.");
  if (bytes.byteLength > MAX_INPUT) fail("파일 크기(size)는 2 MiB 이내여야 합니다.");
  if (!bytes.byteLength) fail("파일이 비어 있습니다.");
  const extension = filename.split(".").pop()?.toLowerCase();
  if (!["csv", "jsonl", "xml", "xlsx"].includes(extension ?? "")) fail("지원하는 파일 형식(format)은 XLSX, CSV, JSONL, XML입니다.");
  const format = extension as TargetPreview["format"];
  const start = performance.now();
  const sources = format === "xlsx" ? await xlsxRows(bytes, start)
    : format === "csv" ? csvRows(text(bytes)) : format === "jsonl" ? jsonRows(text(bytes)) : xmlRows(text(bytes));
  withinTime(start);
  return preview(format, sources);
}
