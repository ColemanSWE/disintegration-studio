import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { 
  initializeVirtualCamera, 
  startVirtualCamera, 
  stopVirtualCamera, 
  pushFrameToCamera, 
  isVirtualCameraRunning,
  uninstallSystemExtension 
} from './virtual-camera'

const isDev = process.env.NODE_ENV === 'development'

app.setName('Disintegration Studio')

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: isDev ? false : true,
    },
    titleBarStyle: 'default',
    trafficLightPosition: { x: 15, y: 15 },
    backgroundColor: '#0a0a0b',
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5174')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(async () => {
  createWindow()

  ipcMain.handle('native-virtual-camera:initialize', initializeVirtualCamera)
  ipcMain.handle('native-virtual-camera:start', startVirtualCamera)
  ipcMain.handle('native-virtual-camera:stop', stopVirtualCamera)
  ipcMain.handle('native-virtual-camera:push-frame', async (_, buffer: ArrayBuffer, width: number, height: number) => {
    return await pushFrameToCamera(Buffer.from(buffer), width, height)
  })
  ipcMain.handle('native-virtual-camera:is-running', isVirtualCameraRunning)
  ipcMain.handle('native-virtual-camera:uninstall', uninstallSystemExtension)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

