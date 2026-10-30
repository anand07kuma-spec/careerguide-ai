/**
 * Hindi for the Reports screen: the summary a student generates from their own
 * conversations, the caveats printed under it, and the generate / delete controls.
 *
 * Keys are the English source text, so an untranslated string still renders — in
 * English — instead of vanishing from a child's screen.
 *
 * The section headings, the framing sentence, the two modal titles and the two
 * toasts belong to `plans-journey.ts`, and `Print / Save PDF`, `Delete`, `Cancel`,
 * `conversations` and the three language names belong to `assessments.ts`,
 * `admin.ts`, `common.ts` and `dashboard.ts`. They are routed through `t()` on the
 * screen and deliberately not redefined here — one key, one owner.
 */

export const HI: Record<string, string> = {
  // The badge over the document and the row of buttons beside the title.
  "Exploratory document": "खोजने के लिए बना दस्तावेज़",
  "Fresh report": "नई रिपोर्ट",
  "Explore interests": "अपनी रुचियाँ जानें",
  "Generate my report": "मेरी रिपोर्ट बनाएँ",

  // The two confirm dialogs' buttons and body copy. `Generate a fresh report?` and
  // `Delete this report?` are the titles, owned by `plans-journey.ts`.
  "Keep current": "पुरानी रिपोर्ट रहने दें",
  "Generate fresh report": "नई रिपोर्ट बनाएँ",
  "Delete report": "रिपोर्ट हटाएँ",
  "Your current report stays until the new one is ready. If the new one is empty, you can simply explore more and generate again later.":
    "आपकी मौजूदा रिपोर्ट तब तक बनी रहेगी जब तक नई तैयार नहीं हो जाती। नई अगर ख़ाली बनी तो बस थोड़ा और खोजें, और बाद में दोबारा बना लें।",
  "You can always generate a new report later. Nothing else you have saved is affected.":
    "आप कभी भी बाद में नई रिपोर्ट बना सकते हैं। बाकी जो कुछ आपने सेव किया है, वह वैसा ही रहेगा।",

  // The line naming whose report this is. `Prepared for` and `Generated` are captions
  // sitting in front of a value — the student's name and the timestamp — so they stay
  // two words and take no verb of their own. The language name after the last `·`
  // comes from `languageLabel()`, which returns `English` / `Hindi` / `Hinglish`, and
  // those three keys live in `common.ts`.
  "Prepared for": "इनके लिए तैयार:",
  "this student": "यह विद्यार्थी",
  "Generated": "बनाई गई:",

  // Inside each recommendation. Only these headings are the app's words; the career
  // name, the reason, the quotes and the bullets underneath are the server's answer
  // and are printed exactly as they arrive.
  "What you said that points here": "आपने जो कहा, उसी से यह क्यों सुझाया गया",
  "Still worth finding out": "अभी जानना बाकी है",
  "Skills to try": "आज़माने लायक स्किल",
  "Qualifications to check": "जाँचने लायक क्वालिफ़िकेशन",
  "Related options to keep open": "जुड़े हुए विकल्प — इन्हें भी खुला रखें",
  "A small next step:": "छोटा अगला कदम:",

  // The empty state of "What we still don't know", whose heading and reassurance are
  // in `plans-journey.ts`. `छूटी हुई बातें` is that file's word for "gaps" — the two
  // lines sit one under the other on screen, so they have to be the same word.
  "There are no specific gaps flagged right now — but plans can always change as you learn more, and that is expected.":
    "अभी इसमें कोई खास बात छूटी हुई नहीं दिखी — लेकिन जैसे-जैसे आपको ज़्यादा पता चलेगा, आपके प्लान बदल सकते हैं, और यह बिल्कुल आम बात है।",

  // One English sentence the screen splits into three fragments around a number, so the
  // Hindi is written to read correctly across those gaps: "अब तक देखी गई 7 बातचीत पर
  // आधारित।" The singular and plural both say `बातचीत` — the plural key is `admin.ts`'s.
  "Based on": "अब तक देखी गई",
  "conversation": "बातचीत",
  "reviewed so far.": "पर आधारित।",

  // The three lines under "What this report cannot do". The block exists to keep three
  // different denials apart — it does not *predict*, it does not *certify*, and no
  // school may read it as an *assessment* — so each Hindi line keeps its own verb and
  // none of them is softened. `आकलन` is the word `assessments.ts` already uses.
  "It does not predict your results, marks or future.":
    "यह आपके नतीजों, अंकों या भविष्य का अनुमान नहीं लगाती।",
  "It does not certify, rank or assess you in any official way.":
    "यह किसी भी आधिकारिक तरीक़े से आपको सर्टिफ़िकेट नहीं देती, रैंक नहीं बताती, न ही आपका आकलन करती।",
  "No school, admission office or employer should treat it as an assessment. It is only a mirror of conversations you chose to have here.":
    "किसी भी स्कूल, दाखिले के दफ़्तर या नौकरी देने वाले को इसे आकलन मानकर नहीं चलना चाहिए। यह तो बस उस बातचीत का आईना है, जिसे आपने यहाँ करने के लिए ख़ुद चुना।",
};
