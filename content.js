
// IIFE change to main later?

(async () => {
  console.log("main run")
  window.turndownService = new TurndownService();
  unitTest(); // debug
  // computeElementTextStyle(document.querySelector('p')); <----------------------------- XXX

  const session = await LanguageModel.create({outputlanguage: "en"});
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "INIT_NE") {
      preparePage(session);
    }
  });
})();



async function preparePage(session) {
  
  const selectors = [
    'main',
    '.main',
    '#main',
    'article',
    '.article-body',
    '.article-content',
    '.article-text',
    'post',
    '.post',
    '#post',
    '.post-content',
    '.story-content',
    '.content',
    '#content',
    'article-body__content'
  ]

  let allArticles = null;

  for (const sel of selectors) {
    const results = document.querySelectorAll(sel);
    if (results.length > 0) {
      allArticles = results;
      break;
    }
  }

  // debug
  // console.log("Located main text body: ", allArticles);

  allArticles.forEach(article => {

    let textBlocks = getTextBlocks(article); // get smaller blocks within + divs longer than x chars
    for (block of textBlocks){
      //debug
      // console.log(block.innerText)
    }

    let groupedTextBlocks = groupTextBlocks(textBlocks, minChars=700);
    
    
    for (let group of groupedTextBlocks){
      addPromptButton(group)
    };
  });
};



function getTextBlocks(article){
  const candidates = article.querySelectorAll('p, div, li, ul, dl, ol, b, section, [data-component*="text"], [class*="text"], [class*="para"], [class*="body"]');
  let candidatesArray = Array.from(candidates);

  // remove parents with too small own (non-child) text
  candidatesArray = candidatesArray.filter(el => getTopLevelText(el).length >= 30);

  // remove children whose parents are already present with own text (to avoid double counting text)
  topLevel = candidatesArray.filter(el => !candidatesArray.some(p => p !== el && p.contains(el)));

  // const topLevel = candidatesArray.filter(el => !candidatesArray.some(other => other !== el && el.contains(other))); <------ XXX

  const textBlocks = topLevel.filter(el => {

    if (el.querySelector('img, video, iframe, svg, audio, source, embed, object')) return false // is not text

    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false; // invisible

    const text = el.innerText?.trim() || '';
    const html = el.innerHTML.trim() || '';
    if (text.length < 30) return false; // too short
    if (text.split(' ').length < 3) return false; // not enough words
    // if (text.length / html.length < 0.2) return false; // is mostly markup / meta
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



function addPromptButton(group){

  const wrapper = document.createElement('div');
  wrapper.className = 'group-frame';
  wrapper.style.position = 'relative';
  const topMostBlock = group[0];
  topMostBlock.parentNode.insertBefore(wrapper, topMostBlock);
  group.forEach(block => wrapper.appendChild(block));

  // const rect = topMostBlock.getBoundingClientRect();
  const btn = document.createElement('button');
  btn.className = 'group-btn';
  btn.textContent = 'go away';

  topMostBlock.insertAdjacentElement('beforebegin', btn);
  console.log("buttons added") // debug

  btn.addEventListener('click', async () => {
    //dispatch promp processing for the whole group here <---------------------------------------
    console.log("prompt button clicked") // debug
    // pasting response back
    const responseGrouped = await promptByGroup(group);
    console.log("Response grouped is:", responseGrouped)
    group.forEach((block, idx) => block.innerHTML = responseGrouped[idx])
  });
}




async function promptByGroup(group){

  let promptText = '';

  // create the final form of prompt/query for the API, with a separator
  group.forEach((block, idx) => {
    const marker = `TTTPARA${idx + 1}TTT`;
    promptText += `${marker}\n${block.innerHTML}\n\n`;
  });

  // convert to markdown to preserve formatting
  promptText = window.turndownService.turndown(promptText);
  console.log("prompt is: ", promptText) // debug

  const availability = await LanguageModel.availability();
  if (availability==='available'){
    const session = await LanguageModel.create({outputlanguage: "en"})
    let response = await session.prompt(`Translate these paragraph(s) into German. Keep the TTTPARAxTTT separator(s) in the same position within the sentence.` + 
      `Keep source formatting. Respond with just the separator(s) and translation(s): ${promptText}`)
      // convert response from markdown to html
    console.log("raw markdown response is: ", response)
    console.log("END")
    response = marked.parse(response, {breaks: true})
    console.log("HTML response is: ", response)
    console.log("END")
    
    if (response){
      let responseGrouped = [];
      for (let idx = 0; idx < group.length; idx+=1) {
        
        const marker = `TTTPARA${idx + 1}TTT`;
        const nextMarker = `TTTPARA${idx + 2}TTT`;
        
        let text = response.split(marker)[1] || ''; // cut off everything before first marker
        text = text.split(nextMarker)[0] || '';        // cut off everything after second marker
        responseGrouped.push(text.trim())
      };
      // console.log("Grouped response is:", responseGrouped); // debug
      return responseGrouped
      }
  }
}


function unitTest(){
  const pureHTML = "**Hellow World**"; 
  const md = marked.parse(pureHTML);
  console.log(md)
}



function getPureParentText(el) {
  let text = "";
  el.childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent.trim() + " ";
    }
  });
  return text.trim();
}




  // const unwantedSelectors = ['visually-hidden', 'author', 'header', '.ad', '.meta',
  //     '.advertisement', '.promo', '.sidebar', '.related-links', 'iframe', 'script'];
  
  // unwantedSelectors.forEach(sel => {
  //     mainText.querySelectorAll(sel).forEach(el => el.remove());
  // });

