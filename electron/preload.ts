import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close:    () => ipcRenderer.send('window:close'),

  // Database queries (IPC → main process → SQLite)
  getMetricsOverview: ()           => ipcRenderer.invoke('db:metrics:overview'),
  getMetricsWeekly:  ()            => ipcRenderer.invoke('db:metrics:weekly'),
  getDocuments:      (params?: any) => ipcRenderer.invoke('db:documents', params),
  getTasks:          (params?: any) => ipcRenderer.invoke('db:tasks',     params),
  getActivity:       (params?: any) => ipcRenderer.invoke('db:activity',  params),
  getTeam:           ()            => ipcRenderer.invoke('db:team'),
  getTeamMember:     (id: string)  => ipcRenderer.invoke('db:team:member', id),
})
