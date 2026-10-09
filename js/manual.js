/*
 * Coin Quest — หน้าคู่มือ (manual.html): โหลด MANUAL.md แล้วแปลงเป็น HTML
 *
 * เนื้อหามีแหล่งเดียวคือ MANUAL.md (แก้ไฟล์นั้นไฟล์เดียว หน้าเว็บเปลี่ยนตาม)
 * ตัวแปลง Markdown รองรับเฉพาะรูปแบบที่คู่มือใช้: หัวข้อ, ย่อหน้า, รายการ (ซ้อนได้ 1 ชั้น),
 * ตาราง, blockquote, เส้นคั่น, **ตัวหนา**, `code`, [ลิงก์](url), URL เปล่า และ HTML ในบรรทัด (<kbd>, <details>)
 * anchor ของหัวข้อสร้างแบบเดียวกับ GitHub ลิงก์ในสารบัญจึงใช้ได้ทั้งบน GitHub และหน้านี้
 */
(function () {
  'use strict';

  const SRC = 'MANUAL.md';
  const REPO = 'https://github.com/phuwiny/boss-game';

  function esc(t) {
    return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /** slug แบบ GitHub: ตัวพิมพ์เล็ก ตัดเครื่องหมาย (เก็บตัวอักษร/สระ/วรรณยุกต์/ตัวเลข/ขีด) เว้นวรรคเป็นขีด */
  function slug(text) {
    return text.trim().toLowerCase().replace(/<[^>]+>/g, '').replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, '').replace(/ /g, '-');
  }

  /** ลิงก์ไปไฟล์ .md อื่นใน repo ชี้ไปหน้า GitHub (บน GitHub Pages ไฟล์ .md เปิดเป็นข้อความดิบ) */
  function fixHref(url) {
    if (/^README\.md$/i.test(url)) return REPO + '#readme';
    if (/^[\w./-]+\.md(#.*)?$/.test(url)) return REPO + '/blob/main/' + url;
    return url;
  }

  /** ข้อความในบรรทัด: เก็บ HTML (<kbd> ฯลฯ) และ `code` ไว้ก่อน แล้วค่อยแปลงตัวหนา/ลิงก์ */
  function inline(text) {
    const keep = [];
    const hold = function (html) { keep.push(html); return '\u0000' + (keep.length - 1) + '\u0000'; };
    let s = text.replace(/`([^`]+)`/g, function (m, c) { return hold('<code>' + esc(c) + '</code>'); });
    s = s.replace(/<\/?(kbd|b|br|summary|details)\b[^>]*>/g, function (m) { return hold(m); });
    s = esc(s);
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, label, url) {
      const href = fixHref(url);
      const ext = /^https?:/.test(href) ? ' target="_blank" rel="noopener"' : '';
      return hold('<a href="' + href.replace(/"/g, '&quot;') + '"' + ext + '>' + label + '</a>');
    });
    s = s.replace(/https?:\/\/[^\s<)]+/g, function (url) {
      return '<a href="' + url + '" target="_blank" rel="noopener">' + url + '</a>';
    });
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    return s.replace(/\u0000(\d+)\u0000/g, function (m, i) { return keep[+i]; });
  }

  function cells(line) {
    return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(function (c) { return c.trim(); });
  }

  function render(md) {
    const lines = md.replace(/\r/g, '').split('\n');
    const out = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) { i++; continue; }

      let m = /^(#{1,6})\s+(.*)$/.exec(line);
      if (m) {
        const n = m[1].length;
        out.push('<h' + n + ' id="' + slug(m[2]) + '">' + inline(m[2]) + '</h' + n + '>');
        i++;
        continue;
      }
      if (/^---+\s*$/.test(line)) { out.push('<hr>'); i++; continue; }
      if (/^<\/?(details|summary)/.test(line)) { out.push(inline(line)); i++; continue; }

      if (/^\|/.test(line) && lines[i + 1] && /^\|[\s|:-]+\|?\s*$/.test(lines[i + 1])) {
        const head = cells(line);
        i += 2;
        let h = '<div class="table-wrap"><table><thead><tr>' + head.map(function (c) { return '<th>' + inline(c) + '</th>'; }).join('') + '</tr></thead><tbody>';
        while (i < lines.length && /^\|/.test(lines[i])) {
          h += '<tr>' + cells(lines[i]).map(function (c) { return '<td>' + inline(c) + '</td>'; }).join('') + '</tr>';
          i++;
        }
        out.push(h + '</tbody></table></div>');
        continue;
      }

      if (/^>/.test(line)) {
        const buf = [];
        while (i < lines.length && /^>/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, '')); i++; }
        out.push('<blockquote><p>' + inline(buf.join(' ')) + '</p></blockquote>');
        continue;
      }

      m = /^(\d+\.|-)\s/.exec(line);
      if (m) {
        const ordered = m[1] !== '-';
        const tag = ordered ? 'ol' : 'ul';
        let h = '<' + tag + '>';
        let open = false;
        while (i < lines.length) {
          const l = lines[i];
          const top = ordered ? /^\d+\.\s+(.*)$/.exec(l) : /^-\s+(.*)$/.exec(l);
          let sub = /^\s{2,}-\s+(.*)$/.exec(l);
          if (top) {
            if (open) h += '</li>';
            h += '<li>' + inline(top[1]);
            open = true;
          } else if (sub && open) {
            h += '<ul>';
            while (i < lines.length && (sub = /^\s{2,}-\s+(.*)$/.exec(lines[i]))) { h += '<li>' + inline(sub[1]) + '</li>'; i++; }
            h += '</ul>';
            continue;
          } else break;
          i++;
        }
        out.push(h + (open ? '</li>' : '') + '</' + tag + '>');
        continue;
      }

      const buf = [];
      while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|\||>|-\s|\d+\.\s|---|<\/?(details|summary))/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      out.push('<p>' + inline(buf.join(' ')) + '</p>');
    }
    return out.join('\n');
  }

  const body = document.getElementById('manual');
  fetch(SRC, { cache: 'no-cache' })
    .then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.text();
    })
    .then(function (md) {
      try {
        body.innerHTML = render(md);
      } catch (e) {
        body.innerHTML = '<p class="error">แสดงคู่มือไม่ได้ อ่านคู่มือบน <a href="' + REPO + '/blob/main/MANUAL.md">GitHub</a></p>';
        e.rendered = true; // ให้ .catch รู้ว่าไม่ใช่ปัญหาการโหลด
        throw e;
      }
      const h1 = body.querySelector('h1');
      if (h1) document.title = h1.textContent;
      // เปิดหน้ามาพร้อม #หัวข้อ: เลื่อนไปหลังเนื้อหาโหลดเสร็จ
      if (location.hash) {
        const el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
        if (el) el.scrollIntoView();
      }
    })
    .catch(function (e) {
      if (e && e.rendered) { console.error(e); return; }
      // โหลดไม่ได้ เช่น เปิดไฟล์จากเครื่องโดยตรง (file://) เบราว์เซอร์ไม่ให้อ่านไฟล์อื่น
      body.innerHTML = '<p class="error">โหลดคู่มือไม่ได้ ถ้าเปิดไฟล์จากเครื่องโดยตรง ให้รันผ่าน web server (เช่น <code>python -m http.server 8000</code>) ' +
        'หรืออ่านคู่มือบน <a href="' + REPO + '/blob/main/MANUAL.md">GitHub</a></p>';
    });

  // ปุ่มกลับขึ้นบนสุด
  const top = document.getElementById('to-top');
  window.addEventListener('scroll', function () { top.classList.toggle('show', window.scrollY > 600); }, { passive: true });
  top.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
})();
