import ExcelJS from "exceljs";
import { strToU8, unzipSync, zipSync } from "fflate";
import { describe, expect, it, vi } from "vitest";
import { previewTargets } from "../src/target-import.js";

const utf8 = (text: string) => new TextEncoder().encode(text);
async function workbook(rows: unknown[][]): Promise<Uint8Array> {
  const book = new ExcelJS.Workbook();
  book.addWorksheet("점검 대상").addRows(rows);
  return new Uint8Array(await book.xlsx.writeBuffer());
}
async function mutateWorkbook(change: (files: Record<string, Uint8Array>) => void) {
  const files = unzipSync(await workbook([["사이트명", "시작 주소"], ["기관", "https://example.org/"]]));
  change(files);
  return zipSync(files);
}

describe("safe, network-free target import preview", () => {
  it("reads BOM CSV, quoted commas/newlines and normalized duplicate queries", async () => {
    const result = await previewTargets("기관.CSV", utf8('\uFEFF사이트명,시작 주소\r\n"기관, 본부\n자료","https://example.org/a?b=2&a=1#one"\r\n다른 이름,https://EXAMPLE.org/a?a=1&b=2#two\r\n'));
    expect(result).toEqual({ format: "csv", valid: 1, invalid: 0, duplicate: 1, rows: [
      { row: 2, status: "valid", target: { label: "기관, 본부\n자료", entryUrl: "https://example.org/a?a=1&b=2", kind: "site" } },
      { row: 4, status: "duplicate", target: { label: "다른 이름", entryUrl: "https://example.org/a?a=1&b=2", kind: "site" }, reason: expect.any(String) },
    ] });
  });

  it("keeps repeated query value order while sorting keys and retains different values", async () => {
    const result = await previewTargets("sites.jsonl", utf8([
      '{"siteName":"A","entryUrl":"https://example.org/?z=3&a=1&a=2"}',
      '{"name":"B","url":"https://example.org/?a=2&a=1&z=3"}',
      '{"url":"https://example.org/?a=1&a=2&z=4"}',
    ].join("\n")));
    expect(result.valid).toBe(3);
    expect(result.rows.map((row) => row.target?.entryUrl)).toEqual([
      "https://example.org/?a=1&a=2&z=3", "https://example.org/?a=2&a=1&z=3", "https://example.org/?a=1&a=2&z=4",
    ]);
    expect(result.rows[2]?.target?.label).toBe("example.org");
  });

  it("produces independent invalid rows for broken JSON, wrong fields and unsafe targets", async () => {
    const result = await previewTargets("sites.jsonl", utf8('bad\n{"url":9}\n{"url":"https://example.org/","entryUrl":"https://other.org/"}\n{"url":"https://user:secret@example.org/"}\n{"url":"https://example.org/","kind":"sitemap"}'));
    expect(result.rows.map((row) => row.status)).toEqual(["invalid", "invalid", "invalid", "invalid", "valid"]);
    expect(result.rows[4]?.target?.kind).toBe("sitemap");
  });

  it("rejects duplicate JSON field names, including escaped duplicate names", async () => {
    const result = await previewTargets("sites.jsonl", utf8([
      '{"url":"http://127.0.0.1/","url":"https://example.org/"}',
      '{"url":"https://example.org/","u\\u0072l":"https://other.org/"}',
    ].join("\n")));
    expect(result.rows.map((row) => row.status)).toEqual(["invalid", "invalid"]);
  });

  it("accepts exactly 100 targets and counts invalid/duplicate rows toward the cap", async () => {
    const source = Array.from({ length: 100 }, (_, number) => JSON.stringify({ url: `https://example.org/${number}` })).join("\n");
    expect((await previewTargets("sites.jsonl", utf8(source))).valid).toBe(100);
    await expect(previewTargets("sites.jsonl", utf8(source + '\n{"url":"http://127.0.0.1/"}'))).rejects.toThrow(/100/);
    await expect(previewTargets("sites.xml", utf8("<urlset>" + Array.from({ length: 101 }, () => "<url><loc>https://example.org/</loc></url>").join("") + "</urlset>"))).rejects.toThrow(/100/);
  });

  it.each([
    "http://127.0.0.1/", "http://127.1/", "http://2130706433/", "http://0x7f000001/", "http://10.0.0.1/",
    "http://169.254.169.254/", "http://192.168.0.1/", "http://0.0.0.0/", "http://100.64.0.1/",
    "http://224.0.0.1/", "http://198.51.100.1/", "http://[::1]/", "http://[::ffff:127.0.0.1]/", "http://[fe80::1]/",
    "http://localhost/", "http://a.localhost/", "http://a.local/", "http://metadata.google.internal/",
    "file:///etc/passwd", "javascript:alert(1)", "https://bad_label.org/", "http://singlelabel/",
  ])("marks unsafe textual URL %s invalid without visiting it", async (url) => {
    const result = await previewTargets("sites.jsonl", utf8(JSON.stringify({ url })));
    expect(result.invalid).toBe(1);
    expect(result.rows[0]?.target).toBeUndefined();
  });

  it("reads real ExcelJS XLSX bytes and rejects formula targets", async () => {
    const result = await previewTargets("sites.xlsx", await workbook([["label", "url"], ["기관", "https://example.org/"]]));
    expect(result.rows).toEqual([{ row: 2, status: "valid", target: { label: "기관", entryUrl: "https://example.org/", kind: "site" } }]);
    await expect(previewTargets("sites.xlsx", await workbook([["label", "url"], ["기관", { formula: '"https://example.org/"', result: "https://example.org/" }]]))).rejects.toThrow(/formula|수식/i);
  });

  it("keeps active-content keywords as ordinary target text", async () => {
    const result = await previewTargets("sites.xlsx", await workbook([["label", "url"], ["externalLink connections", "https://example.org/vbaProject"]]));
    expect(result.rows[0]?.target).toEqual({ label: "externalLink connections", entryUrl: "https://example.org/vbaProject", kind: "site" });
  });

  it("rejects ambiguous headers and malformed CSV instead of guessing", async () => {
    await expect(previewTargets("sites.csv", utf8("label,url,entryUrl\nA,https://example.org/,https://other.org/"))).rejects.toThrow(/column|열/i);
    await expect(previewTargets("sites.csv", utf8("site,location\nA,https://example.org/"))).rejects.toThrow(/column|열/i);
    await expect(previewTargets("sites.csv", utf8('url\n"https://example.org/'))).rejects.toThrow(/CSV/);
    await expect(previewTargets("sites.csv", utf8('url\n"https://example.org/"oops'))).rejects.toThrow(/CSV/);
  });

  it("reads urlset and sitemapindex with no recursive fetch, including cyclic values", async () => {
    const fetch = vi.fn(() => { throw new Error("Unexpected network"); });
    vi.stubGlobal("fetch", fetch);
    try {
      const sites = await previewTargets("sites.xml", utf8('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://example.org/a?a=1&amp;b=2</loc></url><url><loc>http://127.0.0.1/</loc></url></urlset>'));
      expect(sites.valid).toBe(1); expect(sites.invalid).toBe(1);
      expect(sites.rows[0]?.target?.entryUrl).toBe("https://example.org/a?a=1&b=2");
      const indexes = await previewTargets("index.xml", utf8('<sitemapindex><sitemap><loc>https://example.org/index.xml</loc></sitemap><sitemap><loc>https://example.org/index.xml#cycle</loc></sitemap></sitemapindex>'));
      expect(indexes.rows.map((row) => [row.status, row.target?.kind])).toEqual([["valid", "sitemap"], ["duplicate", "sitemap"]]);
      expect(fetch).not.toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); }
  });

  it.each([
    '<urlset><url><loc>https://example.org/</loc></url>',
    '<!DOCTYPE urlset [<!ENTITY site "https://example.org/">]><urlset><url><loc>&site;</loc></url></urlset>',
    '<urlset><url><loc>&unknown;</loc></url></urlset>',
    '<anything><url><loc>https://example.org/</loc></url></anything>',
    '<urlset><url><loc>https://example.org/</loc><loc>https://other.org/</loc></url></urlset>',
    '<urlset xmlns="https://evil.org/schema"><url><loc>https://example.org/</loc></url></urlset>',
  ])("rejects malformed or unsafe XML", async (xml) => {
    await expect(previewTargets("sites.xml", utf8(xml))).rejects.toThrow(/XML|sitemap|entity|DTD/i);
  });

  it.each([
    ["macro", (files: Record<string, Uint8Array>) => { files["xl/vbaProject.bin"] = utf8("macro"); }],
    ["embedding", (files: Record<string, Uint8Array>) => { files["xl/embeddings/oleObject1.bin"] = utf8("OLE"); }],
    ["connection", (files: Record<string, Uint8Array>) => { files["xl/connections.xml"] = utf8("<connections/>"); }],
    ["external relationship", (files: Record<string, Uint8Array>) => { files["xl/_rels/workbook.xml.rels"] = utf8('<Relationships><Relationship TargetMode="External" Target="http://127.0.0.1/"/></Relationships>'); }],
  ] as const)("rejects XLSX %s before workbook loading", async (_name, mutation) => {
    await expect(previewTargets("sites.xlsx", await mutateWorkbook(mutation))).rejects.toThrow(/XLSX|relationship|active|connection/i);
  });

  it.each([
    ["huge merge", (files: Record<string, Uint8Array>) => { files["xl/worksheets/sheet1.xml"] = utf8('<worksheet><sheetData/><mergeCells><mergeCell ref="A1:XFD1048576"/></mergeCells></worksheet>'); }],
    ["huge column", (files: Record<string, Uint8Array>) => { files["xl/worksheets/sheet1.xml"] = utf8('<worksheet><cols><col min="1" max="4294967294"/></cols><sheetData/></worksheet>'); }],
    ["huge row", (files: Record<string, Uint8Array>) => { files["xl/worksheets/sheet1.xml"] = utf8('<worksheet><sheetData><row r="4294967294"><c r="A1"/></row></sheetData></worksheet>'); }],
    ["huge sheet id", (files: Record<string, Uint8Array>) => { files["xl/workbook.xml"] = utf8('<workbook><sheets><sheet name="targets" sheetId="4294967294"/></sheets></workbook>'); }],
    ["macro content type", (files: Record<string, Uint8Array>) => { files["[Content_Types].xml"] = utf8('<Types><Override ContentType="application/vnd.ms-excel.sheet.macroEnabled.main+xml" PartName="/xl/workbook.xml"/></Types>'); }],
    ["external URL relationship", (files: Record<string, Uint8Array>) => { files["xl/_rels/workbook.xml.rels"] = utf8('<Relationships><Relationship Target="https://example.org/"/></Relationships>'); }],
  ] as const)("rejects dangerous XLSX materialization: %s", async (_name, mutation) => {
    await expect(previewTargets("sites.xlsx", await mutateWorkbook(mutation))).rejects.toThrow(/XLSX/);
  });

  it("rejects multiple target sheets rather than selecting one", async () => {
    const book = new ExcelJS.Workbook();
    book.addWorksheet("one").addRows([["url"], ["https://example.org/"]]);
    book.addWorksheet("two").addRows([["url"], ["https://other.org/"]]);
    await expect(previewTargets("sites.xlsx", new Uint8Array(await book.xlsx.writeBuffer()))).rejects.toThrow(/시트/);
  });

  it("stops parsing when the elapsed-time budget is exhausted", async () => {
    const bytes = await workbook([["url"], ["https://example.org/"]]);
    let now = 0;
    const timer = vi.spyOn(performance, "now").mockImplementation(() => { now += 500; return now; });
    try { await expect(previewTargets("sites.xlsx", bytes)).rejects.toThrow(/시간/); }
    finally { timer.mockRestore(); }
  });

  it("rejects deep XML before sitemap parsing", async () => {
    const xml = "<urlset>" + "<x>".repeat(33) + "</x>".repeat(33) + "</urlset>";
    await expect(previewTargets("sites.xml", utf8(xml))).rejects.toThrow(/XML/);
  });

  it("limits input bytes, data rows and individual fields", async () => {
    await expect(previewTargets("sites.csv", new Uint8Array(2 * 1024 * 1024 + 1))).rejects.toThrow(/size|크기/i);
    await expect(previewTargets("sites.csv", utf8("url\n" + Array.from({ length: 101 }, (_, n) => `https://example.org/${n}`).join("\n")))).rejects.toThrow(/100/);
    const result = await previewTargets("sites.jsonl", utf8([
      JSON.stringify({ url: "https://example.org/", label: "x".repeat(201) }),
      JSON.stringify({ url: "https://example.org/" + "x".repeat(2048) }),
    ].join("\n")));
    expect(result.invalid).toBe(2);
    await expect(previewTargets("sites.csv", new Uint8Array([0xff]))).rejects.toThrow(/UTF/);
    await expect(previewTargets("sites.exe", utf8("url"))).rejects.toThrow(/format|형식/i);
  });

  it("bounds expanded ZIP contents, actual lying entry sizes and entry count", async () => {
    const oversized = zipSync({ "xl/worksheets/sheet1.xml": new Uint8Array(4 * 1024 * 1024 + 1) });
    const lying = oversized.slice();
    const view = new DataView(lying.buffer);
    for (let i = 0; i <= lying.length - 46; i++) {
      const signature = view.getUint32(i, true);
      if (signature === 0x04034b50) view.setUint32(i + 22, 1, true);
      if (signature === 0x02014b50) view.setUint32(i + 24, 1, true);
    }
    await expect(previewTargets("sites.xlsx", lying)).rejects.toThrow(/expanded|expansion|압축/i);
    const aggregate = zipSync(Object.fromEntries([1, 2, 3].map((n) => [`xl/s${n}.xml`, new Uint8Array(3 * 1024 * 1024)])));
    await expect(previewTargets("sites.xlsx", aggregate)).rejects.toThrow(/expanded|expansion|압축/i);
    const tooMany = zipSync(Object.fromEntries(Array.from({ length: 129 }, (_, i) => [`xl/${i}.xml`, strToU8("<a/>")])));
    await expect(previewTargets("sites.xlsx", tooMany)).rejects.toThrow(/128|entries/i);
  });
});
