// const { plugins } = require("chart.js");

const toggle = document.getElementById('main-toggle');

chrome.storage.local.get('enabled', data => {
  toggle.checked = !!data.enabled; // force to boolean
});

// fires when toggled
toggle.addEventListener('change', () => {
  const enabled = toggle.checked;
  console.log('Toggled to:', enabled);
  chrome.storage.local.set({ enabled });
});



const ctx = document.getElementById('myChart');

new Chart(ctx, {
  type: 'bar',
  data: {
    labels: ['Red', 'Blue', 'Yellow', 'Green', 'Purple', 'Orange'],
    datasets: [{
      label: '# of Votes',
      data: [12, 19, 3, 5, 2, 3],
      borderWidth: 1
    }]
  },
  options: {
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true
      }
    }
  }
});

















// document.getElementById("main-toggle").addEventListener("click", async () => {

//   const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
//   // send message to content script
//   chrome.tabs.sendMessage(tab.id, { type: "INIT_NE" });
// });