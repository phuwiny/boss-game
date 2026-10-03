/*
 * Coin Quest — ข้อมูลตัวละคร (ไม่ยุ่งกับ DOM จึงใช้ร่วมกับตัวตรวจด่านใน Node ได้)
 *
 * stats เป็นตัวคูณจากค่าใน CQ.PHYS: run = ความเร็ววิ่งสูงสุด, accel = ความเร่ง, jump = ความเร็วตอนกระโดด
 * ทุกตัวใช้ hitbox ขนาดเดียวกัน (PHYS.PW x PHYS.PH) ต่างกันที่ฟิสิกส์และหน้าตาเท่านั้น
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
      desc: 'ก้อนกลมสีส้ม คาดผ้าสีฟ้า',
      stats: { run: 1, accel: 1, jump: 1 },
      bars: { speed: 3, jump: 3 },
      color: '#ff5a3d'
    },
    {
      id: 'mew',
      name: 'Mew',
      tagline: 'วิ่งไวที่สุด',
      desc: 'ผมยาวสีเหลือง ตาสีเขียว หมวกเบเร่สีดำ',
      stats: { run: 1.25, accel: 1.2, jump: 1 },
      bars: { speed: 5, jump: 3 },
      color: '#5b8cff'
    },
    {
      id: 'aclaire',
      name: 'Aclaire',
      tagline: 'กระโดดสูงที่สุด',
      desc: 'ผมสั้นสีส้มหางม้า ตาสีฟ้า เสื้อสีชมพู',
      stats: { run: 1, accel: 1, jump: 1.14 },
      bars: { speed: 3, jump: 5 },
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
