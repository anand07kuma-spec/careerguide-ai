/**
 * Hindi for the three heaviest admin screens: the content catalogue, the
 * deployment and log settings, and the study abroad lead desk.
 *
 * Keys are the English source text, so a missing entry falls back to English.
 * Values are written for an operator, not a child: plain professional Hindi
 * that keeps common loanwords instead of forcing shuddh replacements.
 *
 * Data that the operator does not read as chrome is left in English on purpose:
 * environment variable names, header names, file paths, brand names, slugs,
 * country names, action tokens from the API and free text a lead typed.
 */
export const HI: Record<string, string> = {
  // =============================================================== content screen

  // Tabs and screen body
  Questions: "सवाल",

  // Careers tab — filters, search and states
  "All entries": "सभी एंट्री",
  "Waiting to be verified": "सत्यापन बाकी है",
  "Already checked": "पहले जाँचे गए",
  "Find an entry": "एंट्री खोजें",
  "A word in a title or a slug": "शीर्षक या स्लग में कोई शब्द",
  "Categories in use:": "इस्तेमाल में श्रेणियाँ:",
  "Nothing matches": "मिलता-जुलता कुछ नहीं",
  "No entry has that verification state.": "कोई एंट्री इस सत्यापन स्थिति में नहीं है।",
  "Reading the catalogue": "कैटलॉग पढ़ा जा रहा है",
  "The catalogue would not load": "कैटलॉग खुल नहीं सका",
  "Reading the entry as it is stored": "एंट्री जैसी सेव है वैसी पढ़ी जा रही है",
  "This entry would not load": "यह एंट्री खुल नहीं सकी",

  // Career editor — field labels and hints
  Title: "शीर्षक",
  Category: "श्रेणी",
  "Reads from class": "किस कक्षा से पढ़ें",
  "6 to 12. The server refuses anything outside that.":
    "6 से 12। इससे बाहर की कोई संख्या सर्वर स्वीकार नहीं करता।",
  Summary: "सारांश",
  "At least ten characters.": "कम से कम दस अक्षर।",
  "A typical day": "एक आम दिन",
  "Costs and alternatives": "खर्चा और विकल्प",
  "Do not add a salary, a placement rate or an admission promise here. This text is shown to a family as fact.":
    "यहाँ तनख्वाह, प्लेसमेंट दर या दाखिले का वादा न लिखें। यह बात एक परिवार को तथ्य के रूप में दिखाई जाती है।",
  "One item per line.": "हर लाइन में एक चीज़।",
  "Education pathways": "पढ़ाई के रास्ते",
  "Entry requirements": "दाखिले की शर्तें",
  "How to prepare, in stages": "तैयारी कैसे करें, चरणों में",
  "What people like about it": "लोग इसमें क्या पसंद करते हैं",
  "What people find hard about it": "लोगों को इसमें क्या मुश्किल लगती है",
  "Things to try this month": "इस महीने आज़माने के लिए चीज़ें",
  "Related careers (slugs)": "मिलते-जुलते करियर (स्लग)",
  Verified: "सत्यापित",

  // Career editor — buttons, notices and caption
  "Save changes": "बदलाव सेव करें",
  "Save {changed} change{s}": "{changed} बदलाव सेव करें",
  "Discard my edits": "मेरे बदलाव हटाएँ",
  "Nothing has been changed yet, so there is nothing to save.":
    "अभी कुछ बदला नहीं है, इसलिए सेव करने के लिए कुछ नहीं है।",
  "Saved. The log says which {moved} field{s} moved, not what they now say.":
    "सेव हो गया। लॉग में बस इतना दर्ज है कि {moved} फ़ील्ड बदली, यह नहीं कि वे अब क्या कहती हैं।",
  "The server did not answer, so nothing was changed.":
    "सर्वर ने जवाब नहीं दिया, इसलिए कुछ नहीं बदला गया।",
  "Two things cannot be changed from this form. The address (":
    "इस फ़ॉर्म से दो चीज़ें नहीं बदली जा सकतीं। पता (",
  ") stays, because it lives in saved lists and printed reports. And “checked against a source” stays false until somebody reads a real source beside it — the server refuses that flag in both directions, and the links under “Official links” are edited in the seed file rather than here.":
    ") वैसे ही रहेगा, क्योंकि वह सेव की गई सूचियों और छपी रिपोर्टों में मौजूद है। और “किसी स्रोत से जाँचा गया” तब तक ग़लत ही रहेगा जब तक कोई उसके पास बैठकर कोई असली स्रोत न पढ़ ले — सर्वर यह फ़्लैग दोनों तरफ़ से बदलने से मना करता है, और Official links के नीचे के लिंक यहाँ नहीं, सीड फ़ाइल में बदले जाते हैं।",
  "Class {n}+": "कक्षा {n}+",
  "{total} entries in the catalogue.": "कैटलॉग में {total} एंट्री हैं।",
  "“Waiting to be verified” is the working list: every seeded row carries it, and the honest way to clear it is to read a real source beside the entry, then edit the text here. Switching the flag without reading anything is refused by the server, not by this page.":
    "“सत्यापन बाकी है” यानी काम की सूची: हर सीड की गई पंक्ति इसे लिए रखती है, और इसे सच में हटाने का तरीका है कि एंट्री के पास बैठकर कोई असली स्रोत पढ़ें, फिर यहाँ टेक्स्ट बदलें। बिना कुछ पढ़े फ़्लैग बदलना सर्वर मंज़ूर नहीं करता, यह पेज नहीं।",

  // Questions tab — filters and states
  "Every questionnaire": "हर क्वेश्चन-पत्र",
  Personality: "व्यक्तित्व",
  Aptitude: "योग्यता",
  "Reading the question bank": "क्वेश्चन बैंक पढ़ा जा रहा है",
  "The bank would not load": "बैंक खुल नहीं सका",
  "No items in the bank yet": "बैंक में अभी कोई आइटम नहीं",
  "This table has no questions, so there is nothing to reword. Seed them with scripts/seed.py.":
    "इस टेबल में कोई सवाल नहीं हैं, इसलिए बदलने के लिए कुछ नहीं है। इन्हें scripts/seed.py से सीड करें।",
  "On a fresh database the question bank is not in it yet: the 75 items are seeded from":
    "नए डेटाबेस में क्वेश्चन बैंक अभी होता नहीं: 75 आइटम",
  by: "द्वारा",
  ", not at boot. Run the seed and reload this tab.":
    "से सीड होते हैं, बूट पर नहीं। सीड चलाएँ और यह टैब फिर से लोड करें।",

  // Question editor — field labels and hints
  "English wording": "अंग्रेज़ी भाषा",
  "हिन्दी wording": "हिन्दी भाषा",
  "A child answering in Hindi sees this one. Five characters at least.":
    "हिन्दी में जवाब दे रहा बच्चा यही देखता है। कम से कम पाँच अक्षर।",
  Dimension: "आयाम",
  "The theme this item scores toward.": "यह आइटम किस विषय के स्कोर की ओर जाता है।",
  "Response type": "जवाब का प्रकार",
  "How the answer arrives, eg likert.": "जवाब कैसे आता है, जैसे likert।",
  Keyed: "की",
  "+ counts toward it": "+ इसकी ओर गिना जाता है",
  "− counts against it": "− इसके ख़िलाफ़ गिना जाता है",
  Order: "क्रम",
  "0 to 200.": "0 से 200।",
  "Correct value (only for a scored item)": "सही मान (केवल स्कोर वाले आइटम के लिए)",
  "Leave it alone unless this question has one right answer.":
    "इसे वैसा ही छोड़ें जब तक इस सवाल का एक ही सही जवाब न हो।",

  // Question editor — notices, buttons and caption
  "Reworded. The log names the field; it does not keep a copy of the new wording.":
    "शब्द बदले गए। लॉग में फ़ील्ड का नाम है; नए शब्दों की कॉपी नहीं रखी जाती।",
  "The server did not answer, so this item still reads as it did.":
    "सर्वर ने जवाब नहीं दिया, इसलिए यह आइटम वैसा ही रहेगा जैसा था।",
  "The options ({count}) are not editable on this screen: they are authored with the item in":
    "विकल्प ({count}) इस स्क्रीन पर बदले नहीं जा सकते: वे आइटम के साथ ही लिखे जाते हैं",
  ", and a reworded question with unchanged options is easy to get wrong in a form. Change the wording here, the choices there.":
    "में, और बिना विकल्प बदले सवाल के शब्द बदलना फ़ॉर्म में ग़लत होना आसान है। शब्द यहाँ बदलें, विकल्प वहाँ।",

  // Question row — badges, meta and the locked note
  "No answers yet": "अभी जवाब नहीं",
  "{answers} answers stored": "{answers} जवाब सेव हैं",
  keyed: "की",
  order: "क्रम",
  correct: "सही",
  "{count} options": "{count} विकल्प",
  Reword: "शब्द बदलें",
  Locked: "लॉक",
  "{answers} children have answered this item, so it is part of a score that has already been handed over. Its wording is fixed. To change what it asks, author a new code in":
    "{answers} बच्चों ने इस आइटम का जवाब दिया है, इसलिए यह पहले ही दी गई एक स्कोर का हिस्सा है। इसके शब्द तय हैं। यह क्या पूछता है बदलने के लिए, एक नया कोड लिखें",
  "and ship a new bank version — the old answers then still mean the question they were asked.":
    "और एक नया बैंक संस्करण भेजें — तब पुराने जवाबों का वही मतलब रहेगा जो सवाल उनसे पूछा गया था।",
  "Adding, removing and re-scoring items is not done from this screen — a bank is authored in the seed file so that a sitting can be marked the same way twice, and a versioned file is what makes that true. What is offered here is the one safe edit: the wording of an item nobody has answered.":
    "आइटम जोड़ना, हटाना और दोबारा स्कोर करना इस स्क्रीन से नहीं होता — बैंक सीड फ़ाइल में लिखा जाता है ताकि एक ही बार की गई परीक्षा को दो बार एक जैसा जाँचा जा सके, और वर्ज़न वाली फ़ाइल ही यह सुनिश्चित करती है। यहाँ बस एक ही सुरक्षित बदलाव दिया जाता है: जिस आइटम का किसी ने जवाब नहीं दिया, उसके शब्द बदलना।",

  // Blog tab
  "Not editable here": "यहाँ बदला नहीं जा सकता",
  "Posts are files, not rows": "पोस्ट फ़ाइलें हैं, पंक्तियाँ नहीं",
  "Where:": "कहाँ:",
  "How a post goes live:": "पोस्ट लाइव कैसे होती है:",
  "There is no form below this panel, and there will not be one until the posts live in the database. A box that took your text and had nowhere to put it would look like a blog editor and behave like a deleted draft, which is the failure this tab exists to avoid.":
    "इस पैनल के नीचे कोई फ़ॉर्म नहीं है, और तब तक नहीं होगा जब तक पोस्ट डेटाबेस में नहीं रहतीं। डिब्बा जो आपका टेक्स्ट ले ले और उसे रखने की जगह न हो, वह ब्लॉग एडिटर जैसा दिखेगा और डिलीट किए ड्राफ़्ट जैसा बर्ताव करेगा — यही वह गलती है जिसे यह टैब टालने के लिए है।",
  "Asking the server about the blog": "सर्वर से ब्लॉग के बारे में पूछा जा रहा है",

  // =============================================================== content screen shell
  "The server did not answer": "सर्वर ने जवाब नहीं दिया",
  "The career catalogue a child reads, the questionnaire bank they answer, and the blog. Two of the three are editable here; the third is a file beside the code.":
    "वह करियर कैटलॉग जो एक बच्चा पढ़ता है, वह प्रश्नावली बैंक जिसे वे हल करते हैं, और ब्लॉग। इनमें से दो यहाँ बदले जा सकते हैं; तीसरा कोड के बगल में एक फ़ाइल है।",
  "No career has “{applied}” in its title or slug. The catalogue is only what the seed file and this screen put in it.":
    "किसी करियर के नाम या स्लग में “{applied}” नहीं है। कैटलॉग में सिर्फ़ वही है जो सीड फ़ाइल और यह स्क्रीन डालती हैं।",

  // =============================================================== settings screen

  // Screen body and the two panel headings
  "Deployment and log": "तैनाती और लॉग",
  "What this installation is running on, and every change an operator has made since the log began. Neither panel is a form.":
    "यह इंस्टॉलेशन किस पर चल रहा है, और लॉग शुरू होने के बाद ऑपरेटर ने हर बदलाव क्या किया। दोनों में से कोई भी पैनल फ़ॉर्म नहीं है।",
  "Asking the process what it is running on": "प्रोसेस से पूछा जा रहा है कि वह किस पर चल रहा है",
  "The deployment would not describe itself": "तैनाती ने अपना विवरण नहीं दिया",
  "Operator log": "ऑपरेटर लॉग",
  "One row per change made from these screens or from": "इन स्क्रीनों से या",
  ": who did it, to what, and when. It is append-only, and there is no control on this page that clears it.":
    "से किए गए हर बदलाव की एक पंक्ति: किसने किया, क्या बदला, और कब। यह सिर्फ़ जोड़ा जाता है, और इस पेज पर कोई ऐसा साधन नहीं जो इसे मिटाए।",

  // Deployment cards — headings
  "Answers and speech": "जवाब और आवाज़",
  Mail: "मेल",
  Payments: "भुगतान",
  "Sign-in and identity": "साइन-इन और पहचान",
  "Hosting and tenants": "होस्टिंग और टैनेंट",
  "Limits a student meets": "वे सीमाएँ जिन पर एक विद्यार्थी रुकता है",
  Throttles: "थ्रॉटल",
  "Why there is no Save button on this page": "इस पेज पर Save बटन क्यों नहीं है",
  "These values are read from the environment of the process that served this request. The way to change one is to set the variable where the app runs and start that process again — on your own machine the file is":
    "ये मान उस प्रोसेस के एनवायरनमेंट से पढ़े जाते हैं जिसने यह अनुरोध सेवा दिया। किसी एक को बदलने का तरीका है कि ऐप जहाँ चलता है वहाँ वैरिएबल सेट करें और प्रोसेस दोबारा चलाएँ — अपनी मशीन पर फ़ाइल है",
  ", on Vercel it is the project’s environment settings. The one thing on this page that a request can change is who holds the operator flag, and that happens in":
    ", Vercel पर यह प्रोजेक्ट के एनवायरनमेंट सेटिंग्स हैं। इस पेज पर एक ही चीज़ है जिसे एक अनुरोध बदल सकता है — कि ऑपरेटर फ़्लैग किसके पास है — और वह यहाँ होता है",
  "or from the accounts list, both of which write to the log below.":
    "या खातों की सूची से, दोनों नीचे के लॉग में दर्ज होते हैं।",

  // KeyValue labels on the deployment panel
  "AI provider": "AI प्रोवाइडर",
  "Gemini key present": "Gemini की मौजूद",
  "Speech (text to voice)": "आवाज़ (टेक्स्ट से स्पीच)",
  "Azure key present": "Azure की मौजूद",
  "Resend key present": "Resend की मौजूद",
  "Sending allowed": "भेजने की अनुमति",
  "From address": "भेजने वाले का पता",
  "Enquiries are announced to": "पूछताछ यहाँ बताई जाती है",
  "Razorpay keys present": "Razorpay कीज़ मौजूद",
  "Webhook verifiable": "वेबहुक जाँचा जा सकता है",
  "Sandbox or live": "सैंडबॉक्स या लाइव",
  "Clerk key present": "Clerk की मौजूद",
  "Clerk webhook secret present": "Clerk वेबहुक सीक्रेट मौजूद",
  "Database engine": "डेटाबेस इंजन",
  "Tables created on boot": "बूट पर टेबल बने",
  "Portal base domain": "पोर्टल का बेस डोमेन",
  "Site address": "साइट का पता",
  "Allowed browser origins": "मंज़ूर ब्राउज़र ओरिजिन",
  "Trust X-Forwarded-Host": "X-Forwarded-Host पर भरोसा",
  "Trust X-Forwarded-For": "X-Forwarded-For पर भरोसा",
  "Plan limits enforced": "प्लान की सीमाएँ लागू",
  "Free chats a day": "मुफ़्त चैट प्रतिदिन",
  "Free sittings in total": "कुल मुफ़्त प्रश्नोत्तरी बैठक",
  "Day rolls at": "दिन बदलता है",
  "Throttling on": "थ्रॉटलिंग चालू",
  "Operator writes": "ऑपरेटर के बदलाव",
  "Public enquiries": "आम पूछताछ",
  "Portal changes": "पोर्टल के बदलाव",
  "Where the counters live": "गिनती कहाँ रहती है",

  // KeyValue notes on the deployment panel
  "A configured provider is answering, so replies come from the model named above.":
    "एक सेट किया हुआ प्रोवाइडर जवाब दे रहा है, इसलिए जवाब ऊपर बताए मॉडल से आते हैं।",
  "Nothing is configured, so the canned demo script is answering. Its replies are counted separately on the overview and are never presented as a model's work.":
    "कुछ सेट नहीं है, इसलिए बना-बनाया डेमो स्क्रिप्ट जवाब दे रहा है। उसके जवाब ओवरव्यू पर अलग गिने जाते हैं और कभी मॉडल का काम नहीं बताए जाते।",
  "Messages leave this deployment when their route runs.":
    "जब उनका रूट चलता है तो संदेश इस तैनाती से बाहर जाते हैं।",
  "Mail is switched off. Addresses can still be attached and confirmed, and the outbox keeps the rows a later run would send.":
    "मेल बंद है। पते अभी भी जोड़े और पुष्टि किए जा सकते हैं, और आउटबॉक्स उन पंक्तियों को रखता है जो बाद का रन भेज देगा।",
  "Not a secret, and you need it to know where a family's enquiry actually went.":
    "यह सीक्रेट नहीं है, और आपको इसकी ज़रूरत है यह जानने के लिए कि किसी परिवार की पूछताछ असल में कहाँ गई।",
  "An order can be created.": "ऑर्डर बनाया जा सकता है।",
  "No key, so checkout is switched off. The pricing page still shows the plans, and the billing page reports the free plan.":
    "की नहीं है, इसलिए चेकआउट बंद है। कीमत वाला पेज प्लान दिखाता रहता है, और बिलिंग पेज फ़्री प्लान दिखाता है।",
  "Without the signing secret a callback cannot be trusted, so a payment would have to be confirmed by hand.":
    "बिना साइनिंग सीक्रेट के कॉलबैक पर भरोसा नहीं किया जा सकता, इसलिए भुगतान को हाथ से पुष्टि करना पड़ेगा।",
  "The overview counts a test payment apart from revenue for exactly this reason.":
    "ओवरव्यू इसी कारण से टेस्ट भुगतान को आमदनी से अलग गिनता है।",
  "A fresh database builds itself. Migrations remain the way a schema changes after that.":
    "नया डेटाबेस ख़ुद बन जाता है। उसके बाद स्कीमा बदलने का तरीका माइग्रेशन ही रहता है।",
  "Only migrations touch the schema.": "स्कीमा को सिर्फ़ माइग्रेशन ही बदलते हैं।",
  "ON — only correct behind a proxy that overwrites this header. Left on in front of the open internet it lets a caller choose which portal they are reading.":
    "चालू — केवल तभी सही जब वह एक ऐसे प्रॉक्सी के पीछे हो जो यह हेडर बदल देता है। खुले इंटरनेट के सामने चालू छोड़ने पर कॉलर ख़ुद चुन सकता है कि वह कौन सा पोर्टल पढ़ रहा है।",
  "off, which is the safe default: the socket's own address decides.":
    "बंद, जो सुरक्षित डिफ़ॉल्ट है: सोकेट का अपना पता ही तय करता है।",
  "ON — only correct behind a proxy that overwrites this header, or a caller can pick which throttle bucket they land in.":
    "चालू — केवल तभी सही जब वह एक ऐसे प्रॉक्सी के पीछे हो जो यह हेडर बदल देता है, वरना कॉलर ख़ुद चुन सकता है कि किस थ्रॉटल बकेट में गिना जाए।",
  "off, which is the safe default.": "बंद, जो सुरक्षित डिफ़ॉल्ट है।",
  "The server counts these itself; a client cannot talk its way past them.":
    "सर्वर इन्हें ख़ुद गिनता है; क्लाइंट बात-बात में इन्हें टाल नहीं सकता।",
  "Set so a 'day' for a family in India ends at midnight there, not in a server's timezone.":
    "इसलिए सेट किया गया कि भारत में एक परिवार का 'दिन' वहाँ मध्यरात्रि को खत्म हो, सर्वर के टाइमज़ोन में नहीं।",
  "Four workers and four hundred calls a minute mean one shared allowance.":
    "चार वर्कर और मिनट के चार सौ कॉल का मतलब है एक ही साझा हद।",
  "One worker, honest limits. Two workers counting separately is a site whose real ceiling is double what these lines say — set RATE_LIMIT_REDIS_URL if this API is ever scaled past one process.":
    "एक वर्कर, सच्ची सीमाएँ। दो वर्कर अलग-अलग गिनें तो असली छत इन लाइनों से दोगुनी हो जाती है — अगर यह API कभी एक से ज़्यादा प्रोसेस पर चले तो RATE_LIMIT_REDIS_URL सेट करें।",

  // KeyValue notes that carry a value
  "Region {region}. Gemini's spoken model is {model}.":
    "रीजन {region}। Gemini की बोलने वाली मॉडल {model} है।",
  "Gemini's spoken model is {model}.": "Gemini की बोलने वाली मॉडल {model} है।",

  // KeyValue values that are UI words rather than data
  "not set": "सेट नहीं",
  none: "कोई नहीं",
  "Test keys — no money moves": "टेस्ट कीज़ — पैसा नहीं चलता",
  "Live keys": "लाइव कीज़",
  Neither: "कोई नहीं",
  "In Redis, shared by every worker": "Redis में, हर वर्कर के लिए साझा",
  "In this process": "इस प्रोसेस में",
  "{hours} hours from UTC": "UTC से {hours} घंटे",

  // Captions on the deployment panel
  "Neither speech provider is a guaranteed offline path, and the browser falls back to its own voice when the server has no key. Which one spoke is stated on the screen that uses it, not here.":
    "कोई भी स्पीच प्रोवाइडर पक्का ऑफ़लाइन रास्ता नहीं है, और सर्वर के पास की न हो तो ब्राउज़र अपनी आवाज़ इस्तेमाल करता है। किसने बोया यह उसी स्क्रीन पर बताया जाता है जहाँ इसका इस्तेमाल हो, यहाँ नहीं।",
  "Clerk is optional. Without it a device is the account, and the come-back code is the way back onto it — which is why the code is stretched through 210,000 PBKDF2 rounds rather than relying on the throttle below.":
    "Clerk ज़रूरी नहीं है। इसके बिना एक डिवाइस ही खाता होता है, और वापसी कोड ही उस पर लौटने का रास्ता है — इसीलिए कोड को 210,000 PBKDF2 राउंड से मज़बूत किया जाता है, नीचे दिए थ्रॉटल पर निर्भर न होकर।",
  "The counters live in this process’s memory. One instance means honest limits; a hosted deployment that runs several has a ceiling of the rule times however many are warm, which is a brake rather than a wall.":
    "गिनती इस प्रोसेस की मेमोरी में रहती है। एक इंस्टेंस का मतलब सच्ची सीमाएँ; कई इंस्टेंस पर चली होस्टेड तैनाती की छत नियम गुना चलते इंस्टेंस होती है, जो दीवार नहीं ब्रेक जैसी है।",

  // Audit log panel
  Action: "क्रिया",
  "Every action": "हर क्रिया",
  "Built from what has actually happened, not from a fixed list.":
    "जो असल में हुआ उससे बना है, किसी तय सूची से नहीं।",
  "By account id": "खाता आईडी से",
  "for example 12": "जैसे 12",
  Since: "तारीख़ से",
  "Reading the log": "लॉग पढ़ा जा रहा है",
  "The log would not load": "लॉग खुल नहीं सका",
  "Nothing recorded with this filter": "इस फ़िल्टर से कुछ दर्ज नहीं",
  "An empty log with no filter at all means nobody has changed anything from a screen or a shell since this table was created.":
    "बिना फ़िल्टर का खाली लॉग मतलब है कि यह टेबल बनने के बाद किसी ने स्क्रीन या शेल से कुछ नहीं बदला।",
  "{count} events, newest first": "{count} घटनाएँ, सबसे नई पहले",
  "What is not in a row: the value a field moved to beyond a resulting true or false, the text of a career entry, the content of a conversation, an IP address, a user agent, or a device string. Reading the log is not logged — an operator looking at the record of the last six months is not an action anybody needs to explain later.":
    "एक पंक्ति में क्या नहीं है: किसी फ़ील्ड का नया मान (true या false के नतीजे के अलावा), करियर एंट्री का टेक्स्ट, बातचीत का ब्योरा, IP पता, यूज़र एजेंट, या डिवाइस स्ट्रिंग। लॉग पढ़ना लॉग नहीं होता — ऑपरेटर पिछले छह महीने का रिकॉर्ड देख रहा हो, यह कोई ऐसा काम नहीं जिसकी बाद में किसी को सफ़ाई देनी पड़े।",
  "no detail": "कोई ब्योरा नहीं",
  "the shell": "शेल",
  "from a shell, not a page": "शेल से, पेज से नहीं",

  // ======================================================== study abroad lead desk

  // Screen body and the three tabs
  "Study abroad — operator": "विदेश में पढ़ाई — ऑपरेटर",
  "Enquiries, the university directory, and the stories. The three tables that hold what a family reads and what they told us.":
    "पूछताछ, यूनिवर्सिटी डायरेक्टरी, और कहानियाँ। ये तीन टेबल रखती हैं कि एक परिवार क्या पढ़ता है और उसने हमें क्या बताया।",
  "Checking this account": "इस खाते की जाँच की जा रही है",
  "This screen is not open to this account": "यह स्क्रीन इस खाते के लिए खुली नहीं है",
  "The server could not be reached, so it could not say whether this account is the operator's.":
    "सर्वर से संपर्क नहीं हो सका, इसलिए यह नहीं कहा जा सका कि यह खाता ऑपरेटर का है या नहीं।",
  "Only the account holding the is_admin flag may read enquiries or edit the directory. That flag is not something a screen or a signup can set.":
    "सिर्फ़ वह खाता जिसके पास is_admin फ़्लैग है, पूछताछ पढ़ या डायरेक्टरी बदल सकता है। यह फ़्लैग स्क्रीन या साइनअप से नहीं लगाया जा सकता।",
  "On the server, run": "सर्वर पर चलाएँ",
  "for the confirmed address this account signs in with, then reload this page. Pass":
    "इस खाते के पुष्टि किए गए पते के लिए, फिर यह पेज फिर से लोड करें। वापस लेने के लिए",
  "to take it back.": "लगाएँ।",
  "The public pages": "सार्वजनिक पेज",
  "See the public pages": "सार्वजनिक पेज देखें",
  Universities: "यूनिवर्सिटियाँ",
  Stories: "कहानियाँ",

  // Enquiry row
  "Could not be saved.": "सेव नहीं हो सका।",
  "Could not be deleted.": "डिलीट नहीं हो सका।",
  Handle: "जवाब दें",
  "Asked on": "पूछा गया",
  "from {source}": "{source} से",
  "consent to be contacted recorded": "संपर्क की अनुमति दर्ज",
  "NOT RECORDED": "दर्ज नहीं",
  "last handled": "आख़िरी बार देखा",
  Status: "स्थिति",
  "New — nobody has replied": "नया — किसी ने जवाब नहीं दिया",
  "Contacted — we have written back": "संपर्क किया — हमने वापस लिखा है",
  "Closed — nothing further": "बंद — इससे आगे कुछ नहीं",
  "Note for whoever reads this next": "आगे जो भी पढ़े उसके लिए नोट",
  "What was agreed, and what is still owed.": "क्या तय हुआ, और क्या अभी बाकी है।",
  "Delete the record": "रिकॉर्ड हटाएँ",
  "Deleting removes the row entirely: the address, the message and the consent timestamp with it. That is the answer to a request to be forgotten, and there is no undo on this screen.":
    "डिलीट करने पर पूरी पंक्ति हट जाती है: पता, संदेश और अनुमति का समय भी। भूलने की रिक्वेस्ट का यही जवाब है, और इस स्क्रीन पर वापस लाने का कोई तरीका नहीं है।",
  "Loading enquiries": "पूछताछ लोड हो रही है",
  "Search enquiries": "पूछताछ खोजें",
  "name or address": "नाम या पता",
  "No enquiry has arrived": "कोई पूछताछ नहीं आई",
  "Nothing matches this filter. The unfiltered list is the number to trust.":
    "इस फ़िल्टर से कुछ नहीं मिला। बिना फ़िल्टर वाली सूची ही सही गिनती है।",
  "The public form at /study-abroad is the only thing that writes here. An empty table means nobody has asked yet — which is the honest state, not a loading one.":
    "/study-abroad का सार्वजनिक फ़ॉर्म ही यहाँ लिखता है। खाली टेबल का मतलब है कि अब तक किसी ने नहीं पूछा — यह सच्ची स्थिति है, लोडिंग की नहीं।",

  // University editor
  "Nothing had changed, so nothing was written.": "कुछ बदला नहीं था, इसलिए कुछ लिखा नहीं गया।",
  "Saved, and the verification date was stamped by the server for today.":
    "सेव हो गया, और सत्यापन की तारीख सर्वर ने आज की मुहर लगा दी।",
  "Saved.": "सेव हो गया।",
  "The row could not be saved.": "पंक्ति सेव नहीं हो सकी।",
  City: "शहर",
  "Official URL": "आधिकारिक URL",
  "One-line description": "एक पंक्ति का विवरण",
  "Tuition, read from the university's own page": "ट्यूशन फ़ीस, यूनिवर्सिटी की अपनी पेज से पढ़ी गई",
  "Leave empty until you have read the figure. The public page then prints 'not verified yet'.":
    "जब तक आँकड़ा न पढ़ लें, खाली छोड़ें। तब सार्वजनिक पेज पर 'अभी सत्यापित नहीं' दिखेगा।",
  "Intakes (comma separated)": "प्रवेश महीने (कॉमा से अलग)",
  "September, January": "सितंबर, जनवरी",
  "English test requirement": "अंग्रेज़ी टेस्ट की शर्त",
  "Application deadline": "आवेदन की आख़िरी तारीख",
  "Source URL — the page you read this from": "स्रोत URL — जिस पेज से आपने यह पढ़ा",
  "Verified on {date}. Clearing this link while the row is verified is refused.":
    "{date} को सत्यापित। पंक्ति सत्यापित रहते यह लिंक हटाना मंज़ूर नहीं है।",
  "Without a source here, the verified tick below cannot be set.":
    "यहाँ स्रोत के बिना नीचे का सत्यापन टिक नहीं लगाया जा सकता।",
  "Verified against the source": "स्रोत से मिलाकर सत्यापित",
  "The server stamps the date and refuses this without a source URL.":
    "सर्वर तारीख मुहर करता है और बिना स्रोत URL के इसे मना करता है।",
  "This is a paid listing": "यह एक सशुल्क लिस्टिंग है",
  "A university that pays is stated as paying wherever it appears.":
    "पैसे देने वाली यूनिवर्सिटी को जहाँ-जहाँ वह दिखती है, वहाँ-वहाँ सशुल्क बताया जाता है।",

  // Universities panel
  "Loading the directory": "डायरेक्टरी लोड हो रही है",
  "Only rows with nothing verified": "सिर्फ़ वे पंक्तियाँ जिनका कुछ भी सत्यापित नहीं",
  Country: "देश",
  "Every destination": "हर गंतव्य",
  "Search universities": "यूनिवर्सिटी खोजें",
  "name or city": "नाम या शहर",
  "{count} row{s} shown": "{count} पंक्ति दिखाई गई",
  "that are still unverified": "जो अभी भी असत्यापित हैं",
  "That is one answer, not the whole directory — narrow it by destination or by name before counting what is left.":
    "यह एक जवाब है, पूरी डायरेक्टरी नहीं — बची हुई गिनती करने से पहले इसे गंतव्य या नाम से सीमित करें।",
  "The seed wrote a name, a city, a funding type and a domain — nothing else. Every field below that is empty prints to the public as “not verified yet”, and it stays that way until a person reads the figure and records where.":
    "सीड ने बस एक नाम, एक शहर, एक फंडिंग प्रकार और एक डोमेन लिखा — इतना ही। नीचे की हर खाली फ़ील्ड सार्वजनिक रूप पर 'अभी सत्यापित नहीं' दिखती है, और वैसी ही रहेगी जब तक कोई इंसान आँकड़ा न पढ़ ले और कहाँ से पढ़ा दर्ज न कर दे।",
  "Nothing matches this filter": "इस फ़िल्टर से कुछ नहीं मिला",
  "Turn off the unverified-only box to see the whole directory, or add a university below.":
    "पूरी डायरेक्टरी देखने के लिए सिर्फ़-असत्यापित बॉक्स बंद करें, या नीचे एक यूनिवर्सिटी जोड़ें।",
  "Paid listing": "सशुल्क लिस्टिंग",
  "Verified {date}": "{date} को सत्यापित",
  Unverified: "असत्यापित",

  // Story editor and stories panel
  "Added as a draft.": "ड्राफ़्ट के रूप में जोड़ा गया।",
  "The story could not be saved.": "कहानी सेव नहीं हो सकी।",
  Headline: "शीर्षक",
  "What the student says happened": "विद्यार्थी के मुताबिक क्या हुआ",
  "The story, in their words": "कहानी, उनके अपने शब्दों में",
  "Write what they said, not what it proves. No outcome is promised by quoting one family.":
    "जो उन्होंने कहा वही लिखें, यह नहीं कि इससे क्या साबित होता है। एक परिवार का हवाला देकर कोई नतीजे का वादा नहीं किया जाता।",
  "Named as": "इस नाम से",
  "Riya, class of 2026": "रिया, 2026 बैच",
  "However they asked to be named. Nothing that locates them.":
    "जैसा उन्होंने खुद को बुलाने को कहा वैसा। ऐसा कुछ जो उनका पता बता दे।",
  "Year (optional)": "साल (ज़रूरी नहीं)",
  "Which destination this is about": "यह किस गंतव्य के बारे में है",
  "None — a general account": "कोई नहीं — एक आम बयान",
  "It links the story to a country page. A story needs no destination to be true.":
    "यह कहानी को देश के पेज से जोड़ता है। सच्ची कहानी के लिए कोई गंतव्य ज़रूरी नहीं।",
  "They agreed to this being published on": "इन्होंने इसे प्रकाशित करने की अनुमति दी",
  "A story cannot go public without this date. It is the day they said yes, not today's date.":
    "इस तारीख के बिना कहानी सार्वजनिक नहीं हो सकती। यह वह दिन है जब इन्होंने हाँ कहा, आज की तारीख नहीं।",
  "Published on the public pages": "सार्वजनिक पेज पर प्रकाशित",
  "Add as draft": "ड्राफ़्ट के रूप में जोड़ें",
  "A published story appears on /study-abroad. Withdraw it by clearing the tick; the words stay until the family asks for them to be deleted, and deletion here removes the row completely.":
    "प्रकाशित कहानी /study-abroad पर दिखती है। टिक हटाकर उसे वापस ले लें; शब्द तब तक रहते हैं जब तक परिवार उन्हें हटाने को न कहे, और यहाँ डिलीट करने पर पंक्ति पूरी हट जाती है।",
  "Loading stories": "कहानियाँ लोड हो रही हैं",
  "This table starts empty and stays empty until a named person agrees. Nothing here can invent a story, and the public page says there are none rather than showing a quote nobody wrote.":
    "यह टेबल खाली शुरू होती है और तब तक खाली रहती है जब तक कोई नाम वाला इंसान राज़ी न हो। यहाँ कोई कहानी गढ़ी नहीं जा सकती, और सार्वजनिक पेज झूठा हवाला दिखाने के बजाय यही कहता है कि कोई कहानी नहीं है।",
  "Add a story": "कहानी जोड़ें",
  "No story has been recorded": "कोई कहानी दर्ज नहीं हुई",
  "Add one only when somebody has agreed to being named, and note the date they said so.":
    "तभी जोड़ें जब किसी ने नाम लिए जाने की अनुमति दी हो, और उस दिन की तारीख दर्ज करें जब इन्होंने हाँ कहा।",
  consent: "अनुमति",
  Published: "प्रकाशित",
  Draft: "ड्राफ़्ट",
};
