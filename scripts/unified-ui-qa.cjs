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
  await p.screenshot({path:path.join(output,"01-desktop-1280x720.png"),fullPage:false});
  const tab=p.locator('[role="tab"]:visible');
  const count=await tab.count(),observed={visibleTabs:count,clickedTab:false};
  assert.equal(count,config.expectedTabs,"Unexpected game-tab count; verify the UI really initialized");
  if(config.landingCards)assert.equal(await p.locator(".board").count(),config.landingCards,"Landing content changed");

  let verifiedTabs=0;
  for(let index=0;index<count;index++){
   const button=tab.nth(index);
   await button.click();
   assert.equal(await button.getAttribute("aria-selected"),"true",
     "Tab "+index+" did not become active");
   const panelCheck=await p.evaluate(()=>{
    const all=[...document.querySelectorAll('[role="tab"]')].filter(el=>el.getClientRects().length>0);
    const selected=all.filter(el=>el.getAttribute("aria-selected")==="true");
    if(selected.length!==1)return {error:"Expected exactly one active tab",selected:selected.length};
    const controls=(selected[0].getAttribute("aria-controls")||"").split(/\s+/).filter(Boolean);
    if(!controls.length)return {error:"Selected tab has no panel"};
    const visibility=controls.map(id=>{
     const el=document.getElementById(id);
     return {id,exists:!!el,visible:!!el&&!el.hidden&&el.getClientRects().length>0};
    });
    return {name:selected[0].textContent.trim(),visibility};
   });
   assert.equal(panelCheck.error,undefined,JSON.stringify(panelCheck));
   assert.equal(panelCheck.visibility.every(x=>x.exists&&x.visible),true,
     "Tab must show its own panels: "+JSON.stringify(panelCheck));
   verifiedTabs++;
   if(index===1)await p.screenshot({path:path.join(output,"02-second-tab-1280x720.png"),fullPage:false});
  }
  if(count>=2){
   await tab.first().focus();
   await p.keyboard.press("End");
   assert.equal(await tab.nth(count-1).getAttribute("aria-selected"),"true",
     "End should select last tab");
   await p.keyboard.press("Home");
   assert.equal(await tab.first().getAttribute("aria-selected"),"true",
     "Home should select first tab");
  }
  observed.clickedTab=count>=2;
  observed.checkedAllTabs=verifiedTabs===count;
  const mobile=await browser.newContext({viewport:{width:1024,height:768}}),q=await mobile.newPage();
  listen(q);await q.goto(url.pathToFileURL(path.resolve("index.html")).href,{waitUntil:"load"});
  const metrics=await q.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth}));
  assert.ok(metrics.scrollWidth<=metrics.viewport+2,"horizontal overflow at 1024px: "+JSON.stringify(metrics));
  await q.screenshot({path:path.join(output,"03-compact-1024x768.png"),fullPage:false});
  const copy=(await q.locator("body").innerText());
  const forbidden=["MSIX","QA_UNSIGNED","Store Identity","GitHub Actions","WACK","開発工程"];
  assert.equal(forbidden.some(s=>copy.includes(s)),false,"internal engineering terms shown on player screen");
  if(config.devCopyHold)assert.match(copy,/開発版のため販売は未開始/);
  else assert.doesNotMatch(copy,/開発版のため販売は未開始/);
  if(config.entranceSelector){
   await q.locator(config.entranceSelector).click();
   assert.notEqual(q.url(),url.pathToFileURL(path.resolve("index.html")).href,"entrance should navigate into game");
   await q.screenshot({path:path.join(output,"04-entered-game-1024x768.png"),fullPage:false});
  }
  const images=fs.readdirSync(output).filter(name=>name.endsWith(".png"));
  assert.ok(images.length>=2,"UI screenshots must exist");
  for(const name of images){
   const bytes=fs.readFileSync(path.join(output,name));
   assert.equal(bytes.subarray(0,8).toString("hex"),"89504e470d0a1a0a","Invalid PNG "+name);
   const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
   const expected=name.includes("1024x768")? [1024,768] : [1280,720];
   assert.deepEqual([width,height],expected,"Incorrect pixel dimensions "+name);
  }
  assert.deepEqual(errors,[],"browser runtime error");
  assert.deepEqual(network,[],"game should run without network dependency");
  const qa={status:"PASS",product:config.product,sourceCommit:process.env.GITHUB_SHA||"LOCAL_SHA_IN_SEPARATE_HANDOFF",title,views:["1280x720","1024x768"],tabs:observed,
   horizontalOverflow:false,executionContext:process.env.GITHUB_ACTIONS==="true"?"github-actions":"local",runnerAvailability:"not assessed by browser test",devCopyHold:config.devCopyHold,screenshots:images.length,
   errors,externalRequests:network,scope:"Chromium UI rendering/one nav action; not a packaged MSIX install test"};
  fs.writeFileSync(path.join(output,"QA_RESULT.json"),JSON.stringify(qa,null,2)+"\n");
  console.log("UNIFIED_BROWSER_QA_PASS "+JSON.stringify(qa));
 }finally{await browser.close();}
})().catch(e=>{console.error("UNIFIED_BROWSER_QA_FAIL",e.stack||e);process.exitCode=1;});
