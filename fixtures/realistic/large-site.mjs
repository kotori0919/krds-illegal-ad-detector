/** Generated municipal scale scenario with 200 real document requests. */
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export async function createLargeMunicipalSite(directory) {
  const post = await readFile(join(directory, "post.html"), "utf8");
  const frame = await readFile(join(directory, "frame.html"), "utf8");
  const pages = new Map();
  const subjects = ["산책로 보수", "시민 안전 교육", "도서관 운영", "공원 이용", "교통 통제", "복지 상담", "문화 행사", "민원 접수", "재활용 수거", "보건소 안내"];
  const document = (title, content) => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${title} | 가람시청</title></head>
    <body><a href="#main" style="position:absolute;left:-9999px">본문으로 이동</a>
    <header><a href="/">가람시청</a><p>시민 참여 게시판</p></header>
    <main id="main"><h1>${title}</h1>${content}</main><footer>가람시청 시민소통과 · 2026년 10월 안내</footer></body></html>`;
  pages.set("/", document("시민 참여", `<nav aria-label="게시판 페이지">${Array.from({ length: 10 }, (_, index) => `<a href="/board.html?page=${index + 1}">${index + 1}페이지</a>`).join(" ")}</nav>
    <section><h2>신고 안내</h2><p>불법 도박 광고는 신고해 주세요.</p><a href="/missing.html">지난 공고</a></section>`));
  let id = 1;
  for (let board = 1; board <= 10; board += 1) {
    const count = board === 10 ? 17 : 19;
    const rows = [];
    for (let row = 0; row < count; row += 1, id += 1) {
      const title = `${subjects[(id - 1) % subjects.length]} 안내 ${id}`;
      const path = `/post.html?id=${id}`;
      rows.push(`<tr><td>${id}</td><td><a href="${path}">${title}</a></td><td>시민소통과</td><td>2026-10-${String(1 + id % 28).padStart(2, "0")}</td></tr>`);
      if (id <= 5) {
        pages.set(path, post.replaceAll("하천 산책로 이용 안내", title));
      } else {
        pages.set(path, document(title, `<article><dl><dt>게시 번호</dt><dd>${id}</dd><dt>담당 부서</dt><dd>시민소통과</dd></dl>
          <p>시민 여러분께 ${subjects[(id - 1) % subjects.length]} 일정을 안내합니다. 접수 기간은 10월 ${1 + id % 20}일부터입니다.</p>
          <h2>이용 절차</h2><ol><li>운영 시간을 확인합니다.</li><li>신청서를 작성합니다.</li><li>담당 부서에 제출합니다.</li></ol>
          <table><caption>운영 시간</caption><thead><tr><th>구분</th><th>시간</th></tr></thead><tbody><tr><td>평일</td><td>09:00~18:00</td></tr><tr><td>점심</td><td>12:00~13:00</td></tr></tbody></table></article>
          <section><h2>피해 예방 교육</h2><p>카지노 광고 신고와 대출 사기 예방 자료입니다. 광고를 발견하면 신고해 주세요.</p>
          <div role="tablist" aria-label="교육 자료"><button role="tab" aria-selected="true">예방 안내</button><button role="tab" aria-selected="false">한글 교육</button></div>
          <div role="tabpanel"><p>피해 신고에 필요한 자료를 안내합니다.</p></div><div role="tabpanel" hidden>ㅋㅏㅈㅣㄴㅗ 표기와 한글 자모 교육</div>
          <div aria-roledescription="carousel" aria-label="예방 소식"><p>성인물 차단과 불법 도박 피해 예방 안내</p><p aria-hidden="true" style="position:absolute;left:-9999px">대출 사기 피해 신고 절차</p></div>
          <svg role="img" aria-labelledby="chart-title"><title id="chart-title">불법 광고 신고 통계</title><rect width="80" height="40"/><text y="60">신고 ${id}건</text></svg>
          <dialog><h2>접수 확인</h2><p>신고 자료를 확인해 주세요.</p><button>닫기</button></dialog></section>
          <section aria-label="댓글"><p>운영 안내가 도움이 되었습니다. 시민 의견 ${id}번입니다.</p><form><label for="comment">의견</label><textarea id="comment"></textarea><button>등록</button></form></section>`));
      }
    }
    pages.set(`/board.html?page=${board}`, document(`시민 참여 ${board}페이지`, `<form role="search"><label for="query">게시글 검색</label><input id="query"><button>검색</button></form>
      <table><caption>게시글 목록</caption><thead><tr><th>번호</th><th>제목</th><th>담당</th><th>작성일</th></tr></thead><tbody>${rows.join("")}</tbody></table>`));
  }
  pages.set("/frame.html", frame);
  const positive = Array.from({ length: 5 }, (_, index) => [
    { page: `/post.html?id=${index + 1}`, selector: "#comment-ad", technique: "HOMOGLYPH" },
    { page: `/post.html?id=${index + 1}`, selector: "#hidden-ad", technique: "TRANSPARENT" },
    { page: `/post.html?id=${index + 1}`, selector: "#late-comment", technique: "JAMO" },
    { page: `/post.html?id=${index + 1}`, selector: "#late-comment", technique: "OFFSCREEN" },
  ]).flat();
  positive.push({ page: "/frame.html", selector: "#frame-ad", technique: "JAMO" });
  return { pages, truth: { positive, expectedCheckedPages: 200, expectedFailedPages: 1 } };
}
