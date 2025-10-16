// IIFE change to main later?
(async () => {
  console.log("main run")
  const session = await LanguageModel.create({outputlanguage: "en"});
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "INIT_NE") {
      preparePage(session);
    }
  });
})();



async function preparePage(session) {

  const selectors = [
    'article',
    '.article-body',
    '.article-content',
    '.article-text',
    'main',
    '.main',
    '#main',
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

  // debugging
  console.log("Located main text body: ", allArticles);

  allArticles.forEach(article => {

    let textBlocks = getTextBlocks(article); // get smaller blocks within + divs longer than x chars
    let groupedTextBlocks = groupTextBlocks(textBlocks, minChars=700);
    
    for (let group of groupedTextBlocks){
      addPromptButton(group)
    };
  });
};



function getTextBlocks(article){
  const candidates = article.querySelectorAll('p, div, section, span, li, [data-component*="text"], [class*="text"], [class*="para"], [class*="body"]');
  const textBlocks = Array.from(candidates).filter(el => {

    // skip invisible
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;

    if (el.tagName.toLowerCase() === "div") {
      const text = el.innerText?.trim() || '';
      if (text.length < 200) return false; // too short
      if (text.split(' ').length < 3) return false; // not enough words
      return true;
    }
    return true;
  });
  return textBlocks
}



function groupTextBlocks(textBlocks, minChars) {
  const groups = [];
  let currentGroup = [];
  let currentSumChars = 0;

  textBlocks.forEach(block => {
    const length = block.innerText.length;
    currentGroup.push(block);
    currentSumChars += length;

    if (currentSumChars >= minChars) {
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

  const topMostBlock = group[0];
  const rect = topMostBlock.getBoundingClientRect();
  const btn = document.createElement('button');

  btn.textContent = 'go away';

  Object.assign(btn.style, {
    position: 'absolute', // position relative to page
    top: `${window.scrollY + rect.top}px`,       // align with top of paragraph
    left: `${rect.right + 10 + window.scrollX}px`, // 10px to the right
    zIndex: 1000,
    padding: '4px 8px',
    fontSize: '12px',
    cursor: 'pointer',
    background: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
  });

  document.body.appendChild(btn);


  btn.addEventListener('click', async () => {
    //dispatch promp processing for the whole group here <---------------------------------------
    console.log("prompt button clicked") // debug
    const responseGrouped = await promptByGroup(group);
    group.forEach((block, idx) => block.innerText = responseGrouped[idx])
  });
}




async function promptByGroup(group){

  let promptText = '';

  // create the final form of prompt/query for the API, with a separator
  group.forEach((block, idx) => {
    const marker = `<<<[[[PARA_${idx + 1}]]]>>>`;
    promptText += `${marker}\n${block.innerText}\n\n`;
  });

  console.log("prompt is: ", promptText) // debug

  const availability = await LanguageModel.availability();
  if (availability==='available'){
    const session = await LanguageModel.create({outputlanguage: "en"})
    const response = await session.prompt(`Translate these unrelated paragraphs into German. Keep the <<<[[[PARA_x]]]>>> separators as they are.` + 
      ` Respond with just the translations and separators between them: ${promptText}`)
    
      if (response){
        let responseGrouped = [];
        for (let idx = 0; idx < group.length; idx+=1) {
          
          const marker = `<<<[[[PARA_${idx + 1}]]]>>>`;
          const nextMarker = `<<<[[[PARA_${idx + 2}]]]>>>`;
          
          let text = response.split(marker)[1] || ''; // cut off everything before first marker
          text = text.split(nextMarker)[0];           // cut off everything after second marker
          responseGrouped.push(text.trim())
        };
        console.log(responseGrouped); // debug
        return responseGrouped
      }
  }
}





  // const unwantedSelectors = ['visually-hidden', 'author', 'header', '.ad', '.meta',
  //     '.advertisement', '.promo', '.sidebar', '.related-links', 'iframe', 'script'];
  
  // unwantedSelectors.forEach(sel => {
  //     mainText.querySelectorAll(sel).forEach(el => el.remove());
  // });

  // let allParagraphs = mainText.querySelectorAll('p:not(:has(span))')

  // allParagraphs.forEach(p => {
  //   if (p.innerText.trim().length <= 30) {
  //     p.remove();
  //   }
  // });




//   let textBlocks = Array.from(allParagraphs);
//   console.log(textBlocks[0]);

//   if (textBlocks[0]) {
//       const firstParagraph = textBlocks[0].innerText.trim();
//       console.log("Article text:\n", firstParagraph);
//       const rephrased = await session.prompt(`Translate this article to German and rephrase it so that a language student of level\n`
//           + `A1 will understand it, respond with just the final text, do not add any formatting: ${firstParagraph}`, 
//       );
//       textBlocks[0].innerText = rephrased;
//       console.log("rephrased text:\n", rephrased)
//   } else {
//       console.log("Couldnt find text");
//   }


