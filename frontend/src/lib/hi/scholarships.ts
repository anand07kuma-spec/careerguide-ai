/**
 * Hindi for the scholarships and financial-guidance screen: the two standing cards
 * around the list — how to tell a real scheme from a forwarded one, and the calmer
 * words about money — plus its filters, its result count, and the small labels a
 * scheme card carries.
 *
 * Two things are deliberately not here.
 *
 * The scheme itself stays English: its name, provider, benefit and eligibility text,
 * application steps, categories, state names and disclaimer come back from the API.
 * That is catalogue content, not interface, and the screen's own heading and its
 * "Sample list — verify first" badge already say the listings must be confirmed on the
 * official portal. The same goes for `list.error`, which is the server's sentence.
 *
 * Shared labels are left where they already stand rather than restated, because the
 * merge in `index.ts` lets one file win: `Search schemes`, `Search scholarships`,
 * `Filter by class level / state / provider type`, `Money shapes which route is
 * possible…` and the rest of that screen's headings are in `catalogue.ts`;
 * `Clear filters`, `Clear search` and `Where you apply` are in `common.ts`, along with
 * the `Class 9`–`Class 12` levels; `Official site` is in `study-abroad.ts`; and the
 * three study levels below class 12 — `Undergraduate`, `Postgraduate`, `Diploma / ITI` —
 * are in `student-tools.ts`, which lists the same levels on the institutes screen. A
 * scheme card and an institute card must say the same word for the same level.
 */
export const HI: Record<string, string> = {
  // ------------------------------------------------ how to check a scheme is real
  "Sample list — verify first": "नमूना लिस्ट — पहले जाँच लें",
  "Open the official government website yourself (for example the National Scholarship Portal) and read the current circular there — not a forwarded screenshot or WhatsApp message.":
    "आधिकारिक सरकारी वेबसाइट ख़ुद खोलें (जैसे नैशनल स्कॉलरशिप पोर्टल) और वहाँ का ताज़ा सर्कुलर पढ़ें — आगे फ़ॉरवर्ड किए गए स्क्रीनशॉट या व्हाट्सएप मैसेज से नहीं।",
  "Ask your school office or college scholarship desk. They handle these applications and can tell you what is genuine.":
    "अपने स्कूल ऑफ़िस या कॉलेज के स्कॉलरशिप डेस्क से पूछें। वे ये आवेदन संभालते हैं और बता सकते हैं कि कौन-सी चीज़ असली है।",
  "Never pay a fee to someone who offers to “apply on your behalf.” Genuine government schemes do not charge agents to submit an application.":
    "जो कोई “आपकी तरफ़ से आवेदन कर दूँगा” कहे, उसे कभी फ़ीस न दें। असली सरकारी योजनाओं में आवेदन जमा कराने के लिए एजेंट को पैसे देने की ज़रूरत नहीं होती।",
  "This list is a starting point only. It is not complete, and details change every academic year.":
    "यह लिस्ट सिर्फ़ एक शुरुआती बिंदु है। यह पूरी नहीं है, और इसकी जानकारी हर शैक्षिक सत्र बदलती रहती है।",

  // ------------------------------------------------------------- filters and results
  // `Select` runs every option label through `t()`, so the three rows below are
  // dictionary strings even though the screen writes them into an option list.
  "All class levels": "सभी कक्षा स्तर",
  "All states / All India": "सभी राज्य / अखिल भारतीय",
  "All providers": "सभी प्रदाता",
  // The count goes inside the sentence rather than being glued to it, so Hindi can put
  // it before the word it counts. One key per number and per filter state.
  "Showing {n} scheme.": "{n} योजना दिख रही है।",
  "Showing {n} schemes.": "{n} योजनाएँ दिख रही हैं।",
  "Showing {n} scheme with your filters.": "आपके फ़िल्टर के साथ {n} योजना दिख रही है।",
  "Showing {n} schemes with your filters.": "आपके फ़िल्टर के साथ {n} योजनाएँ दिख रही हैं।",
  // `EmptyState` translates the `title` and `description` it is handed.
  "No schemes match these filters": "इन फ़िल्टर से कोई योजना नहीं मिली",
  "No scholarships found yet": "अभी कोई स्कॉलरशिप नहीं मिली",

  // ---------------------------------------------------------------- one scheme card
  // The provider and reach badges and the two captions on a card. `scopeLabel`,
  // `levelLabel` and `stateLabel` are tables inside the screen's own file, so the screen
  // translates what they hand back; the class and degree words they return belong to
  // `common.ts` and `student-tools.ts`.
  "Central government": "केंद्र सरकार",
  "State government": "राज्य सरकार",
  Institution: "संस्थान",
  "Private trust": "प्राइवेट ट्रस्ट",
  "All India": "अखिल भारतीय",
  "What it offers": "इसमें क्या मिलता है",
  "Who it is generally for": "यह आम तौर पर किनके लिए है",
  "How to apply": "आवेदन कैसे करें",

  // ------------------------------------------------ family finances, a calmer view
  "Family finances — a calmer view": "परिवार के पैसे — एक शांत नज़रिया",
  "Limited money can limit a route, but it never limits your worth or your right to a good career.":
    "पैसे कम होने से कोई रास्ता मुश्किल हो सकता है, पर इससे आपकी क़द्र या अच्छे करियर के आपके हक़ पर कोई असर नहीं पड़ता।",
  "Ask your school office about schemes you may qualify for — many never get applied to simply because families don't know they exist.":
    "अपने स्कूल ऑफ़िस से उन योजनाओं के बारे में पूछें जिनके लिए आप पात्र हो सकते हैं — बहुत सी योजनाओं पर कभी आवेदन ही नहीं होता, बस इसलिए कि परिवारों को पता नहीं होता वे मौजूद हैं।",
  "Government schemes and low-cost state colleges are legitimate first choices, not a lesser path.":
    "सरकारी योजनाएँ और कम खर्चे वाले राजकीय कॉलेज बिल्कुल सही पहली पसंद हैं — यह कोई छोटा रास्ता नहीं है।",
  "Never pay a middleman to apply for you. Applications go through official portals, often with help from your school.":
    "किसी बिचौलिए को आपके लिए आवेदन कराने के पैसे कभी न दें। आवेदन आधिकारिक पोर्टल से होते हैं, और अक्सर इसमें आपके स्कूल की मदद मिलती है।",
  "This app never asks for banking details or documents, and you should not share them here with anyone.":
    "यह ऐप कभी बैंकिंग की जानकारी या दस्तावेज़ नहीं माँगता, और आपको भी यहाँ किसी के साथ उन्हें शेयर नहीं करना चाहिए।",
};
