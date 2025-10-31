# 네? — Language Learning w/ Gemini Nano.

_**Ne? / 네?**_  — is a Chrome Extension that leverages the power of a local Gemini Nano in Chrome to adapt foreign language text to your level of comprehension, no matter if you are a beginner or a near-native level speaker.

<img width="1361" height="735" alt="thumbnail" src="https://github.com/user-attachments/assets/d48ce5ae-3925-4ff1-8842-2699c91e8169" />

## Prerequisites
1. at least 22GB of free space on Chrome's drive.
2. Windows 10/11, Chrome > 128.
3. RAM >= 16 GB.

## Installation
1. Open Chrome.
2. Navigate to `chrome://flags/#optimization-guide-on-device-model` and select `"Enabled BypassPerfRequirement"`.
3. Navigate to `chrome://flags/#prompt-api-for-gemini-nano` and select `Enabled Multilingual`.
4. Relaunch Chrome.
5. Download or clone the repository to a convenient folder.
6. Navigate to Extensions -> Manage Extensions and enable Developer Mode toggle in the top right corner.
7. Click `load unpacked` and select the cloned extension folder.
8. Click the new extension icon in the top right corner and switch On/Off toggle in the extension popup. If a popup prompting you to confirm model download appears, type "y" in the input field.
9. Gemini Nano will start downloading. The progress can be seen in the extension popup's console. Ready to go once downloaded.

## Usage
- To adapt text, click on the 네? glyph in the corner of each flashcard.
- To exclude a certain language from flashcards, open a page in that language and toggle the `Do not translate this page's language toggle`.
- To exclude a certain website from flashcards, open up `manifest.json` in the extension folder and add your website to the "exclude_matches". Reload extension.


<hr />

Chrome Built-In AI Challenge 2025.
