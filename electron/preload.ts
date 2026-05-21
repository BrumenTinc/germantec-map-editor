import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // Config
  loadConfig: () => ipcRenderer.invoke('config:load'),
  saveConfig: (config: object) => ipcRenderer.invoke('config:save', config),

  // Dialogs
  openFile: (opts: object) => ipcRenderer.invoke('dialog:openFile', opts),
  openDir: () => ipcRenderer.invoke('dialog:openDir'),
  saveFile: (opts: object) => ipcRenderer.invoke('dialog:saveFile', opts),

  // File I/O
  readBinary: (path: string) => ipcRenderer.invoke('fs:readBinary', path),
  readText:   (path: string) => ipcRenderer.invoke('fs:readText', path),
  writeText:  (path: string, content: string) => ipcRenderer.invoke('fs:writeText', path, content),
  writeBinary:(path: string, buf: ArrayBuffer) => ipcRenderer.invoke('fs:writeBinary', path, buf),
  exists:     (path: string) => ipcRenderer.invoke('fs:exists', path),
  listDir:    (path: string) => ipcRenderer.invoke('fs:listDir', path),
  readDir:    (path: string) => ipcRenderer.invoke('fs:readDir', path),
  joinPath:   (...parts: string[]) => ipcRenderer.invoke('fs:joinPath', ...parts),
  openPath:   (path: string) => ipcRenderer.invoke('shell:openPath', path),
})
