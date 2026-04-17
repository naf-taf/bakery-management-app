const { contextBridge, ipcRenderer } = require('electron');

// Expose database functions to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  dbQuery: (query, params) => ipcRenderer.invoke('db-query', query, params),
  dbRun: (query, params) => ipcRenderer.invoke('db-run', query, params),
  deleteRecipe: (recipeId) => ipcRenderer.invoke('recipe-delete', recipeId),
});
