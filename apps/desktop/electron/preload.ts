import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },
})

contextBridge.exposeInMainWorld('nativeVirtualCamera', {
  initialize: () => ipcRenderer.invoke('native-virtual-camera:initialize'),
  start: () => ipcRenderer.invoke('native-virtual-camera:start'),
  stop: () => ipcRenderer.invoke('native-virtual-camera:stop'),
  pushFrame: (buffer: ArrayBuffer, width: number, height: number) =>
    ipcRenderer.invoke('native-virtual-camera:push-frame', buffer, width, height),
  isRunning: () => ipcRenderer.invoke('native-virtual-camera:is-running'),
  uninstall: () => ipcRenderer.invoke('native-virtual-camera:uninstall'),
})

