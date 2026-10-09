"use strict";
const path = require("node:path");
const {app, BrowserWindow, Menu, session} = require("electron");

// This application never needs a backend, telemetry endpoint, updater, or login.
const lock=app.requestSingleInstanceLock();
if(!lock){app.quit();}
let mainWindow=null;
app.on("second-instance",()=>{
  if(mainWindow){if(mainWindow.isMinimized())mainWindow.restore();mainWindow.focus();}
});
function createWindow(){
  Menu.setApplicationMenu(null);
  const win=new BrowserWindow({
    title:"EKIDEN MANAGER — 栄光への襷",
    width:1370,height:860,minWidth:800,minHeight:600,show:false,
    backgroundColor:"#10171d",
    autoHideMenuBar:true,
    webPreferences:{
      nodeIntegration:false,
      contextIsolation:true,
      sandbox:true,
      webSecurity:true,
      devTools:false
    }
  });
  const start=path.join(__dirname,"..","index.html");
  win.webContents.setWindowOpenHandler(()=>({action:"deny"}));
  win.webContents.on("will-navigate",(event,url)=>{
    if(url!==win.webContents.getURL())event.preventDefault();
  });
  win.webContents.on("will-attach-webview",event=>event.preventDefault());
  win.once("ready-to-show",()=>win.show());
  win.on("closed",()=>{mainWindow=null;});
  mainWindow=win;
  win.loadFile(start).catch(err=>{console.error("Could not load offline UI:",err);app.quit();});
}
app.whenReady().then(()=>{
  session.defaultSession.setPermissionRequestHandler((_contents,_permission,reply)=>reply(false));
  session.defaultSession.setPermissionCheckHandler(()=>false);
  // The game is offline-only: prevent outbound network, but allow local files and blob save exports.
  session.defaultSession.webRequest.onBeforeRequest((details,reply)=>{
    reply({cancel:/^(https?|wss?):/i.test(details.url)});
  });
  createWindow();
});
app.on("window-all-closed",()=>app.quit());
