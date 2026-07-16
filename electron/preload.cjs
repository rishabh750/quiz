const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('IS_DESKTOP', true)
