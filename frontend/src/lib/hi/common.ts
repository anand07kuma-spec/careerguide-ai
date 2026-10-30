/**
 * Hindi for the parts of the interface that exist everywhere: the navigation,
 * the dashboard, the words on buttons and badges.
 *
 * Keys are the English source text so a missing entry falls back to English
 * instead of blanking out a label.
 */
export const HI: Record<string, string> = {
  // The wordmark, which is the name itself read aloud by a screen reader.
  "CareerGuide AI logo": "CareerGuide AI लोगो",

  // Sidebar and mobile navigation
  "Talk with your guide": "अपने गाइड से बात करें",
  Explore: "खोजें",
  "Your progress": "आपकी प्रगति",
  Account: "खाता",
  Home: "होम",
  "Start AI Call": "AI कॉल शुरू करें",
  "Chat Instead": "बजाय इसके, टाइप करके बात करें",
  "Career Explorer": "करियर खोजें",
  "Choose your stream": "अपना स्ट्रीम चुनें",
  Streams: "स्ट्रीम",
  "Exams & entrances": "एग्ज़ाम और एंट्रेंस",
  // The short nav label and the exams screen heading are one key, and `exams.ts`
  // holds it — the last file spread in `index.ts` wins, so a second entry here
  // would silently hold up a different word on the same screen.
  "Discover My Interests": "अपनी रुचियाँ जानें",
  Resources: "संसाधन",
  "Scholarships & Aid": "स्कॉलरशिप और आर्थिक मदद",
  "Institutes & Courses": "संस्थान और कोर्स",
  "My Journey": "मेरी यात्रा",
  "Study & Skill Plans": "पढ़ाई और स्किल प्लान",
  Reports: "रिपोर्ट",
  "Parent Dashboard": "अभिभावक डैशबोर्ड",
  Settings: "सेटिंग्स",
  Careers: "करियर",
  "AI Call": "AI कॉल",
  Chat: "चैट",
  Interests: "रुचियाँ",
  Plans: "प्लान",
  Journey: "यात्रा",
  Scholarships: "स्कॉलरशिप",
  Institutes: "संस्थान",
  Report: "रिपोर्ट",
  Parent: "अभिभावक",
  Resume: "रिज़्यूमे",
  Billing: "बिलिंग",
  "My Profile": "मेरी प्रोफ़ाइल",
  Menu: "मेन्यू",
  "Open menu": "मेन्यू खोलें",
  "Close menu": "मेन्यू बंद करें",
  "Quick navigation": "जल्दी जाने के लिए",
  "Profile and settings": "प्रोफ़ाइल और सेटिंग्स",
  "Main menu": "मुख्य मेन्यू",
  Main: "मुख्य नेविगेशन",
  "Parent account": "अभिभावक खाता",
  "Getting your dashboard ready…": "आपका डैशबोर्ड तैयार हो रहा है…",

  // Dashboard
  Student: "विद्यार्थी",
  "Pick up where you left off.": "जहाँ छोड़ा था वहीं से आगे बढ़ें।",
  "Your journey so far": "अब तक की आपकी यात्रा",
  "Filter the journal by": "इस प्रकार से डायरी छाँटें",
  "Portal sections": "पोर्टल के हिस्से",
  "Sessions completed": "पूरी हुई बातचीत",
  "Careers saved": "सेव किए गए करियर",
  "Themes explored": "देखे गए विषय",
  "Activities done": "पूरे किए काम",
  "Directions worth exploring": "जो रास्ते देखने लायक हैं",
  "Browse all": "सब देखें",
  "Why this one": "यह क्यों",
  "Early signal": "शुरुआती संकेत",
  "Some evidence": "कुछ प्रमाण",
  "Several signals": "कई संकेत",
  "Verified source": "स्रोत सत्यापित",
  "Verify on official site": "आधिकारिक साइट पर जाँचें",
  "Not yet checked against a source": "अभी किसी स्रोत से जाँची नहीं गई",
  "Where this record came from": "यह जानकारी कहाँ से आई",
  "On {date} somebody opened the page below and read this record against it.":
    "{date} को किसी ने नीचे दिया पृष्ठ खोला और यह जानकारी उससे मिलाकर पढ़ी।",
  "Nobody has read this record against a source yet. It is the app's own note, and the numbers in it need checking before you plan around them.":
    "किसी ने यह जानकारी अभी किसी स्रोत से मिलाकर नहीं पढ़ी। यह ऐप का अपना नोट है, और इसमें दी संख्याएँ योजना बनाने से पहले जाँच लें।",
  "No page was recorded for this row.": "इस जानकारी के लिए कोई पृष्ठ दर्ज नहीं है।",
  "The page that was read": "जो पृष्ठ पढ़ा गया",
  "The university's own site": "विश्वविद्यालय की अपनी साइट",
  "Where you apply": "जहाँ आवेदन होता है",
  "Class 6": "कक्षा 6",
  "Class 7": "कक्षा 7",
  "Class 8": "कक्षा 8",
  "Class 9": "कक्षा 9",
  "Class 10": "कक्षा 10",
  "Class 11": "कक्षा 11",
  "Class 12": "कक्षा 12",
  "Saved careers": "सेव किए गए करियर",
  "Nothing saved yet": "अभी कुछ सेव नहीं किया",
  "Tap the bookmark on any career to keep it here for later.":
    "किसी भी करियर पर बुकमार्क दबाएँ, वह यहाँ सेव हो जाएगा।",
  "Find careers to explore": "करियर खोजने शुरू करें",
  Family: "परिवार",
  "Privacy, consent and a parent link": "प्राइवेसी, अनुमति और अभिभावक लिंक",
  "What is stored, who may see it, and what this device remembers.":
    "क्या सेव होता है, कौन देख सकता है, और यह डिवाइस क्या याद रखता है।",
  "Tell the guide your class": "गाइड को अपनी कक्षा बताएँ",
  "Voice call": "वॉइस कॉल",

  // The gate every signed-in screen passes through before it renders
  "Checking your account…": "आपका खाता जाँचा जा रहा है…",
  "Taking you to the right place…": "आपको सही जगह ले जाया जा रहा है…",
  "Nothing has been cleared on this device. This usually means the backend is starting up, or the internet dropped for a moment.":
    "इस डिवाइस से कुछ नहीं मिटाया गया है। आमतौर पर इसका मतलब है कि बैकएंड शुरू हो रहा है, या इंटरनेट एक पल के लिए रुका है।",

  // Common buttons and states
  Save: "सेव करें",
  Cancel: "रद्द करें",
  Close: "बंद करें",
  "Close dialog": "डायलॉग बंद करें",
  Back: "पीछे",
  // "Next" and "Previous" travel together and `assessments.ts` holds that pair,
  // used by the quiz stepper and by the admin tables' pagination.
  Done: "पूरा हुआ",
  Skip: "छोड़ें",
  Retry: "फिर कोशिश करें",
  Search: "खोजें",
  Clear: "साफ़ करें",
  Loading: "लोड हो रहा है",
  Yes: "हाँ",
  No: "नहीं",
  Optional: "ज़रूरी नहीं",
  "Not sure yet": "अभी पक्का नहीं",
  "Try the voice": "आवाज़ आज़माएँ",
  "Test the voice": "आवाज़ जाँचें",
  Language: "भाषा",
  English: "English",
  Hindi: "हिन्दी",
  Hinglish: "Hinglish",
  // The option lists in `src/lib/types.ts` are shared by the pickers on several
  // screens, and a `<Select>` translates its own option labels — so a key here is
  // the only place these can have Hindi, and the only copy of it.
  "Hinglish (Hindi + English)": "Hinglish (हिन्दी + अंग्रेज़ी)",
  "Age 3 to 5": "उम्र 3 से 5",
  "Very simple questions about play and colours": "खेल और रंगों से जुड़े बहुत आसान सवाल",
  "Age 6 to 8": "उम्र 6 से 8",
  "Short conversations about what they enjoy": "पसंदीदा कामों के बारे में छोटी बातचीत",
  "Age 9 to 10": "उम्र 9 से 10",
  "Careers explained through daily work": "रोज़ के काम से करियर समझाना",
  "Age 11 to 12": "उम्र 11 से 12",
  "Streams, subjects and skill ideas": "स्ट्रीम, विषय और स्किल के बारे में",
  "Age 13 or above": "उम्र 13 या उससे ज़्यादा",
  "Full guidance, including costs and entrances": "पूरा मार्गदर्शन, खर्चे और एंट्रेंस भी",
  "Science and Healthcare": "विज्ञान और स्वास्थ्य",
  "Engineering and Technology": "इंजीनियरिंग और टेक्नोलॉजी",
  "AI and Data": "AI और डेटा",
  "Sports and Fitness": "खेल और फ़िटनेस",
  Aviation: "विमानन",
  "Defence and Public Services": "डिफ़ेंस और सरकारी सेवाएँ",
  "Art, Design, and Media": "कला, डिज़ाइन और मीडिया",
  "Business and Entrepreneurship": "बिज़नेस और उद्यम",
  "Finance and Banking": "फ़ाइनेंस और बैंकिंग",
  "Law and Social Sciences": "कानून और सोशल साइंसेज़",
  "Education and Research": "पढ़ाई और रिसर्च",
  "Environment and Agriculture": "पर्यावरण और खेती",
  "Skilled Trades and Vocational Careers": "हुनर और वोकेशनल करियर",
  "Hospitality and Tourism": "हॉस्पिटैलिटी और टूरिज़्म",
  "Other emerging careers": "नए तरह के करियर",
  "Read aloud": "बोलकर सुनाएँ",
  "Stop speaking": "बोलना बंद करें",
  "Dismiss notification": "सूचना हटाएँ",

  // Relative times, interpolated into sentences elsewhere on the screen
  "just now": "अभी",
  "{n} min ago": "{n} मिनट पहले",
  "{n} hr ago": "{n} घंटे पहले",
  "{n} day ago": "{n} दिन पहले",
  "{n} days ago": "{n} दिन पहले",

  // Consent and onboarding
  "I am a student": "मैं विद्यार्थी हूँ",
  "I am a parent or guardian": "मैं अभिभावक हूँ",
  Continue: "आगे बढ़ें",
  "Your name": "आपका नाम",
  "Who is using CareerGuide AI?": "CareerGuide AI कौन इस्तेमाल कर रहा है?",

  // Career explorer
  "Browse careers across every field. These describe possibilities to look into, not predictions about you.":
    "हर फ़ील्ड के करियर यहाँ देखें। ये संभावनाएँ बताने के लिए हैं, आपके बारे में अनुमान लगाने के लिए नहीं।",
  "Personalise by interest": "अपनी रुचि के अनुसार देखें",
  "Search careers, e.g. data, nurse, pilot": "करियर खोजें, जैसे data, nurse, pilot",
  "All interest themes": "सभी रुचि के विषय",
  "Search careers": "करियर खोजें",
  "Filter by interest theme": "रुचि के विषय से चुनें",
  Field: "फ़ील्ड",
  "All fields": "सभी फ़ील्ड",
  "Saved only": "सिर्फ़ सेव किए गए",
  "Clear filters": "फ़िल्टर हटाएँ",
  "Careers here describe what the work is really like. Entry requirements, costs and exams change often — always verify them with the official sources on each career page.":
    "यहाँ बताया गया है कि काम असल में कैसा है। दाखिले के नियम, खर्चा और एग्ज़ाम बदलते रहते हैं — हर करियर पेज पर दिए गए ऑफ़िशियल लिंक से खुद जाँच लें।",
  "No careers match these filters": "इन फ़िल्टर से कोई करियर नहीं मिला",
  "No careers found yet": "अभी कोई करियर नहीं मिला",
  "You haven't saved any career in this view yet. Try turning off 'Saved only'.":
    "आपने अभी इस लिस्ट में कोई करियर सेव नहीं किया है। 'सिर्फ़ सेव किए गए' बंद करके देखें।",
  "Try a different search term, or clear the filters to see everything.":
    "दूसरा शब्द लिखकर देखें, या फ़िल्टर हटाकर सब देखें।",
  "View details": "पूरी जानकारी देखें",
  "Explorable from class {n}": "कक्षा {n} से इसे देखना शुरू कर सकते हैं",
  "Showing 1 career": "1 करियर दिख रहा है",
  "Showing {n} careers": "{n} करियर दिख रहे हैं",
  "with your filters": "आपके फ़िल्टर के साथ",

  // Career detail page
  "What the work looks like": "काम असल में कैसा है",
  "A day in this work": "इस काम का एक दिन",
  "Skills that help": "कौन से स्किल काम आते हैं",
  "You build these over time — they're not a test you have to pass today.":
    "ये समय के साथ बनते हैं — आज इसका टेस्ट देना ज़रूरी नहीं है।",
  "School subjects that connect": "स्कूल के कौन-कौन से विषय इससे जुड़ते हैं",
  "How people get there": "लोग यहाँ तक कैसे पहुँचते हैं",
  "Different routes can lead to the same work.": "अलग-अलग रास्तों से एक ही काम तक पहुँचा जा सकता है।",
  "What to check before you commit": "पक्का करने से पहले क्या जाँचें",
  "Requirements change — verify these against the official links below.":
    "नियम बदलते रहते हैं — नीचे दिए ऑफ़िशियल लिंक से जाँच लें।",
  "Steps to prepare": "तैयारी के चरण",
  "Costs and the routes around them": "खर्चा और उसे कम करने के रास्ते",
  "Money shapes choices, but it rarely closes every door.": "पैसा चुनाव को प्रभावित करता है, पर हर रास्ता बंद नहीं करता।",
  "What people enjoy": "लोग इसमें क्या पसंद करते हैं",
  "What's harder": "इसमें मुश्किल क्या है",
  "Try it before you decide": "फ़ैसले से पहले इसे आज़माएँ",
  "Small, low-risk ways to see if this kind of work interests you.":
    "छोटे और सुरक्षित तरीके, इससे पता चलेगा कि यह काम आपको रुचि देता है या नहीं।",
  "Turn these into a study plan": "इनसे पढ़ाई का प्लान बनाएँ",
  "What this page can and can't do": "यह पेज क्या कर सकता है और क्या नहीं",
  "Interest themes": "रुचि के विषय",
  "No themes tagged for this career.": "इस करियर के लिए कोई विषय नहीं जोड़ा गया है।",
  "Good to know": "जानना ज़रूरी है",
  "Official links": "ऑफ़िशियल लिंक",
  "The best place to verify details yourself.": "भरी जानकारी खुद जाँचने की सबसे जगह।",
  "Related careers": "मिलते-जुलते करियर",
  "Save career": "करियर सेव करें",
  Saved: "सेव है",
  "Back to explorer": "खोज पर वापस",
  "Loading career…": "करियर की जानकारी आ रही है…",
  "Career not found": "यह करियर नहीं मिला",
  "This career didn't load": "यह करियर खुल नहीं सका",
  "The details on this page are a helpful starting point, but the numbers and rules here still need checking against official sources before you rely on them.":
    "इस पेज की जानकारी एक अच्छी शुरुआत है, पर आँकड़े और नियम अभी ऑफ़िशियल सोर्स से जाँचना ज़रूरी है भरोसा करने से पहले।",
  "If one route costs more than your family can spend, look at government and state colleges, scholarships, skill-based entry and self-study — many careers have more than one way in.":
    "अगर एक रास्ता आपके परिवार के बजट से ज़्यादा महँगा है, तो सरकारी और राज्यीय कॉलेज, स्कॉलरशिप, स्किल से दाखिला और अपनी-आप पढ़ाई भी देखें — कई करियर के कई रास्ते होते हैं।",
  "This page does not guarantee admission, a salary or success. Costs, exams and entry rules change over time, so please confirm anything important using the official links on this page before you make a decision.":
    "यह पेज दाखिला, तनख्वाह या सफलता की गारंटी नहीं देता। खर्चा, एग्ज़ाम और नियम समय के साथ बदलते हैं, इसलिए फ़ैसला करने से पहले इस पेज के ऑफ़िशियल लिंक से ज़रूरी बातें खुद जाँच लें।",
  "You can start exploring this from class {n}.": "आप इसे कक्षा {n} से देखना शुरू कर सकते हैं।",
  "We couldn't find that career": "यह करियर नहीं मिल पाया",
  "The link may be old or the career may have moved.": "लिंक पुराना हो सकता है या करियर दूसरी जगह गया हो सकता है।",
  "No career to show": "दिखाने के लिए कोई करियर नहीं",
  "Browse all careers": "सभी करियर देखें",
  "Fetching the details…": "जानकारी आ रही है…",
  "Clear search": "खोज साफ़ करें",
  "Try again": "फिर कोशिश करें",
  "That did not load": "यह खुल नहीं सका",

  // Interest themes
  "Creative exploration": "रचनात्मक खोज",
  "Analytical problem-solving": "सोच-समझकर समस्या हल करना",
  "Practical building and making": "हाथ से बनाने और जोड़ने का काम",
  "Communication and collaboration": "बातचीत और मिलकर काम",
  "Helping and supporting others": "दूसरों की मदद और सहारा",
  "Physical activity and sports": "शारीरिक गतिविधि और खेल",
  "Nature and scientific curiosity": "प्रकृति और विज्ञान की जिज्ञासा",
  "Organization and leadership": "व्यवस्था और नेतृत्व",

  // Wrong address page. Its list of places is the navigation again, so the short
  // names it points at are the labels the sidebar already uses; only the sentences
  // that explain the mistake, and the hints under each link, are new here.
  "Page not found": "पेज नहीं मिला",
  "That address isn't part of CareerGuide AI": "यह पता CareerGuide AI का हिस्सा नहीं है",
  "Nothing is broken and no data was lost — the address in your browser bar does not match any screen here. Pick a place below, or check the spelling: most screens start with":
    "कुछ टूटा नहीं है और कोई जानकारी नहीं मिटी — आपके ब्राउज़र में लिखा पता यहाँ की किसी स्क्रीन से मेल नहीं खाता। नीचे कोई जगह चुनें, या वर्तनी जाँच लें: ज़्यादातर स्क्रीन इससे शुरू होती हैं",
  "and use a plural ending, like": "और अंत में बहुवचन होता है, जैसे",
  "Go to my dashboard": "मेरे डैशबोर्ड पर जाएँ",
  "Start a voice call": "वॉइस कॉल शुरू करें",
  "Or jump straight to": "या सीधे जाएँ",
  "My dashboard": "मेरा डैशबोर्ड",
  "Pick up where you left off": "जहाँ छोड़ा था, वहीं से उठाएँ",
  "Talk to the guide": "गाइड से बात करें",
  "Type, or speak in Hindi or English": "टाइप करें, या हिन्दी या अंग्रेज़ी में बोलें",
  "Career explorer": "करियर खोजें",
  "Career profiles to look through": "देखने लायक करियर प्रोफ़ाइलें",
  "One gentle question at a time": "एक बार में एक हल्का-फुल्का सवाल",
  "Career report": "करियर रिपोर्ट",
  "Exploratory, never a verdict": "जानकारी के लिए, कभी फ़ैसला नहीं",
  "Study plans": "पढ़ाई के प्लान",
  "Small steps you own": "छोटे कदम, आपके अपने",
  "Routes that cost less": "कम खर्च वाले रास्ते",
  "Summary, not surveillance": "सारांश, निगरानी नहीं",

  // What this app says when one of its own steps fails. These sentences are written in
  // `api.ts` and `checkout.ts`, not in a screen, so they reach the reader as
  // `error.message` — which every screen now puts through the lookup. A message from the
  // server has no key here and passes through in the words the server chose.
  "Cannot reach the CareerGuide AI server right now. It may be starting up or temporarily offline — please try again in a moment.":
    "इस वक़्त CareerGuide AI सर्वर से बात नहीं हो पा रही है। हो सकता है वह अभी चल रहा हो या कुछ पलों के लिए बंद हो — एक मिनट बाद फिर कोशिश करें।",
  "The answers came back in a form this screen does not understand. Nothing was lost — please reload.":
    "जवाब ऐसे रूप में आए जो यह स्क्रीन समझ नहीं सकी। कुछ नहीं खोया — पेज दोबारा लोड करें।",
  "The plan could not be changed. Nothing was lost.": "प्लान बदला नहीं जा सका। कुछ नहीं खोया।",
  "The payment page only opens in a browser.": "भुगतान का पेज सिर्फ़ ब्राउज़र में खुलता है।",
  "The payment page could not be loaded. That is usually a blocked connection or a content blocker — nothing has been charged, so please try again.":
    "भुगतान का पेज नहीं खुल सका। आमतौर पर इसका मतलब है कि कनेक्शन रुका है या किसी ब्लॉकर ने रोका है — कोई पैसा कटया नहीं गया है, इसलिए फिर कोशिश करें।",
  "The payment page loaded but did not start. Nothing has been charged.":
    "भुगतान का पेज खुला पर शुरू नहीं हुआ। कोई पैसा कटया नहीं गया है।",
  "The payment page finished without a reference we can check. If money left your account it will appear on this page shortly — please do not pay again yet.":
    "भुगतान का पेज ऐसी जानकारी के साथ बंद हुआ जिससे हम कुछ जाँच न सकें। अगर आपके खाते से पैसा गया है तो वह कुछ ही देर में इस पेज पर दिखेगा — अभी दोबारा भुगतान मत कीजिए।",
  "That payment did not go through. Nothing was charged, and your plan is unchanged.":
    "वह भुगतान नहीं हो पाया। कोई पैसा कटया नहीं गया, और आपके प्लान में कुछ नहीं बदला।",

  // Sentences the server writes about the *screen* rather than about a career or a scheme —
  // how much it has to go on, what a report is and is not. They arrive as a `note` field in a
  // response, so they never appear in a source file for `hi-coverage` to find, and each screen
  // puts them through the lookup the same way it puts an error message through it.
  //
  // Translating them here rather than in the backend is deliberate: the backend knows the
  // language a student *replies* in, which is not the language the family switched the
  // interface to. Going through this dictionary follows the switch immediately, with no refetch.
  "There is not enough information yet to point anywhere specific. That is normal. Explore a few activities before drawing any conclusion.":
    "अभी इतनी जानकारी नहीं है कि कोई खास रास्ता बताया जा सके। यह सामान्य बात है। किसी नतीजे पर पहुँचने से पहले कुछ गतिविधियाँ देखिए।",
  "These are early observations from a short conversation. Interests usually change, and none of this is a prediction about the future.":
    "ये छोटी बातचीत से मिली शुरुआती बातें हैं। रुचियाँ अक्सर बदलती हैं, और इसमें से कुछ भी भविष्य की भविष्यवाणी नहीं है।",
  "These suggestions come from things you chose to share. They are starting points for discussion, not a verdict on what you should become.":
    "ये सुझाव उन्हीं बातों से आए हैं जो आपने बताना चुना। ये बातचीत की शुरुआत हैं, यह तय करने का फ़ैसला नहीं कि आपको बनना क्या है।",
  "This report describes what a student has said they are interested in. It is not an aptitude test, and it does not predict a career.":
    "यह रिपोर्ट बताती है कि छात्र ने अपनी रुचियों के बारे में क्या कहा। यह किसी योग्यता का परीक्षण नहीं है, और न ही यह करियर की भविष्यवाणी करती है।",
  "Early signal. Only one or two things to go on so far.":
    "शुरुआती संकेत। अब तक केवल एक-दो बातें ही आधार के रूप में हैं।",
  "Some supporting detail from your conversations.":
    "आपकी बातचीत में इसकी कुछ पुष्टि मिलती है।",
  "Several of your own statements point this way.":
    "आपकी अपनी कई बातें इसी ओर इशारा करती हैं।",
  "Posts are files next to the code that renders them. This API cannot read or write that directory, so there is no editor on the admin screens.":
    "पोस्ट उस कोड के बगल में रखी फ़ाइलें हैं जो उन्हें दिखाता है। यह API उस फ़ोल्डर को न पढ़ सकता है न लिख सकता है, इसलिए एडमिन स्क्रीन पर कोई एडिटर नहीं है।",

  // One-word labels never reach a sentence-level scanner. `Progress` is the name an
  // unlabelled progress bar gives a screen reader, so it is the one this file has to carry.
  "Progress": "प्रगति",
};
