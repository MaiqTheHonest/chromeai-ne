// 네?
// IIFE change to main later?

let haltParser = false;
let language = null;


(async () => {
  console.log("main run")
  const toggleStatus = await chrome.storage.local.get('enabled') // not sure why local storage is under promise but mkay
  if (!toggleStatus.enabled) return // i.e. do nothing for this run
  
  const timeState = await chrome.storage.local.get('timeState');
  let [lastLearningRate, t] = [(timeState.timeState.learningRate || 1), (timeState.timeState.t || 0)];
  const alpha = 0.5;
  lastLearningRate = lastLearningRate * (1 / (1 + t*alpha))
  t += 1;
  // console.log("t: ", t); // debug
  chrome.storage.local.set({'timeState': {learningRate: lastLearningRate, t: t}})
  window.turndownService = new TurndownService();
  
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

  preparePage(model, detector, lastLearningRate);
  
})();



async function preparePage(model, detector, lastLearningRate) {
  
  const selectors = [
    'main',
    'article',
    '.article-body',
    '.article-content',
    '.article-text',
    '.main',
    '#main',
    'post',
    '.post',
    '#post',
    '.post-content',
    '.story-content',
    '.content',
    '#content',
    'article-body__content',
    'body'
  ]

  let allArticles = null;

  for (const sel of selectors) {
    const results = document.querySelectorAll(sel);
    if (results.length > 0) {
      allArticles = results;
      break;
    }
  }

  let languageGuessCounts = {"en": 1}; // defaults to english if not guesses

  // debug
  console.log("Located main text body: ", allArticles);
  if (!allArticles) return; // quit if nothing processable found on page

  for (article of allArticles) {

    let textBlocks = getTextBlocks(article); // get smaller blocks within + divs longer than x chars
    for (block of textBlocks){
      //debug
      // console.log(block.innerText)
    }
    
    let groupedTextBlocks = groupTextBlocks(textBlocks, minChars=700);
    
    language = document.documentElement.lang;
    if (!language){
      // guess the language
      for (let group of groupedTextBlocks){
        if (group[0].innerText.length > 100) {
          const language = await determineLanguage(group, detector);
          languageGuessCounts[language] = (languageGuessCounts[language] || 0) + 1;
          console.log("language of this block is: ", language); // debug
        }
      };
        // find most common language guess
      let maxVal = -1;
      for (const [key, value] of Object.entries(languageGuessCounts)) {
        if (value > maxVal) {
          maxVal = value;
          language = key;
        }
      };
      console.log("Page language: ", language); // debug
    }
    chrome.storage.local.set({"currentPageLanguage": language}); // to communicate with popup.js

    const data = await chrome.storage.local.get("exclusions");
    let exclusions = data.exclusions || []; // default to no exclusions
    if (exclusions.includes(language)) return;

    const result = await chrome.storage.local.get("levels");
    let storedLevels = result.levels || {}; // default to no levels
    let level = storedLevels[language] || 2.5; // default to medium level
    level = getCEFR(level);

    for (let group of groupedTextBlocks) {
      addGroupFrame(group, language, level, lastLearningRate)
    };  
  };


};



async function determineLanguage(group, detector){
  const results = await detector.detect(group[0].innerText)
  return results[0].detectedLanguage
}



function getTextBlocks(article){
  const candidates = article.querySelectorAll('p, div, li, ul, dl, ol, h1, h2, h3, section, [data-component*="text"], [class*="text"], [class*="para"], [class*="body"]');
  let candidatesArray = Array.from(candidates);

  // keep elements with own (non-child) text, paragraphs, or lists
  candidatesArray = candidatesArray.filter(el => {
    if (getTopLevelText(el).length >= 20 || el.innerText.length > 20 || isList(el)) {return true;} 
    else {
      // console.log("removed element: ", el); // debug
      return false;
    }
  });
  // keep only the lowest-level text elements (drop elements containing already selected text elements)
  candidatesArray = candidatesArray.filter(el => !candidatesArray.some(p => p !== el 
    && el.contains(p) 
    && getTopLevelText(el).length < 20));
  // keep only the text nodes that are not part of selected lists (i.e. keep only standalone text nodes)
  // candidatesArray = candidatesArray.filter(el => !candidatesArray.some(p => p !== el && p.contains(el) && !isList(p)));

  const textBlocks = candidatesArray.filter(el => {

    if (el.querySelector('img, video, figure, iframe, svg, audio, source, embed, object')) return false // is not text
    
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || 
      style.visibility === 'hidden' ||
      style.opacity === "0" ||
      style.clipPath !== "none") return false; // invisible


    const text = el.textContent?.trim() || ' ';
    const html = el.innerHTML.trim() || '';

    if (el.tagName.toLowerCase() === 'span') return false; // is a navigation bar button
    if (text.length < 20) return false; // too short
    if (text.split(' ').length < 3) return false; // not enough words
    if (text.length / html.length < 0.2) return false; // is mostly markup / meta / hyperlink
    return true;
    
  });
  // textBlocks.forEach(block => console.log(block)); // debug
  return textBlocks
}



function groupTextBlocks(textBlocks, minChars) {
  const groups = [];
  let currentGroup = [];
  let currentSumChars = 0;

  textBlocks.forEach((block, idx) => {
    const length = block.innerText.length;
    currentGroup.push(block);
    currentSumChars += length;

    if (currentSumChars >= minChars || block.nextElementSibling !== textBlocks[idx+1]) {
      groups.push(currentGroup);
      currentGroup = [];
      currentSumChars = 0;
    }
  });
  // merge last group with 2nd to last if its smaller than minChars
  if (currentGroup.length > 0) {
    if (groups.length > 0) {
      const leftoverSumChars = currentGroup.reduce((sum, el) => sum + el.innerText.length, 0);
      if (leftoverSumChars < minChars) {
        groups[groups.length - 1].push(...currentGroup);
      } else {
        groups.push(currentGroup);
      }
    } else {
      groups.push(currentGroup);
    }
  }
  return groups
}



function addGroupFrame(group, language, level, lastLearningRate){

  const wrapper = document.createElement('div');
  wrapper.className = 'group-frame';
  wrapper.style.position = 'relative';
  
  const topMostBlock = group[0];
  // do not create frame if any parent already has a frame (to avoid frame nesting)
  if (topMostBlock.closest(".group-frame")) return;
  
  // console.log(topMostBlock) // debug

  topMostBlock.parentNode?.insertBefore(wrapper, topMostBlock);


  group.forEach(block => {
    wrapper.appendChild(block);
    wrapper.style.minHeight = wrapper.offsetHeight + "px"; // prevent frame shrinking
  });

  const btn = document.createElement('button');
  btn.className = 'group-btn';
  topMostBlock.insertAdjacentElement('beforebegin', btn);

  // add inner span
  const symbol = document.createElement("span");
  btn.appendChild(symbol);
  symbol.textContent = "네?";
  

  // store original text content in case it needs to be reverted to
  let originalBlocks = group.map(b => b.textContent);
  
  btn.addEventListener('click', async (e) => {
    haltParser = true;
    e.stopPropagation(); // prevent link clicking
    e.preventDefault();
    
    btn.classList.toggle('reverter')
    console.log("prompt button clicked") // debug
    
    if (!btn.classList.contains('reverter')){
      symbol.textContent = "네?";
      symbol.classList.remove("spinning");
      group.forEach((block, idx) => block.textContent = originalBlocks[idx]);
      removeRatingButtons(wrapper);
      
    } else {
      symbol.textContent = "↺";
      symbol.classList.add("spinning");

      //dispatch promp processing for the whole group, with streaming
      const interrupted = await promptByGroup(group, language, level);
      if (!interrupted) {
        addRatingButtons(wrapper, group, language, level, lastLearningRate);
      };
      symbol.classList.remove("spinning");
    };
  });
}



async function promptByGroup(group, language, level){
  
  haltParser = false;
  const availability = await LanguageModel.availability();
  if (availability==='available'){
    const session = await LanguageModel.create({outputlanguage: language})
    console.log("model created"); // debug

    
    for (block of group){
      // console.log("current block is: ", block) // debug
      if (haltParser) return true; // i.e. return that user manually interrupted adaptation
      let promptText = block.innerHTML;
      promptText = window.turndownService.turndown(promptText);
      console.log("prompt is: ", promptText) // debug

      let response = await session.promptStreaming(`
        The following text is written in the language with language code "${language}".

        Rewrite it in the same language so that a language learner at level ${level.fraction} 
        (on a scale where 0 means ${level.lower} and 1 means ${level.upper}) 
        could fully understand it.

        Important:
        - If a sentence is a question, you **must** keep it a question. Do **not** answer it. Do **not** give definitions of any concepts.
        - Do **not** answer the following question.
        - Do **not** change the factual meaning, claims, or relationships in the text.
        - You may only simplify **vocabulary**, **sentence structure**, or **grammar** — never the content itself.
        - Keep all information, details, and tone identical in meaning.
        - If a concept is too complex, **rephrase** it in simpler words instead of removing or changing it.
        - Preserve all quotes exactly as written.
        - Maintain the same formatting, punctuation, and approximate length.
        - Avoid unnecessary repetition.

        Respond with **only** the rewritten text - no explanations or comments.

        Here is the text to adapt:
        ${promptText}
        `)
        
        const renderer = smd.default_renderer(block);
        const parser = smd.parser(renderer);
        console.log("parser initialized"); // debug
        let firstChunk = true;
        for await (const chunk of response) {
          if (firstChunk) {  
            firstChunk = false;  
            block.innerHTML = '';
          };
          if (haltParser) {
            smd.parser_end(parser);
            // removeRatingButtons(block.parentNode);
            return true;
          };
          smd.parser_write(parser, chunk)
          
        
      };
      // end of streaming
      smd.parser_end(parser);
      console.log("innertext response is:\n", block.innerText);
    }
  }
  return false;
}



function getTopLevelText(el) {
  let text = "";
  el.childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE || ["i", "b", "s"].includes(node.tagName?.toLowerCase())) {
      text += node.textContent.trim() + " ";
    }
  });
  return text.trim();
}



async function addRatingButtons(wrapper, group, language, level, lastLearningRate){
  wrapper.style.height = wrapper.offsetHeight + 28 + "px"
  const easyRateBtn = document.createElement('button');
  easyRateBtn.className = 'easy-rate-button rate-button';
  easyRateBtn.textContent = 'Easy';
  wrapper.lastChild.insertAdjacentElement('afterend', easyRateBtn);

  const hardRateBtn = document.createElement('button');
  hardRateBtn.className = 'hard-rate-button rate-button';
  hardRateBtn.textContent = 'Hard';
  wrapper.lastChild.insertAdjacentElement('afterend', hardRateBtn);

  hardRateBtn.addEventListener('click', async () => {
    updateLocalLevelBy(points=-5, language=language, lastLearningRate);
    const adjustedLevel = {
      lower: Math.max(level.lower - 1, 0),
      upper: Math.max(level.upper - 1, 0),
      fraction: level.fraction
    };

    const floater = document.createElement("div");
    floater.className = "animated-text";
    floater.style.color = "#fd6666";
    floater.textContent = "Try again";
    hardRateBtn.appendChild(floater)
    easyRateBtn.classList.add("fade-out");
    hardRateBtn.classList.add("fade-out");
    setTimeout(async () => {
      await promptByGroup(group, language, adjustedLevel)
      removeRatingButtons(wrapper)
      addRatingButtons(wrapper, group, language, level);
    }, 750);
  }
  )

  easyRateBtn.addEventListener('click', () => {
    updateLocalLevelBy(points=5, language=language, lastLearningRate);
    const floater = document.createElement("div");
    floater.className = "animated-text";
    floater.style.color = "#269f5c"
    floater.textContent = `+${Math.round(Math.log(wrapper.innerText.length))} points!`;
    easyRateBtn.appendChild(floater);
    easyRateBtn.classList.add("fade-out");
    hardRateBtn.classList.add("fade-out");
    setTimeout(() => {
      removeRatingButtons(wrapper)
    }, 750);
  });
}



function removeRatingButtons(wrapper){
  wrapper.style.height = '';
  wrapper.querySelectorAll('.easy-rate-button, .hard-rate-button')
    .forEach(btn => btn.remove());
}



function getCEFR(level){
  let lower = Math.floor(level);
  let upper = Math.ceil(level);
  const fraction = level - lower;

  const CEFR = {1: "A1", 2: "A2", 3: "B1", 4: "B2", 5: "C1", 6: "C2"};
  lower = CEFR[lower]
  upper = CEFR[upper]

  return { lower, upper, fraction };
}



async function updateLocalLevelBy(points, language, lastLearningRate){

  // update language level
  chrome.storage.local.get("levels", (data) => {
    const storedLevels = data.levels || {};
    let currentLevel = storedLevels[language] || 2.5;
    const newLevel = currentLevel + lastLearningRate*points/100;
    storedLevels[language] = newLevel;
    chrome.storage.local.set({"levels": storedLevels});
    console.log("changed language level by: ", newLevel-currentLevel); // debug
  });

  // update points history
  const today = getTodayDate();
  chrome.storage.local.get(["pointsByDay"], (data) => {
    const pointsByDay = data.pointsByDay || {};
    pointsByDay[today] = (pointsByDay[today] || 0) + points;
    chrome.storage.local.set({ pointsByDay });
    console.log("points earned today: ", pointsByDay[today]); // debug
  });

}




// abstract helper functions
function getTodayDate() {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}



function isList(node){
  return ["li", "ul", "dl", "ol"].includes(node.tagName.toLowerCase())
}



function unitTest(){
  console.log('test')
}
