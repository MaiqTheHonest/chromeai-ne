// 네?
// IIFE change to main later?

(async () => {
  console.log("main run")
  const toggleStatus = await chrome.storage.local.get('enabled') // not sure why it takes time to access local storage but mkay
  if (!toggleStatus.enabled) return // i.e. do nothing for this run
  
  window.turndownService = new TurndownService();
  unitTest(); // debug
  
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
  
  preparePage(model, detector);

})();



async function preparePage(model, detector) {
  
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

  let languageGuessCounts = {"en": 1};

  // debug
  // console.log("Located main text body: ", allArticles);
  if (!allArticles) return; // quit if nothing processable found on page


  for (article of allArticles) {

    let textBlocks = getTextBlocks(article); // get smaller blocks within + divs longer than x chars
    for (block of textBlocks){
      //debug
      // console.log(block.innerText)
    }
    
    let groupedTextBlocks = groupTextBlocks(textBlocks, minChars=700);
    
    for (let group of groupedTextBlocks){
      if (group[0].innerText.length > 100) {
        const language = await determineLanguage(group, detector);
        languageGuessCounts[language] = (languageGuessCounts[language] || 0) + 1;
        console.log("language of this block is: ", language); // debug
      }
      addGroupFrame(group)
    };  
  };

  // find most common longuage guess and set it as current page's language
  let maxKey = null;
  let maxVal = -1;
  for (const [key, value] of Object.entries(languageGuessCounts)) {
    if (value > maxVal) {
      maxVal = value;
      maxKey = key;
    }
  };
  console.log("Page language: ", maxKey); // debug

};



async function determineLanguage(group, detector){
  const results = await detector.detect(group[0].innerText)
  return results[0].detectedLanguage
}



function isList(node){
  return ["li", "ul", "dl", "ol"].includes(node.tagName.toLowerCase())
}



function getTextBlocks(article){
  const candidates = article.querySelectorAll('p, div, li, ul, dl, ol, h1, h2, h3, section, [data-component*="text"], [class*="text"], [class*="para"], [class*="body"]');
  let candidatesArray = Array.from(candidates);

  // keep elements with own (non-child) text, paragraphs, or lists
  candidatesArray = candidatesArray.filter(el => {
    if (getTopLevelText(el).length >= 20 || el.innerText.length > 20 || isList(el)) {return true;} 
    else {
      console.log("removed element: ", el);
      return false;
    }
  });
  // keep only the lowest-level text elements (drop elements containing already selected text elements)
  candidatesArray = candidatesArray.filter(el => !candidatesArray.some(p => p !== el && el.contains(p) && getTopLevelText(el).length < 20));
  // keep only the text nodes that are not part of selected lists (i.e. keep only standalone text nodes)
  // candidatesArray = candidatesArray.filter(el => !candidatesArray.some(p => p !== el && p.contains(el) && !isList(p)));

  const textBlocks = candidatesArray.filter(el => {

    if (el.querySelector('img, video, figure, iframe, svg, audio, source, embed, object')) return false // is not text
    
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || 
      style.visibility === 'hidden' ||
      style.opacity === "0" ||
      style.clip !== "auto" ||
      style.clipPath !== "none") return false; // invisible


    const text = el.textContent?.trim() || ' ';
    const html = el.innerHTML.trim() || '';

    if (el.tagName.toLowerCase() === 'span') return false; // is a navigation bar button
    if (text.length < 20) return false; // too short
    if (text.split(' ').length < 3) return false; // not enough words
    if (text.length / html.length < 0.2) return false; // is mostly markup / meta / hyperlink
    // console.log(`UNFILTERED ELEMENT: \n${el.outerHTML}\nfull text = ${el.innerText}\nlinkText.length = ${linkText.length}\ntext.length = ${text.length}`) // debug
    return true;
    
  });
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



function addGroupFrame(group){

  const wrapper = document.createElement('div');
  wrapper.className = 'group-frame';
  wrapper.style.position = 'relative';
  
  const topMostBlock = group[0];
  
  // do not create frame if any parent already has a frame (to avoid frame nesting)
  if (topMostBlock.closest(".group-frame")) return;
  
  topMostBlock.parentNode?.insertBefore(wrapper, topMostBlock);
  group.forEach(block => {
    wrapper.appendChild(block);
    wrapper.style.minHeight = wrapper.offsetHeight + "px"; // prevent frame shrinking
  });

  // const rect = topMostBlock.getBoundingClientRect();
  const btn = document.createElement('button');
  btn.className = 'group-btn';

  btn.textContent = '네?';

  topMostBlock.insertAdjacentElement('beforebegin', btn);
  console.log("buttons added") // debug

  // store original text content in case it needs to be reverted to
  let originalBlocks = group.map(b => b.textContent);

  btn.addEventListener('click', async () => {
    
    btn.classList.toggle('reverter')
    console.log("prompt button clicked") // debug

    if (!btn.classList.contains('reverter')){
      btn.textContent = "네?";
      group.forEach((block, idx) => block.textContent = originalBlocks[idx]);
      removeRatingButtons(wrapper);

    } else {
      btn.textContent = "↺";
      //dispatch promp processing for the whole group, with streaming
      await promptByGroup(group);
      addRatingButtons(wrapper, group);
    }

  });
}



async function promptByGroup(group){
  
  const availability = await LanguageModel.availability();
  if (availability==='available'){
    const session = await LanguageModel.create({outputlanguage: "en"})
    for (block of group){
      console.log("current block is: ", block)
      let promptText = block.innerHTML;
      promptText = window.turndownService.turndown(promptText);
      console.log("prompt is: ", promptText) // debug
      let response = await session.promptStreaming(`Translate this paragraph into Spanish.` + 
        `Keep source formatting and punctuation as is. Respond with just the translation: ${promptText}`)
        
        
        const renderer = smd.default_renderer(block);
        const parser = smd.parser(renderer);
        
        let firstChunk = true;
        for await (const chunk of response) {
          if (firstChunk) {  
            firstChunk = false;  
            block.innerHTML = '';
          };
          smd.parser_write(parser, chunk)
        
      };
      // end of streaming
      smd.parser_end(parser);
      console.log("innertext response is:\n", block.innerText);
    }
  }
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



function addRatingButtons(wrapper, group){
  wrapper.style.height = wrapper.offsetHeight + 28 + "px"
  const easyRateBtn = document.createElement('button');
  easyRateBtn.className = 'easy-rate-button rate-button';
  easyRateBtn.textContent = 'Easy';
  group[group.length - 1].insertAdjacentElement('afterend', easyRateBtn);
  
  const hardRateBtn = document.createElement('button');
  hardRateBtn.className = 'hard-rate-button rate-button';
  hardRateBtn.textContent = 'Hard';
  group[group.length - 1].insertAdjacentElement('afterend', hardRateBtn);

}



function removeRatingButtons(wrapper){
  wrapper.style.height = '';
  wrapper.querySelectorAll('.easy-rate-button, .hard-rate-button')
    .forEach(btn => btn.remove());
}



function unitTest(){
  console.log('test')
}
