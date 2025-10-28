(async () => {
  
  const toggle = document.getElementById('main-toggle');
  
  
  // extension toggle 
  chrome.storage.local.get('enabled', data => {
    toggle.checked = !!data.enabled; // force to boolean
  });
  // fires when toggled
  toggle.addEventListener('change', () => {
    const enabled = toggle.checked;
    console.log('Toggled to:', enabled);
    chrome.storage.local.set({ enabled });
  });
  
  
  
  // chart
  const today = new Date().getDay() - 1;
  async function loadPoints() {
    const { pointsByDay = {} } = await chrome.storage.local.get("pointsByDay");
    return pointsByDay
  };
  const pointsByDay = await loadPoints();
  const dow = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  console.log(pointsByDay);
  // const points = Object.values(pointsByDay);
  const points = [25, 20, 47, 65, 34, 72, 80, 70]
  const currentStreak = calculateStreak(points);

  const nZ = Math.max(...points) * 0.01; // value that should be zero but looks nicer if its about 1% of the tallest bar

  const streakNode = document.getElementById("streak")
  streakNode.textContent = `current streak: ${currentStreak} days`;

  const ctx = document.getElementById('myChart');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: [dow.at(today-6), dow.at(today-5), dow.at(today-4), dow.at(today-3), dow.at(today-2), dow.at(today-1), dow.at(today)],
      datasets: [{
        data: [points.at(-7) || nZ, points.at(-6) || nZ, 
          points.at(-5) || nZ, points.at(-4) || nZ, points.at(-3) || nZ, points.at(-2) || nZ, points.at(-1) || nZ, nZ],
        borderWidth: 1,
        backgroundColor: ["#36a2ebbe", "#36a2ebbe", "#36a3ebbe", "#36a2ebbe", "#36a2ebbe", "#36a2ebbe", "#ffa040be"]
      }]
    },
    options: {
      plugins: {
        legend: {
            display: false,
        }
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
  for (number of points.reverse()){
    if (number === 0) break;
    count += 1 
    }
  return count
}










// document.getElementById("main-toggle").addEventListener("click", async () => {

//   const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
//   // send message to content script
//   chrome.tabs.sendMessage(tab.id, { type: "INIT_NE" });
// });