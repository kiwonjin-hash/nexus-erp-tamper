// ==UserScript==
// @name         검수 DB
// @namespace    yeouidogold
// @version      1.0.0
// @description  주문 검수 스크립트
// @match        *://*/order_print_popup.cm*
// @grant        GM_xmlhttpRequest
// @connect      script.google.com
// @connect      script.googleusercontent.com
// @updateURL    https://raw.github.com/kiwonjin-hash/nexus-erp-tamper/raw/refs/heads/main/order-db.user.js
// @downloadURL  https://raw.github.com/kiwonjin-hash/nexus-erp-tamper/raw/refs/heads/main/order-db.user.js
// ==/UserScript==

(function () {
  "use strict";

  const WEBAPP_URL = "https://script.google.com/macros/s/AKfycbwUml35_1v3aXkfVfhOyn_gAT47FX0zNkip9_uw2paL0ZuC6q_xglMsAOSpf7nAFWFQ/exec";

  const ORDER_NO_RE = /\b20\d{10,}\b/;
  const PHONE_RE = /01[0-9]-\d{3,4}-\d{4}/;
  const TRACKING_RE = /운송장번호\s*:\s*(\d{10,14})/;
  const TOTAL_RE = /결제금액\s*([0-9,]+원)/;

  function getOrderBlocks() {
    return [...document.querySelectorAll(".print-wrap")];
  }

  function extractOrderData(container) {

    const text = container.innerText;


    const order_no = (text.match(ORDER_NO_RE) || [""])[0];
    const phone = (text.match(PHONE_RE) || [""])[0];
    const tracking = (text.match(TRACKING_RE) || ["",""])[1] || "";
    const total_price = (text.match(TOTAL_RE) || ["",""])[1] || "";

    const dateMatch = text.match(/주문일자\s*([0-9:\-\s]+)/);
    const order_date = dateMatch ? dateMatch[1].trim() : "";

    /* ==========================
       🔥 배송 정보 정확 추출
    ========================== */

    const shippingBlock = container.querySelectorAll(".order-name")[0];
    const shippingPs = shippingBlock ? shippingBlock.querySelectorAll("p") : [];

    const address = shippingPs[0]?.innerText.trim() || "";
    const shippingPhone = shippingPs[1]?.innerText.trim() || "";
    const receiver = shippingPs[2]?.innerText.trim() || "";

    /* ==========================
       🔥 주문자 정보 정확 추출
    ========================== */

    const ordererBlock = container.querySelectorAll(".order-name")[1];
    const ordererPs = ordererBlock ? ordererBlock.querySelectorAll("p") : [];

    const name = ordererPs[0]?.innerText.trim() || "";
    const ordererPhone = ordererPs[2]?.innerText.trim() || phone;

    /* ==========================
       🔥 상품 정확 추출 (DOM 기반)
    ========================== */

  /* ==========================
   🔥 상품 정확히 추출 (구조 확정 버전)
========================== */

/* ==========================
   🔥 상품 + 배송비 분리 추출
========================== */

const table = container.querySelector("table.text-12");
if (!table) return [];

const rows = [...table.querySelectorAll("tbody tr")];

const resultRows = [];

let shippingFee = "";

rows.forEach(tr => {

  const tds = tr.querySelectorAll("td");

  // =====================
  // 1️⃣ 상품 행 (6칸 구조)
  // =====================
if (tds.length === 6) {

  const productName = tds[1]?.innerText.trim();
  const status = tds[2]?.innerText.trim();   // 🔥 여기 핵심
  const qty = tds[3]?.innerText.trim();
  const unitPrice = tds[4]?.innerText.trim();
  const subtotal = tds[5]?.innerText.trim();

  if (!productName || !qty) return;

  resultRows.push({
    order_no,
    order_date,
    tracking,
    name,
    phone: ordererPhone,
    address,
    receiver,
    items: productName,
    qty,
    unit_price: unitPrice,
    total_price: subtotal,
    type: "product",
    status: status.replace(/\s/g,"") // 공백 제거
  });
}

  // =====================
  // 2️⃣ 배송비 행 (2칸 구조)
  // =====================
  if (tds.length === 2) {

    const label = tds[0]?.innerText.trim();
    const value = tds[1]?.innerText.trim();

    if (label.includes("배송비")) {
      shippingFee = value;
    }
  }

});

// =====================
// 3️⃣ 배송비는 한 번만 추가
// =====================
if (shippingFee) {
  resultRows.push({
    order_no,
    order_date,
    tracking,
    name,
    phone: ordererPhone,
    address,
    receiver,
    items: "배송비",
    qty: "",
    unit_price: "",
    total_price: shippingFee,
    type: "shipping"

  });
}

return resultRows;


  }

    function postToGoogle(row) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "POST",
        url: WEBAPP_URL,
        data: JSON.stringify(row),
        headers: { "Content-Type": "application/json" },
        onload: (res) => {
          if (res.status >= 200 && res.status < 300) resolve();
          else reject(res.responseText);
        },
        onerror: reject
      });
    });
  }

  function mountButton() {

    if (document.getElementById("yg-upload-btn")) return;

    const btn = document.createElement("button");
    btn.id = "yg-upload-btn";
    btn.textContent = "업로드";

    btn.style.cssText = `
      position: fixed;
      top: 80px;
      right: 16px;
      z-index: 99999;
      padding: 10px 14px;
      border-radius: 10px;
      border: 1px solid #111;
      background: #111;
      color: #fff;
      font-size: 13px;
      cursor: pointer;
    `;

    btn.onclick = async () => {

      try {

        btn.disabled = true;
        btn.textContent = "전송중...";

        const blocks = getOrderBlocks();

        for (const block of blocks) {

         const rows = extractOrderData(block);

for (const row of rows) {
  await postToGoogle(row);
}
        }

        btn.textContent = "완료";

        setTimeout(() => {
          btn.disabled = false;
          btn.textContent = "업로드";
        }, 1500);

      } catch (e) {

        console.error(e);
        alert("업로드 실패");
        btn.disabled = false;
        btn.textContent = "업로드";

      }
    };

    document.body.appendChild(btn);
  }

  if (document.readyState === "complete" || document.readyState === "interactive") {
    mountButton();
  } else {
    window.addEventListener("DOMContentLoaded", mountButton);
  }

})();
