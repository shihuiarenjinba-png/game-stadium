"use strict";
/* Separate Store MSIX candidate pipeline. Existing NSIS / portable packaging is unchanged. */
const fs=require("node:fs"),path=require("node:path"),{spawnSync}=require("node:child_process");
const {record,issues:identityIssues}=require("./store-identity.cjs");
const root=path.resolve(__dirname,"..");
const LOGOS=Object.freeze({"StoreLogo.png":[50,50],"Square150x150Logo.png":[150,150],
 "Square44x44Logo.png":[44,44],"Wide310x150Logo.png":[310,150]});
const requiredFiles=["index.html","src/engine.js","src/app.js","src/styles.css","desktop/main.cjs"];
const builderVersion="27.0.0-alpha.10";
function dimensions(p){
 const b=fs.readFileSync(p);if(b.length<33||b.subarray(0,8).toString("hex")!=="89504e470d0a1a0a"||b.toString("ascii",12,16)!=="IHDR")return null;
 return [b.readUInt32BE(16),b.readUInt32BE(20)];
}
function gate(env,{platform=process.platform,rootDir=root,installedBuilderVersion=null}={}){
 const errors=identityIssues(env);
 if(platform!=="win32")errors.push("正規MSIXはWindowsのコード担当環境でビルドしてください");
 if(env.STORE_IDENTITY_CONFIRMED!=="YES")errors.push("STORE_IDENTITY_CONFIRMED=YES（本人のIdentity確認）が必要");
 if(env.STORE_BRAND_APPROVED!=="YES")errors.push("STORE_BRAND_APPROVED=YES（ロゴの権利・表示確認）が必要");
 const ver=env.STORE_PACKAGE_VERSION||"";
 if(!/^\d+\.\d+\.\d+\.0$/.test(ver)||ver.split(".").some(x=>Number(x)>65535)||Number(ver.split(".")[0])<1)
  errors.push("STORE_PACKAGE_VERSION=1.0.0.0形式の正式パッケージ版番号が必要");
 let pkg=null;
 try{pkg=JSON.parse(fs.readFileSync(path.join(rootDir,"package.json"),"utf8"));}
 catch(e){errors.push("package.json が読めません");}
 if(pkg&&ver!==pkg.version+".0")errors.push("パッケージ版番号とpackage.jsonが不一致（開発版0.7.0は商用提出前に承認が必要）");
 const actualBuilder=installedBuilderVersion??(fs.existsSync(path.join(rootDir,"node_modules","electron-builder","package.json"))?
  JSON.parse(fs.readFileSync(path.join(rootDir,"node_modules","electron-builder","package.json"),"utf8")).version:null);
 if(actualBuilder!==builderVersion)errors.push("MSIX対応検証予定のelectron-builder "+builderVersion+" が必要。NSIS用v26を無断更新しない");
 for(const file of requiredFiles)if(!fs.existsSync(path.join(rootDir,file)))errors.push("アプリ原本が不足: "+file);
 for(const [file,size] of Object.entries(LOGOS)){
  const p=path.join(rootDir,"build","appx",file);
  if(!fs.existsSync(p)){errors.push("承認ロゴが未配置: "+file);continue;}
  try{const actual=dimensions(p);if(!actual||actual[0]!==size[0]||actual[1]!==size[1])errors.push("承認ロゴのサイズが不正: "+file);}
  catch(e){errors.push("承認ロゴを読み取れない: "+file);}
 }
 return errors;
}
function makeConfig(env){
 return {appId:"jp.ekidenmanager.game",productName:"EKIDEN MANAGER",buildVersion:env.STORE_PACKAGE_VERSION,
  asar:true,files:["index.html","src/**/*.js","src/**/*.css","desktop/main.cjs","package.json"],
  directories:{output:"dist-msix-store-candidate",buildResources:"build"},
  toolsets:{winCodeSign:"1.1.0"},win:{target:[{target:"msix",arch:["x64"]}]},
  msix:{applicationId:"EkidenManager",identityName:env.STORE_IDENTITY_NAME,publisher:env.STORE_PUBLISHER,
   publisherDisplayName:env.STORE_PUBLISHER_DISPLAY_NAME,displayName:"EKIDEN MANAGER",
   languages:["ja-JP","en-US"],createMsixupload:true,setBuildNumber:false,capabilities:["runFullTrust"]}};
}
function run(){
 const errors=gate(process.env);
 if(errors.length){process.stderr.write("STORE_MSIX_HOLD\n"+errors.map(e=>" - "+e).join("\n")+"\n");process.exitCode=2;return;}
 if(process.argv.includes("--preflight")){
  process.stdout.write("STORE_MSIX_PREFLIGHT_PASS — Partner Center設定とロゴの確認のみ。MSIX生成・WACK・販売提出は未実施。\n");
  return;
 }
 const out=path.join(root,"dist-msix-store-candidate");
 if(fs.existsSync(out)&&fs.readdirSync(out).length){process.stderr.write("出力ディレクトリに既存成果物があります。上書きせず別環境で検証してください。\n");process.exitCode=2;return;}
 const configPath=path.join(root,"electron-builder.store.candidate.generated.json");
 if(fs.existsSync(configPath)){process.stderr.write("既存の候補設定を保護しました。手動で確認してください。\n");process.exitCode=2;return;}
 fs.writeFileSync(configPath,JSON.stringify(makeConfig(process.env),null,2)+"\n",{flag:"wx"});
 const cli=path.join(root,"node_modules","electron-builder","cli.js");
 const result=spawnSync(process.execPath,[cli,"--win","msix","--x64","--config",configPath,"--publish","never"],
  {cwd:root,stdio:"inherit",shell:false});
 if(result.error||result.status!==0){process.stderr.write("MSIX生成が失敗しました。旧リリースや出力は上書きしていません。\n");process.exitCode=result.status||1;return;}
 const manifest=spawnSync("powershell.exe",["-NoProfile","-ExecutionPolicy","Bypass","-File",
  path.join(root,"scripts","verify-store-msix.ps1")],{cwd:root,stdio:"inherit",shell:false,env:process.env});
 if(manifest.error||manifest.status!==0){process.stderr.write("MSIX Manifest照合HOLD\n");process.exitCode=manifest.status||2;return;}
 process.stdout.write("MSIX候補生成とManifest検査成功。実機動作・署名・WACK・提出は引き続きHOLD。\n");
}
if(require.main===module)run();
module.exports={gate,makeConfig,dimensions,requiredFiles,LOGOS,builderVersion,record};
