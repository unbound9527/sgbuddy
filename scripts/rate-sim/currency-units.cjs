"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var currency_units_exports = {};
__export(currency_units_exports, {
  HISTORY_TOL: () => HISTORY_TOL,
  HISTORY_VETO: () => HISTORY_VETO,
  LOW_SPREAD: () => LOW_SPREAD,
  RATE_MAX: () => RATE_MAX,
  RATE_MIN: () => RATE_MIN,
  analyzeRates: () => analyzeRates,
  median: () => median,
  targetRate: () => targetRate,
  unitFactorToYi: () => unitFactorToYi
});
module.exports = __toCommonJS(currency_units_exports);
const RATE_MIN = 200;
const RATE_MAX = 900;
function unitFactorToYi(title) {
  const wan = title.match(/(\d+(?:\.\d+)?)\s*[万Ww]/);
  if (wan) {
    const n = parseFloat(wan[1]);
    if (n > 0 && n <= 1e4) return 1e4 / n;
  }
  const yi = title.match(/(\d+(?:\.\d+)?)\s*[Ee亿]/);
  if (yi) {
    const n = parseFloat(yi[1]);
    if (n > 0) return 1 / n;
  }
  if (/千万/.test(title)) return 10;
  if (/百万/.test(title)) return 100;
  if (/十亿/.test(title)) return 0.1;
  if (/亿/.test(title)) return 1;
  return null;
}
const LOW_SPREAD = 1.15;
const HISTORY_TOL = 0.3;
const HISTORY_VETO = 0.4;
const COIN_RE = /游戏币|三国币|金币/;
const NON_COIN_RE = /元宝|点券|装备|代练|账号|出租|代充/;
function analyzeRates(items, serverName, lastRate = null) {
  const accepted = [];
  let noServer = 0;
  let noUnit = 0;
  let outOfRange = 0;
  let nonCoin = 0;
  let yiPrimary = 0;
  for (const it of items) {
    if (!(it.price > 0)) {
      noUnit++;
      continue;
    }
    if (NON_COIN_RE.test(it.title) || !COIN_RE.test(it.title)) {
      nonCoin++;
      continue;
    }
    if (!it.title.includes(serverName)) {
      noServer++;
      continue;
    }
    const f = unitFactorToYi(it.title);
    if (f === null) {
      noUnit++;
      continue;
    }
    const rate2 = Math.round(it.price * f * 100) / 100;
    if (rate2 < RATE_MIN || rate2 > RATE_MAX) {
      outOfRange++;
      continue;
    }
    accepted.push({ price: it.price, factor: f, rate: rate2, title: it.title });
    if (f === 1) yiPrimary++;
  }
  const ratesByFactor = /* @__PURE__ */ new Map();
  for (const a of accepted) {
    if (!ratesByFactor.has(a.factor)) ratesByFactor.set(a.factor, []);
    ratesByFactor.get(a.factor).push(a.rate);
  }
  const bins = [...ratesByFactor.entries()].map(([factor, rates]) => {
    const s = [...rates].sort((a, b) => a - b);
    const anchor = s[0];
    const low = s.filter((v) => v <= anchor * LOW_SPREAD);
    return { factor, total: rates.length, anchor, lowCount: low.length, lowMedian: median(low) };
  });
  const clusters = [];
  const sorted = [...accepted].sort((a, b) => a.rate - b.rate);
  let i = 0;
  while (i < sorted.length) {
    const anchor = sorted[i].rate;
    let j = i;
    while (j < sorted.length && sorted[j].rate <= anchor * LOW_SPREAD) j++;
    const members = sorted.slice(i, j);
    const factors = [...new Set(members.map((m) => m.factor))];
    clusters.push({
      anchor,
      lowMedian: median(members.map((m) => m.rate)),
      members: members.length,
      factors,
      verdict: "\u65E0\u4F50\u8BC1\u8DF3\u8FC7"
    });
    i = j;
  }
  let chosenIdx = -1;
  let chosenStrong = false;
  let fallbackIdx = -1;
  for (let k = 0; k < clusters.length; k++) {
    const c = clusters[k];
    const dev = lastRate !== null ? Math.abs(c.lowMedian / lastRate - 1) : null;
    const histOk = dev !== null && dev <= HISTORY_TOL;
    const crossStrong = c.factors.length >= 2;
    if (crossStrong) {
      c.verdict = "\u91C7\u7EB3";
      chosenIdx = k;
      chosenStrong = true;
      break;
    }
    if (dev !== null && dev > HISTORY_VETO) {
      c.verdict = "\u5386\u53F2\u65F6\u5E8F\u5426\u51B3";
      continue;
    }
    if (histOk) {
      c.verdict = "\u91C7\u7EB3";
      chosenIdx = k;
      chosenStrong = true;
      break;
    }
    if (c.members >= 2 && fallbackIdx === -1) {
      fallbackIdx = k;
      c.verdict = "\u5F31\u7C07\u5907\u9009\u91C7\u7EB3";
    }
  }
  if (chosenIdx === -1 && fallbackIdx !== -1) chosenIdx = fallbackIdx;
  const chosen = chosenIdx >= 0 ? clusters[chosenIdx] : null;
  if (chosen && !chosenStrong && chosen.verdict === "\u5F31\u7C07\u5907\u9009\u91C7\u7EB3") {
  }
  const rate = chosen ? chosen.lowMedian : null;
  const evidence = {
    lowCluster: chosen ? chosen.members >= 2 : false,
    crossBin: chosen ? chosen.factors.length >= 2 : false,
    history: false
  };
  if (chosen) {
    const dev = lastRate !== null ? Math.abs(chosen.lowMedian / lastRate - 1) : null;
    evidence.history = dev !== null && dev <= HISTORY_TOL;
  }
  return {
    rate,
    useYi: chosen ? chosen.factors.includes(1) : false,
    primaryFactor: chosen ? chosen.factors.includes(1) ? 1 : chosen.factors[0] : null,
    accepted,
    bins,
    clusters,
    evidence,
    stats: {
      total: items.length,
      noServer,
      noUnit,
      outOfRange,
      nonCoin,
      accepted: accepted.length,
      yiPrimary
    }
  };
}
function targetRate(items, serverName, lastRate = null) {
  return analyzeRates(items, serverName, lastRate).rate;
}
function median(values) {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2 * 100) / 100;
}
