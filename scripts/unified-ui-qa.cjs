"use strict";
const {chromium}=require("playwright"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),url=require("node:url");
const config=JSON.parse(fs.readFileSync(path.join(__dirname,"unified-ui-qa-config.json"),"utf8"));
const output=path.resolve("unified-ui-evidence");fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true}),errors=[],network=[];
 try{
  const ctx=await browser.newContext({viewport:{width:1280,height:720}}),p=await ctx.newPage();
  const listen=x=>{x.on("pageerror",e=>errors.push(e.message));x.on("request",r=>{if(/^https?:/.test(r.url()))network.push(r.url());});x.on("dialog",d=>d.accept());};
  listen(p);await p.goto(url.pathToFileURL(path.resolve("index.html")).href,{waitUntil:"load"});
  const title=await p.title();assert.ok(title.length>4,"missing game window title");
  const text=await p.locator("body").innerText();assert.ok(text.length>60,"game content not painted");
  await p.screenshot({path:path.join(output,"01-desktop-1280x720.png"),fullPage:true});
  const tab=p.locator('[role="tab"]:visible');
  const count=await tab.count(),observed={visibleTabs:count,clickedTab:false};
  assert.equal(count,config.expectedTabs,"Unexpected game-tab count; verify the UI really initialized");
  if(config.landingCards)assert.equal(await p.locator(".board").count(),config.landingCards,"Landing content changed");

  if(count>=2){
   const second=tab.nth(1);await second.click();
   const a=await second.getAttribute("aria-selected");
   if(a!==null)assert.equal(a,"true","click must activate selected UI tab");
   if(config.panelSelector){
    const visible=await p.locator(config.panelSelector).evaluateAll(nodes=>nodes.filter(el=>el.getClientRects().length>0).length);
    assert.ok(visible>=1,"Tab switch left the player without a visible game panel");
   }
   observed.clickedTab=true;
   await p.screenshot({path:path.join(output,"02-second-tab-1280x720.png"),fullPage:true});
  }
  const mobile=await browser.newContext({viewport:{width:1024,height:768}}),q=await mobile.newPage();
  listen(q);await q.goto(url.pathToFileURL(path.resolve("index.html")).href,{waitUntil:"load"});
  const metrics=await q.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth}));
  assert.ok(metrics.scrollWidth<=metrics.viewport+2,"horizontal overflow at 1024px: "+JSON.stringify(metrics));
  await q.screenshot({path:path.join(output,"03-compact-1024x768.png"),fullPage:true});
  const copy=(await q.locator("body").innerText());
  const forbidden=["MSIX","QA_UNSIGNED","Store Identity","GitHub Actions","WACK","開発工程"];
  assert.equal(forbidden.some(s=>copy.includes(s)),false,"internal engineering terms shown on player screen");
  if(config.devCopyHold)assert.match(copy,/開発版のため販売は未開始/);
  else assert.doesNotMatch(copy,/開発版のため販売は未開始/);
  if(config.entranceSelector){
   await q.locator(config.entranceSelector).click();
   assert.notEqual(q.url(),url.pathToFileURL(path.resolve("index.html")).href,"entrance should navigate into game");
   await q.screenshot({path:path.join(output,"04-entered-game-1024x768.png"),fullPage:true});
  }
  assert.deepEqual(errors,[],"browser runtime error");
  assert.deepEqual(network,[],"game should run without network dependency");
  const qa={status:"PASS",product:config.product,head:"See actions run SHA",title,views:["1280x720","1024x768"],tabs:observed,
   horizontalOverflow:false,privateRunnerPending:false,devCopyHold:config.devCopyHold,screenshots:config.entranceSelector?4:count>=2?3:2,
   errors,externalRequests:network,scope:"Chromium UI rendering/one nav action; not a packaged MSIX install test"};
  fs.writeFileSync(path.join(output,"QA_RESULT.json"),JSON.stringify(qa,null,2)+"\n");
  console.log("UNIFIED_BROWSER_QA_PASS "+JSON.stringify(qa));
 }finally{await browser.close();}
})().catch(e=>{console.error("UNIFIED_BROWSER_QA_FAIL",e.stack||e);process.exitCode=1;});
