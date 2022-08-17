let runningTask, activeTab;
chrome.runtime.onInstalled.addListener( () => {
  console.log("hello world");

  let response = loadLogTimeData();
  return response.then(logTimeData => {
    if (logTimeData?.running === true) {
      console.log('auto create task by store config');
      runningTask = createRunningTaskInterval(60000);
    }
  });
} );

const configProcessorMappers = {
  "log-sang": (loggedData, logTime = '08:29:00') => {
    let currentDate = new Date().toLocaleDateString("vi-VN");
    if (loggedData && loggedData[currentDate] && loggedData[currentDate]['log-sang']) {
      throw new Error("Đã log sáng");
    }

    if (!logTime) {
      logTime = '08:29:00';
    }
    
    let currentTime = new Date().toLocaleTimeString('vi-VN')
        currentTimeArr =  currentTime.split(':'),
        totalSecondCurrentTime = parseInt((currentTimeArr[0] * 3600) + (currentTimeArr[1] * 60) + currentTimeArr[0]),
        logTimeSecond = 0;

    logTimeArr = logTime.split(':');
    logTimeSecond = parseInt((logTimeArr[0] * 3600) + (logTimeArr[1] * 60) + logTimeArr[0]);
    if (totalSecondCurrentTime < logTimeSecond) {
      throw new Error("Chưa tới lúc log giờ");
    }
  },
  "log-chieu": (loggedData, logTime = '13:00:00') => {
    let currentDate = new Date().toLocaleDateString("vi-VN");
    if (loggedData && loggedData[currentDate] && loggedData[currentDate]['log-chieu']) {
      throw new Error("Đã log chiều");
    }
    if (!logTime) {
      logTime = '13:00:00';
    }

    let currentTime = new Date().toLocaleTimeString('vi-VN')
        currentTimeArr =  currentTime.split(':'),
        totalSecondCurrentTime = parseInt((currentTimeArr[0] * 3600) + (currentTimeArr[1] * 60) + currentTimeArr[0]),
        logTimeSecond = 0;

    logTimeArr = logTime.split(':');
    logTimeSecond = parseInt((logTimeArr[0] * 3600) + (logTimeArr[1] * 60) + logTimeArr[0]);
    if (totalSecondCurrentTime < logTimeSecond) {
      throw new Error("Chưa tới lúc log giờ");
    }
  },
  "stop-chieu": (loggedData, logTime = '18:55:00') => {
    let currentDate = new Date().toLocaleDateString("vi-VN");
    if (loggedData && loggedData[currentDate] && loggedData[currentDate]['stop-chieu']) {
      throw new Error("Đã stop log chiều");
    }
    if (!logTime) {
      logTime = '18:55:00';
    }
    let currentTime = new Date().toLocaleTimeString('vi-VN')
        currentTimeArr =  currentTime.split(':'),
        totalSecondCurrentTime = parseInt((currentTimeArr[0] * 3600) + (currentTimeArr[1] * 60) + currentTimeArr[0]),
        logTimeSecond = 0;

    logTimeArr = logTime.split(':');
    logTimeSecond = parseInt((logTimeArr[0] * 3600) + (logTimeArr[1] * 60) + logTimeArr[0]);
    if (totalSecondCurrentTime < logTimeSecond) {
      throw new Error("Chưa tới lúc log giờ");
    }

    if (totalSecondCurrentTime > 19 * 3600) {
      throw new Error("Đã miss thời gian stop log giờ!");
    }
  }
};

function createRunningTaskInterval(intervalTime = 60000) {
  return setInterval(async () => {
    console.log('checking time...');
    let logTimeData = await loadLogTimeData();
    if (!logTimeData?.configs) {
      return false
    }
    
    // DEBUG console.log(logTimeData.configs);
    try {
      Object.entries(configProcessorMappers).forEach(([cnfKey, callback]) => {
        if (logTimeData.configs[cnfKey] === true) {
          callback(logTimeData.logged, logTimeData.configs[cnfKey + '-time']); 
        }
      });
    } catch(e) {
      return false;
    }
    let listChromeWindows = await getTabsList(),
        count = 0;
    listChromeWindows.forEach(cWindow => {
      cWindow.tabs.every((tab) => {
        let onBssHr = tab.url.match(/(https:\/\/hr\.bssgroup\.vn\/log-gio-lam-viec\.html){1}.*/g);
        if (onBssHr && onBssHr.length > 0) {
          if (count >= 1) {
            chrome.tabs.remove(tab.id, () => {});
          }
          console.log('run '+ tab.id);
          count++;
          activeTab = tab;
        }
        return true;
      });
  
      console.log('count: ' + count);
      if (count === 0) {
        chrome.tabs.create({'url': `https://hr.bssgroup.vn/log-gio-lam-viec.html?autolog=1`}, function(tab) {
          chrome.tabs.update(tab.id, { active: true });
          activeTab = tab;
        });
        count++;
      } else if (activeTab.active === false) {
        chrome.tabs.update(activeTab.id, { active: true });
      }
    });
    }, intervalTime);
}

function getTabsList(showOnlyCurrentWindow = false) {
  return new Promise(resolve => {
    if (showOnlyCurrentWindow) {
      chrome.windows.getCurrent({ populate: true }, window => {
        const queryinfo = {
          currentWindow: true,
        };

        chrome.tabs.query(queryinfo, tabs => {
          resolve(tabs);
        })
      });  
    } else {
      chrome.windows.getAll({ populate: true }, listOfWindows => {
        resolve(listOfWindows);
      });
    }
  });
}

chrome.runtime.onMessage.addListener((rq, sender, sendResponse) => {
  if (rq.hasOwnProperty('fetch-app-data')) {
    loadLogTimeData().then( resp => sendResponse({data: resp}));
    return true;
  }
  if (rq.hasOwnProperty('save-config')) {
    saveConfig(rq['save-config']).then(res => {
      sendResponse({type: 'success', message: "Lưu config thành công!!!"});
    });
    return true;
  }

  if (rq.hasOwnProperty('running')) {
    loadLogTimeData().then(currentData => {
      currentData.running = rq.running;
      chrome.storage.sync.set({'logTimeData': currentData})
      .then(res => {
        if (rq.running === true) {
          runningTask = createRunningTaskInterval(60000);
        } else {
          clearInterval(runningTask);
        }
        sendResponse({type: 'success', message: rq.running ? "Started Script!!!": "Stop Script!!!"})
      });
    });
    return true;
  }

  if (rq.hasOwnProperty('fetch-config')) {
    loadLogTimeData().then(logTimeData => sendResponse({config: logTimeData.configs}));
    return true;
  }

  if (rq.hasOwnProperty('get-tabs')) {
    sendResponse({tabs: [{id: 123}]});
    return;
  }

  if (rq.hasOwnProperty('log-time')) {
    let currentDate = new Date().toLocaleDateString("vi-VN");
    let currentTime = new Date().toLocaleTimeString('vi-VN');
    let sangBreakPoint = 12 * 3600; // 12h trưa quy ra giây
    let chieuBreakPoint = (13 * 3600) + (15 * 60); // 13h 15p chieu
    let toiBreakPoint = (19 * 3600); // 19h toi
    let currentTimeArr =  currentTime.split(':');
    let time,
        totalSecondCurrentTime = parseInt((currentTimeArr[0] * 3600) + (currentTimeArr[1] * 60) + currentTimeArr[0]);
    if (totalSecondCurrentTime < sangBreakPoint) {
      time = 'log-sang';
    } else if (totalSecondCurrentTime < chieuBreakPoint) {
      time = 'log-chieu';
    } else if (totalSecondCurrentTime < toiBreakPoint) {
      time = 'stop-chieu';
    }
    if (time) {
      loadLogTimeData().then(data => {
        data.logged[currentDate] = {};
        data.logged[currentDate][time] = totalSecondCurrentTime;
        chrome.storage.sync.set({'logTimeData': data}).then(resp => {
          chrome.tabs.remove(activeTab.id, () => sendResponse({type: 'success', message: "Done!"}));
        });
      })
    }
  }
});

async function saveConfig (configs) {
  let currentData = await loadLogTimeData();
  currentData.configs = configs;
  await chrome.storage.sync.set({'logTimeData': currentData});
}

async function loadLogTimeData() {
  let result = await chrome.storage.sync.get(['logTimeData']);
  return result.logTimeData || {};
}

function addSong(data) {
  var songs = getSongs();
  songs.push(data);
  localStorage.songs = JSON.stringify(songs)
}

function getSongs() {
  if (!localStorage.songs) {
      localStorage.songs = JSON.stringify([]);
  }

  return JSON.parse(localStorage.songs);
}