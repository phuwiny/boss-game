/*
 * Coin Quest — ข้อมูลตัวละคร (ไม่ยุ่งกับ DOM จึงใช้ร่วมกับตัวตรวจด่านใน Node ได้)
 *
 * stats เป็นตัวคูณจากค่าใน CQ.PHYS: run = ความเร็ววิ่งสูงสุด, accel = ความเร่ง, jump = ความเร็วตอนกระโดด
 * ability = ความสามารถพิเศษ (อ่านใน World.makePlayer)
 *   airJumps = กระโดดกลางอากาศได้กี่ครั้ง (ไม่รวมปีก), float = ลอยตัวได้กี่วินาทีต่อการอยู่กลางอากาศหนึ่งช่วง,
 *   guard = โดนศัตรู/หนามแล้วไม่ตายได้กี่ครั้งต่อชีวิต (ได้คืนเมื่อเกิดใหม่)
 * ทุกตัวใช้ hitbox ขนาดเดียวกัน (PHYS.PW x PHYS.PH) ต่างกันที่ฟิสิกส์ ความสามารถ และหน้าตาเท่านั้น
 * หลังแก้ stats ให้รัน `node tools/check-level.js` เพื่อยืนยันว่าทุกตัวเก็บเหรียญได้ครบทุกจุด
 */
(function (root) {
  'use strict';
  const CQ = root.CQ = root.CQ || {};

  CQ.CHARACTERS = [
    {
      id: 'bobo',
      name: 'Bobo',
      tagline: 'สมดุลทุกด้าน',
      desc: 'ตัวก้อนกลมทั่วไป',
      skill: 'ไม่มีความสามารถพิเศษ เล่นง่าย',
      stats: { run: 1, accel: 1, jump: 1 },
      ability: {},
      bars: { speed: 3, jump: 3 },
      color: '#ff5a3d'
    },
    {
      id: 'mew',
      name: 'Mew',
      tagline: 'กระโดด 2 ชั้น ลอยตัวได้',
      desc: 'สาวน้อยสุดร่าเริง มีพลังล้นเหลือ',
      skill: 'กระโดดกลางอากาศได้อีกครั้ง กดกระโดดค้างกลางอากาศเพื่อลอยตัวได้ 5 วินาที',
      stats: { run: 1, accel: 1, jump: 1 },
      ability: { airJumps: 1, float: 5 },
      bars: { speed: 3, jump: 5 },
      color: '#5b8cff'
    },
    {
      id: 'aclaire',
      name: 'Aclaire',
      tagline: 'วิ่งไวที่สุด ทนทาน',
      desc: 'สาวน้อยนักกีฬา ร่างกายแข็งแรง',
      skill: 'โดนศัตรูหรือหนามแล้วไม่ตาย 1 ครั้ง และอมตะ 5 วินาที (ได้คืนเมื่อเกิดใหม่)',
      stats: { run: 1.25, accel: 1.2, jump: 1 },
      ability: { guard: 1 },
      bars: { speed: 5, jump: 3 },
      color: '#ff8fc0'
    }
  ];

  /** หาตัวละครจาก id ถ้าไม่พบคืนตัวแรก (Bobo) */
  CQ.getCharacter = function (id) {
    for (let i = 0; i < CQ.CHARACTERS.length; i++) {
      if (CQ.CHARACTERS[i].id === id) return CQ.CHARACTERS[i];
    }
    return CQ.CHARACTERS[0];
  };
})(typeof window !== 'undefined' ? window : globalThis);
