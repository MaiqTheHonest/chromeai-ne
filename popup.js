
(async () => {
  
  const mainToggle = document.getElementById('main-toggle');
  
  // extension mainToggle 
  chrome.storage.local.get('enabled', data => {
    mainToggle.checked = !!data.enabled; // force to boolean
  });
  // fires when toggled
  mainToggle.addEventListener('change', async() => {
    const enabled = mainToggle.checked;
    console.log('Toggled to:', enabled);
    chrome.storage.local.set({ enabled });
    const availability = await LanguageModel.availability();
    if (availability === "unavailable" || availability === "downloadable"){
      console.log("Extension (Ne?) requires Gemini Nano to be installed.")
      let input = prompt("Would you like to install Gemini Nano on your device? (y/n)")
      if (["y", "yes", "ye", ""].includes(input)){
        
        let model = await LanguageModel.create({outputlanguage:"en",
          monitor(m) {
            m.addEventListener('downloadprogress', (e) => {
              console.log(`Downloaded ${e.loaded * 100}%`);
            });
          },
        });
        
        let detector = await LanguageDetector.create({
          monitor(m) {
            m.addEventListener('downloadprogress', (e) => {
              console.log(`Downloaded ${e.loaded * 100}%`);
            });
          },
        });
      } else {
        console.log("installation refused");
        return;
      }
    }
  });
  
  
  const secondSwitch = document.getElementById("exclude-switch");
  const excludeToggle = secondSwitch.querySelector("input");
  const excludeText = secondSwitch.querySelector("p");
  const exclusionsNode = document.getElementById("exclusions").querySelector("p");
  const levelsNode = document.getElementById("levels").querySelector("p");

  chrome.storage.local.get(['exclusions', 'currentPageLanguage'], ({ exclusions = [], currentPageLanguage }) => {
    if (!currentPageLanguage) {
      console.log("no lang found");
      return
    };
    excludeToggle.checked = exclusions.includes(currentPageLanguage);

    excludeToggle.addEventListener('change', () => {
      let updatedExclusions = [...exclusions];

      // if toggled ON
      if (excludeToggle.checked) {
        if (!updatedExclusions.includes(currentPageLanguage)) {
          updatedExclusions.push(currentPageLanguage);
        }
      } else { // if toggled OFF
        updatedExclusions = updatedExclusions.filter(lang => lang !== currentPageLanguage);
      }
      // store exclusions back
      chrome.storage.local.set({ exclusions: updatedExclusions }, () => {
        console.log('Exclusions updated:', updatedExclusions);
      });
      exclusions = updatedExclusions;
    });
    excludeText.textContent = `Do not adapt this page's language (${currentPageLanguage}): `;
    exclusionsNode.textContent = `Excluded languages:  [${exclusions}]`
  });
  
  chrome.storage.local.get("levels", (data) => {
  const levels = data.levels || {};

  levelsNode.textContent = `Your languages: [${Object.keys(levels).join(', ')}]`
  });
  
  // chart
  const today = new Date().getDay() - 1;
  async function loadPoints() {
    const { pointsByDay = {} } = await chrome.storage.local.get("pointsByDay");
    return pointsByDay
  };
  const pointsByDay = await loadPoints();
  const dow = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  // console.log(pointsByDay);
  // const points = Object.values(pointsByDay);
  const points = [25, 20, 47, 65, 34, 72, 80, 62]
  const currentStreak = calculateStreak(points);

  const nZ = Math.max(...points) * 0.01; // value that should be zero but looks nicer if its about 1% of the tallest bar

  const streakNode = document.getElementById("streak")
  let suffix = "";
  let pluralSuffix = "";
  if (currentStreak !== 1){
    pluralSuffix = "s"
  };

  if (currentStreak > 0) suffix = "\u{1F525}";
  streakNode.textContent = ` current streak:  ${currentStreak} day${pluralSuffix} ${suffix}`;
  const barColor1 = "#63c991ff";
  const barColor2 = "#ffa040be";

  const ctx = document.getElementById('myChart');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: [dow.at(today-6), dow.at(today-5), dow.at(today-4), dow.at(today-3), dow.at(today-2), dow.at(today-1), dow.at(today)],
      datasets: [{
        data: [points.at(-7) || nZ, points.at(-6) || nZ, 
          points.at(-5) || nZ, points.at(-4) || nZ, points.at(-3) || nZ, points.at(-2) || nZ, points.at(-1) || nZ, nZ],
        borderWidth: 1,
        backgroundColor: [barColor1, barColor1, barColor1, barColor1, barColor1, barColor1, "#ffa040be"]
      }]
    },
    options: {
      plugins: {
        legend: {
            display: false,
        },
        title: {
          text: "      points earned",
          align: 'center',
          padding: 4,
          display: true,
          color: "#949494ff"
        },
      },
      maintainAspectRatio: false,
      events: ['mousemove', 'mouseout', 'click', 'touchstart', 'touchmove'],
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
})();







function calculateStreak(points){
  let count = 0;
  const reversed = points.slice().reverse();
  for (number of reversed){
    if (number === 0) break;
    count += 1 
    }
  return count
}










// document.getElementById("main-mainToggle").addEventListener("click", async () => {

//   const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
//   // send message to content script
//   chrome.tabs.sendMessage(tab.id, { type: "INIT_NE" });
// });