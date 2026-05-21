/**
 * First-run setup screen.
 * Asks for Tibia.dat, Tibia.spr, and TFS root folder.
 * Saves to Electron userData/config.json.
 */
import { AppConfig } from '../types'

declare global {
  interface Window {
    electronAPI: {
      loadConfig: () => Promise<AppConfig | null>
      saveConfig: (c: object) => Promise<void>
      openFile: (opts: object) => Promise<string | null>
      openDir: () => Promise<string | null>
      readBinary: (p: string) => Promise<ArrayBuffer>
      readText: (p: string) => Promise<string>
      writeText: (p: string, c: string) => Promise<void>
      writeBinary: (p: string, b: ArrayBuffer) => Promise<void>
      exists: (p: string) => Promise<boolean>
      listDir: (p: string) => Promise<string[]>
      readDir: (p: string) => Promise<{name: string, isDir: boolean}[]>
      joinPath: (...parts: string[]) => Promise<string>
      openPath: (p: string) => Promise<void>
      saveFile: (opts: object) => Promise<string | null>
    }
  }
}

export async function showSetupScreen(): Promise<AppConfig> {
  return new Promise((resolve) => {
    const el = document.createElement('div')
    el.style.cssText = `
      position:fixed; inset:0; background:#111827;
      display:flex; align-items:center; justify-content:center;
    `

    el.innerHTML = `
      <div style="width:520px; background:#1f2937; border:1px solid #374151;
                  border-radius:10px; padding:32px;">
        <h1 style="font-size:20px; font-weight:700; color:#f9fafb; margin-bottom:6px;">
          GermantecOT Map Editor
        </h1>
        <p style="font-size:12px; color:#6b7280; margin-bottom:28px;">
          Configuración inicial — se guarda automáticamente.
        </p>

        <div id="dat-field" class="cfg-field">
          <label>Tibia.dat</label>
          <div class="file-row">
            <input id="dat-path" type="text" placeholder="Ruta a Tibia.dat" readonly />
            <button id="dat-btn">Seleccionar</button>
          </div>
        </div>

        <div id="spr-field" class="cfg-field">
          <label>Tibia.spr</label>
          <div class="file-row">
            <input id="spr-path" type="text" placeholder="Ruta a Tibia.spr" readonly />
            <button id="spr-btn">Seleccionar</button>
          </div>
        </div>

        <div id="tfs-field" class="cfg-field">
          <label>Carpeta raíz del servidor TFS</label>
          <div class="file-row">
            <input id="tfs-path" type="text" placeholder="e.g. C:\\tfs\\ (copia local del servidor)" readonly />
            <button id="tfs-btn">Seleccionar</button>
          </div>
          <p style="font-size:11px; color:#6b7280; margin-top:4px;">
            Carpeta local sincronizada con el VPS. Usa sync-from-vps.ps1 para actualizar y sync-to-vps.ps1 para subir cambios.
          </p>
        </div>

        <div id="hint" style="display:none; padding:10px; background:#1e3a2f; border:1px solid #166534;
             border-radius:6px; font-size:12px; color:#86efac; margin-bottom:16px;">
          ✅ Tibia.dat, Tibia.spr y carpeta TFS local detectados automáticamente.
        </div>

        <button id="start-btn" style="
          width:100%; padding:12px; background:#06b6d4; color:#fff; border:none;
          border-radius:6px; font-size:14px; font-weight:600; cursor:pointer;
          margin-top:8px; opacity:0.5; pointer-events:none;
        ">Abrir Editor</button>
      </div>

      <style>
        .cfg-field { margin-bottom:18px; }
        .cfg-field label {
          display:block; font-size:11px; color:#9ca3af;
          margin-bottom:5px; text-transform:uppercase; letter-spacing:0.05em;
        }
        .file-row { display:flex; gap:8px; }
        .file-row input {
          flex:1; padding:8px 10px; background:#111827;
          border:1px solid #374151; border-radius:4px;
          color:#e5e7eb; font-size:12px; outline:none;
        }
        .file-row button {
          padding:8px 14px; background:#374151; color:#e5e7eb;
          border:none; border-radius:4px; cursor:pointer; font-size:12px;
          white-space:nowrap;
        }
        .file-row button:hover { background:#4b5563; }
      </style>
    `

    document.body.appendChild(el)

    const datPath  = el.querySelector('#dat-path') as HTMLInputElement
    const sprPath  = el.querySelector('#spr-path') as HTMLInputElement
    const tfsPath  = el.querySelector('#tfs-path') as HTMLInputElement
    const startBtn = el.querySelector('#start-btn') as HTMLButtonElement
    const hint     = el.querySelector('#hint') as HTMLElement

    const checkReady = () => {
      const ready = datPath.value && sprPath.value && tfsPath.value
      startBtn.style.opacity = ready ? '1' : '0.5'
      startBtn.style.pointerEvents = ready ? 'auto' : 'none'
    }

    // Try to pre-fill known paths
    const autoFill = async () => {
      const knownDat = 'C:\\Users\\Admin\\Downloads\\cliente tibia\\otclient-4.0\\otclient-4.0\\data\\things\\1098\\Tibia.dat'
      const knownSpr = 'C:\\Users\\Admin\\Downloads\\cliente tibia\\otclient-4.0\\otclient-4.0\\data\\things\\1098\\Tibia.spr'
      const knownTfs = 'C:\\Users\\Admin\\germantec-tfs-local'
      const [datExists, sprExists, tfsExists] = await Promise.all([
        window.electronAPI.exists(knownDat),
        window.electronAPI.exists(knownSpr),
        window.electronAPI.exists(knownTfs)
      ])
      if (datExists && sprExists) {
        datPath.value = knownDat
        sprPath.value = knownSpr
        hint.style.display = 'block'
      }
      if (tfsExists) {
        tfsPath.value = knownTfs
      }
      checkReady()
    }
    autoFill()

    el.querySelector('#dat-btn')!.addEventListener('click', async () => {
      const p = await window.electronAPI.openFile({
        title: 'Seleccionar Tibia.dat',
        filters: [{ name: 'Tibia.dat', extensions: ['dat'] }, { name: 'All', extensions: ['*'] }]
      })
      if (p) { datPath.value = p; checkReady() }
    })

    el.querySelector('#spr-btn')!.addEventListener('click', async () => {
      const p = await window.electronAPI.openFile({
        title: 'Seleccionar Tibia.spr',
        filters: [{ name: 'Tibia.spr', extensions: ['spr'] }, { name: 'All', extensions: ['*'] }]
      })
      if (p) { sprPath.value = p; checkReady() }
    })

    el.querySelector('#tfs-btn')!.addEventListener('click', async () => {
      const p = await window.electronAPI.openDir()
      if (p) { tfsPath.value = p; checkReady() }
    })

    startBtn.addEventListener('click', async () => {
      const config: AppConfig = {
        datPath: datPath.value,
        sprPath: sprPath.value,
        tfsRoot: tfsPath.value,
        lastMapPath: ''
      }
      await window.electronAPI.saveConfig(config)
      el.remove()
      resolve(config)
    })
  })
}
