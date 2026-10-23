"use strict";
// Original deterministic Store icon CANDIDATES for internal MSIX review only.
// These assets are not owner-approved listing artwork. Existing files are never overwritten.
const fs=require("node:fs"),path=require("node:path"),zlib=require("node:zlib");
const root=path.resolve(__dirname,"..");
const outDir=path.join(root,"build","appx");
const specs={"StoreLogo.png":[50,50],"Square44x44Logo.png":[44,44],"Square150x150Logo.png":[150,150],"Wide310x150Logo.png":[310,150]};
const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);return c>>>0;});
function crc32(b){let c=0xffffffff;for(const x of b)c=crcTable[(c^x)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function chunk(type,data){const t=Buffer.from(type),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([t,data])));return Buffer.concat([len,t,data,crc]);}
function lineDistance(x,y,x1,y1,x2,y2){const dx=x2-x1,dy=y2-y1,den=dx*dx+dy*dy;const t=den?Math.max(0,Math.min(1,((x-x1)*dx+(y-y1)*dy)/den)):0;return Math.hypot(x-(x1+t*dx),y-(y1+t*dy));}
function paint(w,h){
 const buf=Buffer.alloc(h*(w*4+1));
 const scale=Math.min(w,h),wide=w>h, cx=wide?.31:.5, cy=.5;
 for(let y=0;y<h;y++){const row=y*(w*4+1);buf[row]=0;for(let x=0;x<w;x++){
  const nx=(x/w-cx)/(scale/w)+.5, ny=(y/h-cy)/(scale/h)+.5;
  let col=[18,37,48,255];
  const circle=Math.hypot(nx-.5,ny-.5);
  if(circle<.44)col=[51,91,83,255];
  if(circle<.36)col=[18,37,48,255];
  const runner=[
   Math.hypot(nx-.56,ny-.28)<.075,
   lineDistance(nx,ny,.54,.36,.48,.55)<.045,
   lineDistance(nx,ny,.50,.43,.38,.49)<.03,
   lineDistance(nx,ny,.52,.42,.68,.46)<.03,
   lineDistance(nx,ny,.48,.55,.37,.75)<.035,
   lineDistance(nx,ny,.48,.55,.65,.68)<.035,
   lineDistance(nx,ny,.49,.46,.59,.51)<.022
  ].some(Boolean);
  if(runner)col=[244,242,226,255];
  if(lineDistance(nx,ny,.20,.81,.80,.81)<.018)col=[234,193,112,255];
  if(wide && x/w>.63 && x/w<.95 && (Math.abs(y/h-.38)<.018||Math.abs(y/h-.62)<.018))col=[234,193,112,255];
  const p=row+1+x*4;buf[p]=col[0];buf[p+1]=col[1];buf[p+2]=col[2];buf[p+3]=col[3];
 }}
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=6;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk("IHDR",ihdr),chunk("IDAT",zlib.deflateSync(buf,{level:9})),chunk("IEND",Buffer.alloc(0))]);
}
function run(){
 fs.mkdirSync(outDir,{recursive:true});
 for(const [name,[w,h]] of Object.entries(specs)){
  const file=path.join(outDir,name);
  if(fs.existsSync(file)){process.stdout.write("KEEP existing "+name+"; not overwritten\n");continue;}
  const bytes=paint(w,h);fs.writeFileSync(file,bytes,{flag:"wx"});
  process.stdout.write("CANDIDATE "+name+" "+w+"x"+h+" "+bytes.length+" bytes\n");
 }
 process.stdout.write("Candidate icon files are for internal review only; STORE_BRAND_APPROVED remains unset.\n");
}
if(require.main===module)run();
module.exports={specs,paint,crc32,run};
