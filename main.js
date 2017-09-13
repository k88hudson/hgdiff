const {app, BrowserWindow, ipcMain, clipnoard} = require('electron')
const path = require('path')
const url = require('url')
const fs = require('fs');
const {exec} = require('child_process');
const settings = require('electron-settings');

function resolveHome(filepath) {
  if (filepath[0] === '~') {
    return path.join(process.env.HOME, filepath.slice(1));
  }
  return filepath;
}

function execAsync(text) {
  return new Promise((resolve, reject) => {
    exec(text, {cwd: resolveHome(settings.get('directory'))}, (error, stdout, stderr) => {
      if (error) {
        return reject(error);
      }
      resolve(stdout);
    });
  });
}

async function getLastCommitDiff(id) {
  return await execAsync(`hg log --patch --rev ${id} --template "{diff}"`);
}

async function getLastBookmark() {
  try {
    return (await execAsync("hg identify -B")).replace(/\s/g,'');
  } catch (error) {
    return "";
  }
}

ipcMain.on("get-diff", async (event) => {
  try {
    const bookmark = await getLastBookmark();
    let rev = await execAsync("hg identify --num");
    rev = rev.replace(/\s/g,'');
    let diff = await execAsync('hg diff');
    if (!diff) {
      diff = await getLastCommitDiff(rev);
    }
    event.sender.send("diff-info", {
      diff,
      bookmark,
      rev
    });
  } catch (e) {
    console.error(e);
    let message = e.message;
    if (e.code === "ENOENT") {
      message = `Oops! Looks like maybe ${resolveHome(settings.get('directory'))} doesn't exist`;
    }
    event.sender.send('diff-error', message);
  }
});

let win;

function createWindow () {
  win = new BrowserWindow({width: 800, height: 600});
  win.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: "file:",
    slashes: true
  }));

  //win.webContents.openDevTools()

  win.on('closed', () => {
    win = null;
  });
}

app.on('ready', createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
});
app.on('activate', () => {
  if (win === null) {
    createWindow();
  }
});
