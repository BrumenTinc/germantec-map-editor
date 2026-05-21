import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import path from 'path'
import fs from 'fs'

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    backgroundColor: '#111827',
    titleBarStyle: 'default',
    title: 'GermantecOT Map Editor',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// ──────────────────────────────────────────────
// IPC: Config
// ──────────────────────────────────────────────
const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json')

ipcMain.handle('config:load', () => {
  try {
    if (!fs.existsSync(CONFIG_PATH)) return null
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))
  } catch { return null }
})

ipcMain.handle('config:save', (_e, config: object) => {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2))
})

// ──────────────────────────────────────────────
// IPC: File dialogs
// ──────────────────────────────────────────────
ipcMain.handle('dialog:openFile', async (_e, opts: Electron.OpenDialogOptions) => {
  const result = await dialog.showOpenDialog(mainWindow!, opts)
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('dialog:openDir', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory']
  })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('dialog:saveFile', async (_e, opts: Electron.SaveDialogOptions) => {
  const result = await dialog.showSaveDialog(mainWindow!, opts)
  return result.canceled ? null : result.filePath
})

// ──────────────────────────────────────────────
// IPC: File I/O
// ──────────────────────────────────────────────
ipcMain.handle('fs:readBinary', (_e, filePath: string) => {
  const buf = fs.readFileSync(filePath)
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
})

ipcMain.handle('fs:readText', (_e, filePath: string) => {
  return fs.readFileSync(filePath, 'utf-8')
})

ipcMain.handle('fs:writeText', (_e, filePath: string, content: string) => {
  fs.writeFileSync(filePath, content, 'utf-8')
})

ipcMain.handle('fs:writeBinary', (_e, filePath: string, buffer: ArrayBuffer) => {
  fs.writeFileSync(filePath, Buffer.from(buffer))
})

ipcMain.handle('fs:exists', (_e, filePath: string) => {
  return fs.existsSync(filePath)
})

ipcMain.handle('fs:listDir', (_e, dirPath: string) => {
  if (!fs.existsSync(dirPath)) return []
  return fs.readdirSync(dirPath)
})

ipcMain.handle('fs:readDir', (_e, dirPath: string) => {
  if (!fs.existsSync(dirPath)) return []
  return fs.readdirSync(dirPath).map(name => ({
    name,
    isDir: fs.statSync(path.join(dirPath, name)).isDirectory()
  }))
})

ipcMain.handle('fs:joinPath', (_e, ...parts: string[]) => {
  return path.join(...parts)
})

ipcMain.handle('shell:openPath', (_e, p: string) => {
  shell.openPath(p)
})
