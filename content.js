// IIFE change to main later?
(async () => {
  console.log("main run")
  const session = await LanguageModel.create({outputlanguage: "en"});
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "REWRITE_TEXT") {
      rewriteText(session);
    }
  });
})();



async function rewriteText(session) {

    // const paragraph = document.querySelector("p");

    let mainText = document.querySelector('article') 
               || document.querySelector('.article-body')
               || document.querySelector('.article-content')
               || document.querySelector('.article-text')
               || document.querySelector('main')
               || document.querySelector('#main')
               || document.querySelector('.post')
               || document.querySelector('#post')
               || document.querySelector('.post-content')
               || document.querySelector('.story-content')
               || document.querySelector('.content')
               || document.querySelector('#content')
               || document.querySelector('.article-body__content')
               || document.querySelector('.article-body__content');
    
    const unwantedSelectors = ['visually-hidden', 'author', 'header', '.ad', '.meta',
       '.advertisement', '.promo', '.sidebar', '.related-links', 'iframe', 'script'];
    
    unwantedSelectors.forEach(sel => {
        mainText.querySelectorAll(sel).forEach(el => el.remove());
    });

    let allParagraphs = mainText.querySelectorAll('p:not(:has(span))')

    allParagraphs.forEach(p => {
      if (p.innerText.trim().length <= 30) {
        p.remove();
      }
    });




    let textBlocks = Array.from(allParagraphs);
    console.log(textBlocks[0]);

    if (textBlocks[0]) {
        const firstParagraph = textBlocks[0].innerText.trim();
        console.log("Article text:\n", firstParagraph);
        const rephrased = await session.prompt(`Translate this article to German and rephrase it so that a language student of level\n`
           + `A1 will understand it, respond with just the final text, do not add any formatting: ${firstParagraph}`, 
        );
        textBlocks[0].innerText = rephrased;
        console.log("rephrased text:\n", rephrased)
    } else {
        console.log("Couldnt find text");
    }

};

