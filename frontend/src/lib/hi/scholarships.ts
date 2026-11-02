/**
 * Hindi for `/app/scholarships`, the sample scholarship catalogue: its guidance
 * cards, filters, count line, scheme cards and empty states.
 *
 * Scheme names, providers, states, benefit/eligibility text, application steps,
 * amounts and disclaimers come from the server and are data, so they are not
 * translated here — only the app's own labels around them are. The few facet
 * words below (scope, level and the "All India" tag) are a closed enum the page
 * prettifies, so translating them is safe.
 *
 * Every entry is on one line on purpose: the two checkers in `scripts/` read this
 * folder as text, and a key wrapped onto its own line is a key they cannot see.
 */
export const HI: Record<string, string> = {
  // ------------------------------------------------------------------ the header
  "Scholarships & Financial Guidance": "छात्रवृत्ति और आर्थिक मार्गदर्शन",
  "A starting point for finding help with study costs. This is a sample list, not a complete or live one — every scheme must be confirmed on its official portal.": "पढ़ाई के ख़र्च में मदद खोजने की शुरुआत। यह एक नमूना सूची है, पूरी या लाइव सूची नहीं — हर योजना की पुष्टि उसके आधिकारिक पोर्टल पर करनी ज़रूरी है।",
  "Sample list — verify first": "नमूना सूची — पहले जाँच लें",

  // -------------------------------------------------- how to check a scheme is real
  "How to check a scheme is real": "किसी योजना की सच्चाई कैसे जाँचें",
  "Before trusting any scholarship, do these three things.": "किसी भी छात्रवृत्ति पर भरोसा करने से पहले ये तीन काम करें।",
  "Open the official government website yourself (for example the National Scholarship Portal) and read the current circular there — not a forwarded screenshot or WhatsApp message.": "सरकारी वेबसाइट ख़ुद खोलें (जैसे नेशनल स्कॉलरशिप पोर्टल) और वहाँ मौजूदा सर्कुलर पढ़ें — कोई फ़ॉरवर्ड किया स्क्रीनशॉट या व्हाट्सएप मैसेज नहीं।",
  "Ask your school office or college scholarship desk. They handle these applications and can tell you what is genuine.": "अपने स्कूल ऑफ़िस या कॉलेज की छात्रवृत्ति डेस्क से पूछें। ये आवेदन संभालते हैं और बता सकते हैं कि क्या असली है।",
  "Never pay a fee to someone who offers to “apply on your behalf.” Genuine government schemes do not charge agents to submit an application.": "जो कहे कि “आपकी ओर से आवेदन कर दूँगा” उसे कभी फ़ीस न दें। असली सरकारी योजनाएँ आवेदन जमा करने के लिए एजेंट से पैसे नहीं लेतीं।",
  "This list is a starting point only. It is not complete, and details change every academic year.": "यह सूची सिर्फ़ एक शुरुआत है। यह पूरी नहीं है, और हर शैक्षणिक साल विवरण बदलते हैं।",

  // -------------------------------------------------------------------- filters
  "Search schemes": "योजनाएँ खोजें",
  "Search scholarships": "छात्रवृत्तियाँ खोजें",
  "Filter by class level": "कक्षा स्तर से छाँटें",
  "Filter by state": "राज्य से छाँटें",
  "Filter by provider type": "प्रदाता प्रकार से छाँटें",
  "All class levels": "सभी कक्षा स्तर",
  "All states / All India": "सभी राज्य / पूरे भारत",
  "All providers": "सभी प्रदाता",

  // -------------------------------------------------------------- empty states
  "No schemes match these filters": "इन फ़िल्टर से कोई योजना मेल नहीं खाती",
  "No scholarships found yet": "अभी कोई छात्रवृत्ति नहीं मिली",
  "Try widening the class level, state or provider filters, or clear them to see the sample list.": "कक्षा स्तर, राज्य या प्रदाता फ़िल्टर थोड़ा और बढ़ाकर देखिए, या नमूना सूची देखने के लिए उन्हें हटा दीजिए।",
  "The scholarship list is empty right now. Please check back soon.": "छात्रवृत्ति सूची अभी ख़ाली है। कृपया जल्द ही दोबारा देखें।",

  // ----------------------------------------------------------------- count line
  "Showing {n} scheme.": "{n} योजना दिख रही है।",
  "Showing {n} schemes.": "{n} योजनाएँ दिख रही हैं।",
  "Showing {n} scheme with your filters.": "आपके फ़िल्टर से {n} योजना दिख रही है।",
  "Showing {n} schemes with your filters.": "आपके फ़िल्टर से {n} योजनाएँ दिख रही हैं।",
  "Show more scholarships": "और छात्रवृत्तियाँ दिखाएँ",

  // ------------------------------------------------------------- scheme cards
  "What it offers": "इसमें क्या मिलता है",
  "Who it is generally for": "यह आम तौर पर किसके लिए है",
  "How to apply": "आवेदन कैसे करें",
  "Official site": "आधिकारिक साइट",

  // ------------------------------------------------------- family finances card
  "Family finances — a calmer view": "परिवार की आर्थिक स्थिति — एक शांत नज़रिया",
  "Money shapes which route is possible. It never measures how much you are worth.": "पैसा तय करता है कि कौन-सा रास्ता संभव है। वह कभी नहीं नापता कि आपकी क़ीमत कितनी है।",
  "Limited money can limit a route, but it never limits your worth or your right to a good career.": "सीमित पैसा कोई रास्ता सीमित कर सकता है, पर वह आपकी क़ीमत या अच्छे करियर के आपके हक़ को कभी सीमित नहीं करता।",
  "Ask your school office about schemes you may qualify for — many never get applied to simply because families don’t know they exist.": "अपने स्कूल ऑफ़िस से उन योजनाओं के बारे में पूछें जिनके लिए आप योग्य हो सकते हैं — कई योजनाओं पर आवेदन सिर्फ़ इसलिए नहीं होता क्योंकि परिवारों को पता ही नहीं होता कि वे मौजूद हैं।",
  "Government schemes and low-cost state colleges are legitimate first choices, not a lesser path.": "सरकारी योजनाएँ और कम फ़ीस वाले सरकारी कॉलेज जायज़ पहली पसंद हैं, कोई छोटा रास्ता नहीं।",
  "Never pay a middleman to apply for you. Applications go through official portals, often with help from your school.": "आपकी ओर से आवेदन करने के लिए किसी बिचौलिए को कभी पैसे न दें। आवेदन आधिकारिक पोर्टल से होते हैं, अक्सर स्कूल की मदद से।",
  "This app never asks for banking details or documents, and you should not share them here with anyone.": "यह ऐप कभी बैंकिंग विवरण या दस्तावेज़ नहीं माँगता, और आपको ये यहाँ किसी के साथ साझा नहीं करने चाहिए।",

  // ------------------------------------------- closed enums the page prettifies
  "Central government": "केंद्र सरकार",
  "State government": "राज्य सरकार",
  Institution: "संस्थान",
  "Private trust": "निजी ट्रस्ट",
  Undergraduate: "स्नातक",
  Postgraduate: "परास्नातक",
  "Diploma / ITI": "डिप्लोमा / आईटीआई",
  "All India": "पूरे भारत",
  "Eligibility & how to apply": "पात्रता और आवेदन का तरीक़ा",
};