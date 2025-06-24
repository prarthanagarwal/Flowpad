# Electron App Shows "Electron" in Task Manager Instead of App Name

## Environment
- **Electron**: 36.5.0
- **electron-builder**: 24.13.3
- **Windows**: 10.0.19045
- **Target**: Windows x64 NSIS + Portable

## Configuration
```json
{
  "productName": "Notes App",
  "build": {
    "win": {
      "signAndEditExecutable": true,
      "executableName": "Notes App",
      "icon": "assets/icon.ico",
      "publisherName": "Notes App Developer"
    }
  }
}
```

## Problem
- Installed app shows **"Electron"** in Task Manager instead of **"Notes App"**
- Uses default Electron icon instead of custom `icon.ico`
- Build completes successfully when run as Administrator

## Tried
1. ✅ `signAndEditExecutable: true` (as admin)
2. ✅ Manual `rcedit` post-build 
3. ✅ Set `productName`, `executableName`, proper icon path
4. ❌ App still shows as "Electron" after installation

## Question
What's preventing the executable metadata from being applied correctly? The build succeeds but Windows doesn't recognize the custom app name/icon. 