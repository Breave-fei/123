import { app, BrowserWindow, shell, ipcMain, Tray, Menu, dialog } from 'electron'
import { release } from 'node:os'
import { join } from 'node:path'

const path = require('path');

// The built directory structure
//
// ├─┬ dist-electron
// │ ├─┬ main
// │ │ └── index.js    > Electron-Main
// │ └─┬ preload
// │   └── index.js    > Preload-Scripts
// ├─┬ dist
// │ └── index.html    > Electron-Renderer
//
process.env.DIST_ELECTRON = join(__dirname, '..')
process.env.DIST = join(process.env.DIST_ELECTRON, '../dist')
process.env.PUBLIC = process.env.VITE_DEV_SERVER_URL
  ? join(process.env.DIST_ELECTRON, '../public')
  : process.env.DIST

// Disable GPU Acceleration for Windows 7
if (release().startsWith('6.1')) app.disableHardwareAcceleration()

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

// Remove electron security warnings
// This warning only shows in development mode
// Read more on https://www.electronjs.org/docs/latest/tutorial/security
// process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'

let win: BrowserWindow | null = null
// Here, you can also use other preload
const preload = join(__dirname, '../preload/index.js')
const url = process.env.VITE_DEV_SERVER_URL
const indexHtml = join(process.env.DIST, 'index.html')

let tray = null
async function createWindow() {
  win = new BrowserWindow({
    title: 'Main window',
    icon: join(process.env.PUBLIC, 'favicon.ico'),
    webPreferences: {
      preload,
      // Warning: Enable nodeIntegration and disable contextIsolation is not secure in production
      // Consider using contextBridge.exposeInMainWorld
      // Read more on https://www.electronjs.org/docs/latest/tutorial/context-isolation
      nodeIntegration: true,
      contextIsolation: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) { // electron-vite-vue#298
    win.loadURL(url)
    // Open devTool if the app is not packaged
    win.webContents.openDevTools()
  } else {
    win.loadFile(indexHtml)
  }

  // Test actively push message to the Electron-Renderer
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  // Make all links open with the browser, not with the application
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url)
    return { action: 'deny' }
  })
  // win.webContents.on('will-navigate', (event, url) => { }) #344



  // 打开窗口的调试工具
  win.webContents.openDevTools();

  // 关闭默认菜单
  win.setMenu(null);

  // 窗口关闭的监听  
  win.on('closed', (event) => {
    console.log("111");

    win = null;
  });
  // 触发关闭时触发
  win.on('close', (event) => {
    console.log("000");


    if (dialog.showMessageBoxSync(win, {
      type: "info",
      buttons: ["最小化到托盘", "直接退出"],
      title: "提示",
      message: "确定要退出吗？",
      defaultId: 0,
      cancelId: 1
    }) === 0) {
      // 截获 close 默认行为
      event.preventDefault();
      // 点击关闭时触发close事件，我们按照之前的思路在关闭时，隐藏窗口，隐藏任务栏窗口
      win.hide(); // 隐藏
    } else {
      app.exit();
    }

    // // 截获 close 默认行为
    // event.preventDefault();
    // // 点击关闭时触发close事件，我们按照之前的思路在关闭时，隐藏窗口，隐藏任务栏窗口
    // win.hide(); // 隐藏
    // win.setSkipTaskbar(true);

  });
  // // 触发显示时触发
  // win.on('show', () => { });
  // // 触发隐藏时触发
  // win.on('hide', () => { });

  // 新建托盘
  tray = new Tray(path.join(__dirname, '../../public/Logo.png'));
  // 托盘名称
  tray.setToolTip('国王排名');
  // 托盘菜单
  const contextMenu = Menu.buildFromTemplate([{
    label: '显示',
    click: () => { win.show() }
  },
  {
    label: '退出',
    click: () => { win.destroy() }
  }
  ]);
  // 载入托盘菜单
  tray.setContextMenu(contextMenu);
  // 双击触发
  tray.on('double-click', () => {
    // 双击通知区图标实现应用的显示或隐藏
    win.isVisible() ? win.hide() : win.show()
    win.isVisible() ? win.setSkipTaskbar(false) : win.setSkipTaskbar(true);
  });
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  win = null
  if (process.platform !== 'darwin') app.quit()
})

app.on('second-instance', () => {
  if (win) {
    // Focus on the main window if the user tried to open another
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length) {
    allWindows[0].focus()
  } else {
    createWindow()
  }
})

// New window example arg: new windows url
ipcMain.handle('open-win', (_, arg) => {
  const childWindow = new BrowserWindow({
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    childWindow.loadURL(`${url}#${arg}`)
  } else {
    childWindow.loadFile(indexHtml, { hash: arg })
  }



})

/* 
  通信：使用ipcRenderer 和 ipcMain模块发送消息，让主进程、渲染进程通信、
    在渲染进程中通过ipcRender模块给主进程发送信息；
    主进程中接收渲染进程的消息，并调用函数，进行相应的操作

*/
// 接收通信，渲染进程
ipcMain.on("win-close", () => {
  console.log("000");
  // win.close();
  app.quit();
})

