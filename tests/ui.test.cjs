"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

function createUiHarness(){
  let markup="",handlers={},saved=new Map();
  const root={set innerHTML(value){markup=value;},get innerHTML(){return markup;}};
  const fields={focus:"stamina",intensity:"normal",strategy:"steady",water:"1"};
  const document={
    getElementById(id){if(id==="app")return root;return {value:fields[id]??(id.startsWith("leg-")?String(Number(id.slice(-1))+1):""),files:[],click(){}};},
    addEventListener(type,fn){handlers[type]=fn;}
  };
  const localStorage={getItem:k=>saved.get(k)||null,setItem:(k,value)=>saved.set(k,value)};
  const context={document,localStorage,console,Date,setTimeout:fn=>fn(),confirm:()=>true};
  const global=vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname,"../src/engine.js"),"utf8"),global,{filename:"engine.js"});
  vm.runInContext(fs.readFileSync(path.join(__dirname,"../src/prediction.js"),"utf8"),global,{filename:"prediction.js"});
  vm.runInContext(fs.readFileSync(path.join(__dirname,"../src/app.js"),"utf8"),global,{filename:"app.js"});
  return {
    get markup(){return markup;},
    get state(){return JSON.parse(saved.get("ekiden-manager-v1"));},
    get language(){return saved.get("ekiden-manager-language")||"ja";},
    click(action,key){assert.ok(handlers.click,"click handler registered");handlers.click({target:{closest:()=>({disabled:false,dataset:{action,key,id:key,lang:key}})}});},
    setField(id,value){fields[id]=value;},
    engine:global.EkidenEngine
  };
}

test("training, scouting, checkpoint map, year-end accounting, and autosave run end-to-end",()=>{
  const app=createUiHarness();
  assert.match(app.markup,/EKIDEN/);
  assert.match(app.markup,/年度決算/);
  assert.match(app.markup,/監督手帳/);
  assert.match(app.markup,/ライバル大学の偵察/);
  assert.match(app.markup,/全国高校スカウト/);
  assert.match(app.markup,/40校/);
  app.setField("scout-school","3");
  app.click("scout");
  assert.equal(app.state.scouting,1);
  assert.deepEqual(app.state.scoutedSchools,[3]);
  assert.ok(app.state.prospects.filter(p=>p.schoolId===3).length>=2);
  assert.match(app.markup,/入部打診/);
  const select=app.state.prospects.find(p=>p.schoolId===3);
  app.click("target",select.id);
  assert.deepEqual(app.state.recruitTargets,[select.id]);
  assert.equal(app.state.cash,2220000);
  for(let w=0;w<12;w++)app.click("train");
  assert.equal(app.state.week,12);
  assert.match(app.markup,/レース順位予想・オッズ/);
  assert.match(app.markup,/512回のレース試算/);
  assert.match(app.markup,/value="30000"/);
  assert.match(app.markup,/value="390000"/);
  assert.match(app.markup,/晴384・雨128/);
  assert.ok(app.markup.indexOf('id="market-team"')<app.markup.indexOf('class="odds-board"'),"bet controls must appear before comparison table");
  app.click("prediction");
  assert.equal(app.state.prediction.status,"placed");
  assert.equal(app.state.prediction.stake,50000);
  assert.match(app.markup,/id="leg-0" disabled/,"purchased rank ticket freezes the lineup editor");
  app.click("start");
  assert.match(app.markup,/給水ステーション/);
  assert.match(app.markup,/水分コンディション/);
  assert.match(app.markup,/大学生活・突発イベント/);
  assert.match(app.markup,/スタート前/);
  assert.match(app.markup,/class="course"/);
  for(let checkpoint=0;checkpoint<15;checkpoint++){
    app.setField("strategy",checkpoint%3===2?"push":"steady");
    app.click("next");
    assert.equal(app.state.race.notes.length,checkpoint+1);
  }
  assert.equal(app.state.race.finished,true);
  assert.equal(app.state.race.waterSpent,15*app.engine.WATER_COST);
  assert.equal(app.state.race.waterCups,15);
  assert.equal(app.state.ledger.filter(x=>x.kind==="大会給水費").length,15);
  assert.match(app.markup,/EKIDEN LIVE/);
  assert.ok(["won","lost"].includes(app.state.prediction.status));
  assert.match(app.markup,/年度決算を確定して次年度へ/);
  const ending=app.state.cash;
  app.click("close");
  assert.equal(app.state.year,2);
  assert.match(app.markup,/歴代成績・年度決算/);
  assert.match(app.markup,/決算明細/);
  assert.match(app.markup,/卒業生の記録/);
  assert.match(app.markup,/最終順位/);
  assert.equal(app.state.history[0].finance.ending,ending);
  assert.equal(app.engine.financials(app.state).ending,app.state.cash);
});
test("a new install is offline and uses only local JavaScript/CSS assets",()=>{
  const html=fs.readFileSync(path.join(__dirname,"../index.html"),"utf8");
  assert.match(html,/Content-Security-Policy/);
  assert.match(html,/connect-src 'none'/);
  assert.doesNotMatch(html,/https?:\/\//);
  assert.match(html,/src\/engine\.js/);
  assert.match(html,/src\/app\.js/);
});
test("renderer code is independent of Node integration, and navigation is blocked in desktop host",()=>{
  const script=fs.readFileSync(path.join(__dirname,"../desktop/main.cjs"),"utf8");
  assert.match(script,/nodeIntegration:false/);
  assert.match(script,/contextIsolation:true/);
  assert.match(script,/sandbox:true/);
  assert.match(script,/setWindowOpenHandler/);
  assert.match(script,/onBeforeRequest/);
});

test("language switching uses the same save and does not advance RNG, and keeps both language controls visible",()=>{
 const ui=createUiHarness(),before=JSON.stringify(ui.state);
 assert.equal(ui.language,"ja");
 assert.match(ui.markup,/data-lang="en"/);
 ui.click("locale","en");
 assert.equal(ui.language,"en");
 assert.equal(JSON.stringify(ui.state),before);
 assert.match(ui.markup,/data-lang="en" aria-pressed="true"/);
 ui.click("locale","ja");
 assert.equal(ui.language,"ja");
 assert.equal(JSON.stringify(ui.state),before);
});
test("bilingual translation dictionary covers key athletics and championship terms without altering names in saved records",()=>{
 const context=vm.createContext({});
 vm.runInContext(fs.readFileSync(path.join(__dirname,"../src/i18n.js"),"utf8"),context);
 const t=context.EkidenI18n;
 assert.ok(t.translatedPhrases>=180);
 assert.equal(t.translateText("全国高校スカウト","en"),"High School Scouting Network");
 assert.equal(t.translateText("選手名鑑","en"),"Athlete Roster");
 assert.equal(t.translateText("北稜大学","en"),"Hokuryo University");
 assert.equal(t.translateText("精神力","en"),"Mental Grit");
 assert.equal(t.translateText("第3区","en"),"Leg 3");
 assert.equal(t.translateText("全国高校スカウト","ja"),"全国高校スカウト");
});

test("English mode covers the core training, race, rival and accounting flow",()=>{
 const context=vm.createContext({});
 vm.runInContext(fs.readFileSync(path.join(__dirname,"../src/i18n.js"),"utf8"),context);
 const t=context.EkidenI18n;
 const coreCopy=[
  "ゲームの流れを確認する",
  "部費・補強・他校分析・過去の結果（詳細）",
  "大会開始。ペース指示後に走者の体力が表示されます。",
  "競馬中継をイメージした模式図です。正確なタイム差は下の順位表で確認してください。",
  "年度決算・資金繰り",
  "大学配分・卒業生支援は架空のモデル額です。寄付は賞金ではなく活動支援として計上。赤字取引は禁止し、残高は年度をまたいで繰り越します。",
  "王者・北稜大学にも選手名簿と世代交代があります。順位は固定されず、その年の戦力と走りで決まります。",
  "年度決算を確定して次年度へ →"
 ];
 for(const copy of coreCopy){
  const translated=t.translateText(copy,"en");
  assert.doesNotMatch(translated,/[\u3040-\u30ff\u3400-\u9fff々〆〤]/,copy+" => "+translated);
 }
 assert.equal(t.translateText("第3週 / 2年目 / 5位 / 4名 / 3件 / 1杯","en"),"Week 3 / Season 2 / Rank 5 / 4 athletes / 3 entries / 1 servings");
});
