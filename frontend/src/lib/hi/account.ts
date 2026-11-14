/**
 * Hindi for the account screens: the optional email sign-in and the profile page.
 *
 * Keys are the English source text, so an untranslated string still renders — in
 * English — instead of vanishing from a child's screen.
 */

export const HI: Record<string, string> = {
  "Email sign-in is not switched on for this site":
    "इस साइट पर ईमेल से साइन इन अभी चालू नहीं है",
  "Nobody needs it to use CareerGuide AI. The work on this device is the account: close the tab, come back tomorrow, and everything is still here.":
    "करियरगाइड AI चलाने के लिए किसी को इसकी ज़रूरत नहीं है। इस डिवाइस पर मौजूद काम ही आपका अकाउंट है: टैब बंद करें, कल वापस आइए — सब कुछ पहले जैसा मिलेगा।",
  "Whoever runs this site can switch it on: set CLERK_SECRET_KEY on the backend, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY here, and point Clerk's webhook at /api/webhooks/clerk. Until all three are in place, this page says so instead of pretending to work.":
    "साइट चलाने वाला इसे चालू कर सकता है: बैकएंड पर CLERK_SECRET_KEY, यहाँ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, और Clerk का webhook /api/webhooks/clerk पर जोड़कर। ये तीनों न होने तक यह पन्ना साफ़-साफ़ बताता है कि यह सुविधा चालू नहीं है, काम करता हुआ दिखाता नहीं।",
  "Continue without an email": "बिना ईमेल आगे बढ़ें",
  "Open settings": "सेटिंग्स खोलें",
  "Clerk did not hand over a session, so nothing was opened. Please sign in again.":
    "Clerk ने सत्र नहीं दिया, इसलिए कुछ नहीं खुला। कृपया दोबारा साइन इन करें।",
  "Something went wrong while opening your work. Nothing was lost.":
    "आपका काम खोलते समय कुछ गड़बड़ हुई। कुछ भी नहीं मिटा।",
  "Your email sign-in could not open anything": "आपके ईमेल साइन इन से कुछ नहीं खुल सका",
  "Sign in again": "दोबारा साइन इन करें",
  "Checking your email sign-in…": "आपका ईमेल साइन इन देख रहे हैं…",
  "No email sign-in finished": "कोई ईमेल साइन इन पूरा नहीं हुआ",
  "This page opens the work that belongs to the email you signed in with. Right now there is no email signed in here, so there is nothing to open — and nothing on this device was changed.":
    "यह पन्ना उस ईमेल का काम खोलता है जिससे आप साइन इन करते हैं। अभी यहाँ कोई ईमेल साइन इन नहीं है, इसलिए खोलने के लिए कुछ नहीं है — और इस डिवाइस पर भी कुछ नहीं बदला।",
  "Sign in with an email": "ईमेल से साइन इन करें",
  "Opening your work…": "आपका काम खोल रहे हैं…",

  // The connect screen: adding an email to the account this browser already holds.
  "Connect an email": "ईमेल जोड़ें",
  "Connecting your email to this account…": "आपका ईमेल इस अकाउंट से जोड़ रहे हैं…",
  "Email connected": "ईमेल जुड़ गया",
  "The email could not be connected": "ईमेल जोड़ा नहीं जा सका",
  "Back to settings": "सेटिंग्स पर वापस",
  "Open my profile": "मेरी प्रोफ़ाइल खोलें",
  "Start here": "यहाँ से शुरू करें",
  "This browser has no work to attach an email to yet": "इस ब्राउज़र में अभी जोड़ने जैसा कोई काम नहीं है",
  "Clerk did not hand over a session, so nothing was connected. Please try again.":
    "Clerk ने सत्र नहीं दिया, इसलिए कुछ जोड़ा नहीं गया। कृपया दोबारा कोशिश करें।",
  "The server could not be reached. Nothing was changed on this account.":
    "सर्वर से बात नहीं हो सकी। इस अकाउंट में कुछ नहीं बदला।",
  "Sign in with the email you want to use, or make one now. This only labels the work already on this device — it does not move anything, and nothing is deleted. Disconnecting it later returns you to exactly this screen's starting point.":
    "जिस ईमेल से चाहें साइन इन करें, या अभी नया बनाएँ। इससे सिर्फ़ इस डिवाइस के काम को पहचान मिलती है — कुछ हटता नहीं और कुछ नहीं बदलता। बाद में ईमेल अलग कर दें तो यह फिर पहले जैसा हो जाएगा।",
  "Connecting an email does not create an account — it labels the one already on this device, so the same conversations and saved careers can be opened elsewhere. Answer the first question to start, then come back here to add the email.":
    "ईमेल जोड़ने से नया अकाउंट नहीं बनता — यह इस डिवाइस वाले अकाउंट को ही पहचान देता है, ताकि वही बातचीत और सेव किए करियर कहीं और भी खुल सकें। पहले सवाल का जवाब देकर शुरू करें, फिर ईमेल जोड़ने यहाँ वापस आएं।",

  // The settings list, now shared with the profile screen.
  "Language and voice": "भाषा और आवाज़",
  "My profile": "मेरी प्रोफ़ाइल",
  "My account": "मेरा अकाउंट",
  "Account and email sign-in": "अकाउंट और ईमेल साइन इन",
  "How this account is held, what you can add to it, and what it does not have.":
    "यह अकाउंट कैसे सहेजा जाता है, आप इसमें क्या जोड़ सकते हैं, और इसमें क्या नहीं है।",
  "No adults are linked": "कोई अभिभावक लिंक नहीं है",
  "Nobody outside your account can see anything. If you later want a parent to see your exploration summary, share the code above with them.":
    "अपने खाते के बाहर कोई कुछ नहीं देख सकता। अगर बाद में किसी अभिभावक को अपनी खोज का सारांश दिखाना हो, तो ऊपर दिया कोड उनके साथ शेयर करें।",
  "Privacy, consent and display": "प्राइवेसी, सहमति और दिखने का तरीका",
  "Family access": "परिवार की पहुँच",
  "This device": "यह डिवाइस",
  "About this build": "इस बिल्ड के बारे में",
  "Student account": "विद्यार्थी खाता",
  "Parent account · sees only what a child shares":
    "अभिभावक खाता · सिर्फ़ वही दिखता है जो बच्चा साझा करे",
  "There is nothing to sign out of": "साइन आउट करने के लिए कुछ नहीं है",
  "This browser is the account, so just close the tab — everything will be waiting next time you open it from here. Use start over only if somebody else will use this device.":
    "यही ब्राउज़र आपका अकाउंट है, इसलिए टैब बंद कर दें — अगली बार यहाँ से खोलने पर सब कुछ वैसा ही मिलेगा। नए सिरे से शुरू करना तभी चुनें जब यह डिवाइस कोई और इस्तेमाल करने वाला हो।",
  "How this works": "यह कैसे काम करता है",
  "reads replies aloud": "जवाब बोलकर सुनाता है",
  silent: "चुप",
  "hands-free on": "हैंड्स-फ्री चालू",
  "tap to speak": "बोलने के लिए टैप करें",
  "{count} interests": "{count} रुचि",
  "A parent account holds no class, age or interests":
    "अभिभावक के खाते में कक्षा, उम्र या रुचियाँ नहीं होतीं",
  "Checking whether an email is connected…": "जाँचा जा रहा है कि ईमेल जुड़ा है या नहीं…",
  "Connected — this work also opens where you sign in with that email":
    "जुड़ा हुआ — वही काम उस ईमेल से साइन इन करने पर भी खुलेगा",
  "Not connected — this browser is still the only way in":
    "जुड़ा नहीं — अभी भी यही ब्राउज़र अंदर जाने का एकमात्र रास्ता है",
  "Checking your consent…": "आपकी अनुमति जाँची जा रही है…",
  "{granted} of {total} consents given": "दी गई अनुमतियाँ: {total} में से {granted}",
  "history saved": "इतिहास सहेजा जाता है",
  "history not saved": "इतिहास सहेजा नहीं जाता",
  "Checking linked adults…": "लिंक किए गए अभिभावक जाँचे जा रहे हैं…",
  "No adult can see your summary": "कोई अभिभावक आपका सारांश नहीं देख सकता",
  "{count} adults can see your summary": "{count} अभिभावक आपका सारांश देख सकते हैं",
  "No login — this browser is what remembers your work":
    "कोई लॉगिन नहीं — आपका काम इसी ब्राउज़र में याद रहता है",
  "{count} honest limitations, in plain words": "सीड़े शब्दों में {count} ईमानदार सीमाएँ",
  "What this account does not have": "इस अकाउंट में क्या नहीं है",
  "Storage and appearance": "संग्रहण और दिखने का तरीका",

  // The theme switch, which is the third device-local control in that block.
  Theme: "थीम",
  Light: "लाइट",
  Dark: "डार्क",
  System: "सिस्टम",
  "This changes light and dark on this device only, and it stays as you left it. System follows whatever your phone or browser is set to, including when it changes by itself in the evening.":
    "यह लाइट-डार्क सिर्फ़ इस डिवाइस पर बदलता है, और जैसा आप रखेंगे वैसा ही रहेगा। «सिस्टम» चुनने पर यह आपके फ़ोन या ब्राउज़र की अपनी सेटिंग के साथ चलता है — शाम को वह अपने-आप बदले तो भी।",
  "Switch to dark theme": "डार्क थीम पर जाएँ",
  "Switch to light theme": "लाइट थीम पर जाएँ",
  "Consent records": "अनुमति के रिकॉर्ड",
  "Sharing code": "शेयरिंग कोड",
  "Adults who can see your summary": "वे अभिभावक जो आपका सारांश देख सकते हैं",
  "Profile": "प्रोफ़ाइल",
  "Each line opens one part of this account. Everything here is yours to change.":
    "हर लाइन इस अकाउंट का एक हिस्सा खोलती है। यहाँ सब बदलना आपकी मर्ज़ी है।",

  // The Settings directory and the seven pages it opens.
  "Manage your account and preferences in one place.":
    "अपना अकाउंट और पसंद एक ही जगह संभालें।",
  "Settings sections": "सेटिंग्स के हिस्से",
  "Language & Voice": "भाषा और आवाज़",
  "Manage your preferred language and voice.":
    "अपनी पसंदीदा भाषा और आवाज़ संभालें।",
  "My Profile": "मेरी प्रोफ़ाइल",
  "Update your personal information and interests.":
    "अपनी व्यक्तिगत जानकारी और रुचियाँ अपडेट करें।",
  "Account & Sign-in": "अकाउंट और साइन-इन",
  "Manage your account and login security.":
    "अपना अकाउंट और लॉगिन सुरक्षा संभालें।",
  "Privacy & Consent": "प्राइवेसी और सहमति",
  "Control your personal data and privacy.":
    "अपना व्यक्तिगत डेटा और प्राइवेसी नियंत्रित करें।",
  "Family Access": "परिवार की पहुँच",
  "Manage parent or guardian access.":
    "अभिभावक या संरक्षक की पहुँच संभालें।",
  "Family access belongs to a student account. A parent account does not hold a sharing code or links — those are created and controlled by the student whose summary they are about.":
    "परिवार की पहुँच विद्यार्थी के खाते की बात है। अभिभावक के खाते में शेयरिंग कोड या लिंक नहीं होते — वे उसी विद्यार्थी बनाता और संभालता है जिसका सारांश उनसे जुड़ा है।",
  "This Device": "यह डिवाइस",
  "Manage your current device and browser.":
    "अपना यह डिवाइस और ब्राउज़र संभालें।",
  "About CareerGuide AI": "CareerGuide AI के बारे में",
  "Learn about the platform, features and support.":
    "प्लेटफ़ॉर्म, सुविधाओं और सहायता के बारे में जानें।",
  "Honest limitations": "ईमानदार सीमाएँ",
  "Support": "सहायता",
  "Contact us": "हमसे संपर्क करें",
  "Ask a question or report something that looks wrong.":
    "कोई सवाल पूछें या गलत लगने वाली बात बताएँ।",
  "Privacy policy": "प्राइवेसी नीति",
  "What this build stores and why.":
    "यह बिल्ड क्या सहेजता है और क्यों।",
  "Terms of use": "उपयोग की शर्तें",
  "The rules this build is offered under.":
    "जिन नियमों के तहत यह बिल्ड दिया गया है।",
  "How you are recognised": "आपको कैसे पहचाना जाता है",

  // The profile screen.
  "This is what your account says about you. Every line came from an answer you gave — nothing here is a score, a ranking or a guess.":
    "यही आपका अकाउंट आपके बारे में कहता है। हर लाइन आपके ही दिए जवाब से आई है — यहाँ न स्कोर है, न रैंक, न अनुमान।",
  "Edit": "बदलें",
  "Class": "कक्षा",
  "Class not set": "कक्षा नहीं बताई",
  "Not set yet": "अभी नहीं बताया",
  "Age": "उम्र",
  "e.g. 14": "जैसे 14",
  "Type it in years, the way it is written on your school card.":
    "सालों में लिखें, जैसे आपके स्कूल के कार्ड पर लिखा है।",
  "Type your age as a whole number between 3 and 99.":
    "अपनी उम्र 3 से 99 के बीच पूर्ण संख्या में लिखें।",
  "{years} years old": "{years} वर्ष",
  "Age not set yet": "उम्र अभी नहीं बताई",
  "Replies in": "जवाब इस भाषा में",
  "The guide follows whichever language you type or speak in":
    "आप जिस भाषा में लिखें या बोलें, गाइड उसी में जवाब देता है",
  "Career interests": "करियर की रुचियाँ",
  "Nothing marked yet. Add a few in Settings, or just talk about what you enjoy — the guide notes what it hears.":
    "अभी कुछ भी नहीं चुना। सेटिंग्स में कुछ जोड़ें, या बस अपनी पसंद की बात करें — गाइड सुनी हुई बात नोट कर लेता है।",
  "Opened by your email sign-in, and by this browser": "आपके ईमेल साइन इन से भी खुलता है, इस ब्राउज़र से भी",
  "This browser is the account — no email, no password": "यही ब्राउज़र आपका अकाउंट है — न ईमेल, न पासवर्ड",
  "Assessment history": "असेसमेंट का रिकॉर्ड",
  "Each row is a set of questions you finished. Open one to read the result again, or turn it into a PDF.":
    "हर लाइन सवालों का वह सेट है जो आपने पूरा किया। खोलकर दोबारा पढ़ें, या इसका PDF बनाएँ।",
  "Take an assessment": "असेसमेंट करें",
  "Reading your finished assessments…": "आपके पूरे किए असेसमेंट देख रहे हैं…",
  "Your assessment history could not load": "आपका असेसमेंट रिकॉर्ड नहीं खुल सका",
  "{answered} of {total} answers": "{total} में से {answered} जवाब दिए",
  "No assessment finished yet": "अभी कोई असेसमेंट पूरा नहीं हुआ",
  "An assessment is a short set of questions about what you enjoy and what you find easy. It never gives a verdict on you.":
    "असेसमेंट सवालों का छोटा सेट है — आपको क्या पसंद है और क्या आसान लगता है। यह आपपर कभी फ़ैसला नहीं सुनाता।",
  "See the three assessments": "तीनों असेसमेंट देखें",
  "Your email sign-in status could not be checked.": "आपका ईमेल साइन इन चेक नहीं हो सका।",
  "Taking you to your dashboard…": "आपको आपके डैशबोर्ड पर ले जा रहे हैं…",
  "Delete this account": "यह अकाउंट हटाएँ",
  "Erases what this account holds on the server — the messages, the assessments and their answers, the reports, the plans, the saved careers, the resume you wrote, the settings and every session on every device. Not everything goes: the dialog lists, before you press anything, exactly which few records stay and why.":
    "इस अकाउंट पर सर्वर में जो-जो है वह मिट जाएगा — संदेश, असेसमेंट और उनके जवाब, रिपोर्ट, प्लान, सहेजे गए करियर, आपका लिखा हुआ रिज़्यूमे, सेटिंग्स, और हर डिवाइस पर चल रहा सत्र। पर सब कुछ नहीं जाएगा: कोई बटन दबाने से पहले डायलॉग बताता है कि कौन-से रिकॉर्ड बचेंगे और क्यों।",
  "Delete account": "अकाउंट डिलीट करें",
  "Delete this account for good?": "यह अकाउंट हमेशा के लिए हटाएँ?",
  "There is no undo, and there is no email to confirm with: this browser's session is the only proof of whose account this is. That is why this dialog is the last step.":
    "इसके बाद वापस नहीं होगा, और पुष्टि के लिए कोई ईमेल भी नहीं भेजा जाता: यह ब्राउज़र जिस सत्र से जुड़ा है, वही इस बात का अकेला सबूत है कि अकाउंट किसका है। इसीलिए यह डायलॉग आख़िरी कड़ी है।",
  "Keep my work": "मेरा काम रहने दें",
  "Delete it": "हटा दें",
  "Gone from the database": "डेटाबेस से जो जाएगा",
  "Every conversation and every message in it, including anything you asked by voice.":
    "हर बातचीत और उसके अंदर का हर संदेश, जिसमें आपकी आवाज़ से पूछी गई हर बात भी शामिल है।",
  "Your assessments: the sittings, the answers and the results scored from them.":
    "आपके असेसमेंट: कितनी बार किए, कौन-से जवाब दिए और उनसे बना स्कोर।",
  "The reports — the career report and any PDF that was generated from it.":
    "रिपोर्ट — करियर रिपोर्ट और उससे बनी कोई भी PDF।",
  "Study plans, journey counts, interest observations, saved careers and recommendations.":
    "पढ़ाई के प्लान, सफ़र की गिनतियाँ, दिलचस्पी के नोट, सहेजे गए करियर और सुझाव।",
  "The resume you wrote — the job title, the class rows, the skills and projects, as one document.":
    "आपका लिखा हुआ रिज़्यूमे — पद-नाम, कक्षा की पंक्तियाँ, स्किल और प्रोजेक्ट — एक ही दस्तावेज़ के रूप में।",
  "Your profile, your settings, every consent you recorded, and any family or portal link.":
    "आपकी प्रोफ़ाइल, आपकी सेटिंग्स, आपके द्वारा दर्ज हर सहमति, और परिवार या पोर्टल से जुड़ा हर लिंक।",
  "Every session on every device, so a second laptop signed in to this account stops working too.":
    "हर डिवाइस पर चल रहा हर सत्र — इसलिए इस अकाउंट से लगी दूसरी लैपटॉप भी काम करना बंद कर देगी।",
  "Stays, and why": "जो बचेगा, और क्यों",
  "The record of a payment you made or were refunded. A money ledger has to outlive the person it is about.":
    "आपने किया भुगतान या आपको जो रिफ़ंड मिला, उसका रिकॉर्ड। पैसे की बहीखाता-गणित को उस व्यक्ति के बाद भी टिकना ज़रूरी है जिसके बारे में यह है।",
  "The operator log. This erasure is written in it, without your name attached.":
    "ऑपरेटर का लॉग। इस मिटाने की एक पंक्ति उसमें रहेगी, लेकिन आपके नाम के बिना।",
  "The row that used to be your account, holding nothing but the date it was erased on.":
    "आपके अकाउंट की कतार, जिसमें अब सिर्फ़ उस तारीख़ का नोट है कि यह कब मिटाई गई।",
  "This is the app's own erasure step. Whether it satisfies a particular law is a question for whoever runs the site and their own adviser — a button here cannot claim that answer, and this page does not try to.":
    "यह ऐप का अपना मिटाने का कदम है। कोई ख़ास क़ानूनी ज़रूरत पूरी होती है या नहीं — यह सवाल साइट चलाने वाले और उनके क़ानूनी सलाहकार का है, और एक बटन यह दावा नहीं कर सकता। यह पन्ना ऐसी कोशिश भी नहीं करता।",
  "If this account is the one that runs the site, the server refuses and says why: an operator is closed by another operator, so the log keeps saying who stopped being able to change things.":
    "अगर यह अकाउंट साइट चलाने वाला है, तो सर्वर मना करेगा और कारण भी बताएगा: ऑपरेटर का अकाउंट दूसरा ऑपरेटर ही बंद करे, ताकि लॉग में यह बात बची रहे कि किसके बदलने के अधिकार ख़त्म हुए।",
  "Not set": "सेट नहीं है",
  "How the guide speaks and listens to you.": "गाइड आपसे कैसे बोलता और सुनता है।",
  "Reply language": "जवाब की भाषा",
  "Voice list could not load": "आवाज़ों की सूची नहीं लोड हो सकी",
  "Use the default voice": "डिफ़ॉल्ट आवाज़ इस्तेमाल करें",
  "Replies are read aloud by the server's speech service — the one named just below — and by your browser's own voice if that fails. Either way it is not a human voice, and the words stay on screen.": "जवाब सर्वर की स्पीच सर्विस से ज़ोर से पढ़े जाते हैं — जिसका नाम ठीक नीचे है — और वह न चले तो आपके ब्राउज़र की अपनी आवाज़ से। दोनों तरह से यह इंसानी आवाज़ नहीं है, और शब्द स्क्रीन पर रहते हैं।",
  "Keeps listening during an open call so you do not tap each turn. It never listens between calls, and nothing is recorded.": "खुली कॉल के दौरान सुनता रहता है, ताकि हर बार टैप न करना पड़े। कॉल के बीच कभी नहीं सुनता, और कुछ भी रिकॉर्ड नहीं होता।",
  "Server status unknown": "सर्वर की स्थिति पता नहीं",
  "Display name": "दिखने वाला नाम",
  "What gets stored, what you have agreed to, and how to erase it.": "क्या सेव होता है, आपने किस बात की सहमति दी है, और उसे मिटाना कैसे है।",
  "Save my conversation history": "मेरी बातचीत का इतिहास सेव करें",
  "If this is off, closing a conversation deletes its messages and the interest notes it produced.":
    "यह बंद हो तो बातचीत बंद करते ही उसके संदेश और उससे बने दिलचस्पी के नोट भी मिट जाते हैं।",
  "Turns off animations and transitions across the whole app.": "पूरे ऐप में एनिमेशन और ट्रांज़िशन बंद कर देता है।",
  "Darker text and stronger borders for easier reading.": "आसान पढ़ाई के लिए गहरा टेक्स्ट और मज़बूत बॉर्डर।",
  "Loading your consent records…": "आपके सहमति रिकॉर्ड लाए जा रहे हैं…",
  "A parent can only see a summary if you give them this code — they cannot attach by guessing. You can revoke it any time.": "अभिभावक को सार तभी दिखता है जब आप उन्हें यह कोड दें — अंदाज़े से वे नहीं जुड़ सकते। आप इसे कभी भी रद्द कर सकते हैं।",
  "This prototype has no login, so this browser is what your work belongs to.": "इस प्रोटोटाइप में लॉगिन नहीं है, इसलिए आपका काम इसी ब्राउज़र का है।",
  "Start over on this device?": "इस डिवाइस पर नए सिरे से शुरू करें?",
  "Start over on this device": "इस डिवाइस पर नए सिरे से शुरू करें",
  "This browser will be treated as somebody who has never been here.": "इस ब्राउज़र को ऐसा माना जाएगा जैसे यह पहली बार आया हो।",
  "Honest limitations, in plain words.": "ईमानदार सीमाएँ, सादे शब्दों में।",
  "Delete your conversation history?": "बातचीत का इतिहास मिटाएँ?",
  "Remove this adult's access?": "इस वयस्क की पहुँच हटाएँ?",

  // The redesigned settings screen: a category rail beside one open panel.
  Settings: "सेटिंग्स",
  "Settings categories": "सेटिंग्स की श्रेणियाँ",
  "Account and sign-in": "अकाउंट और साइन इन",
  "How this account is opened, what you can add to it, and what it does not have.":
    "यह अकाउंट कैसे खुलता है, आप इसमें क्या जोड़ सकते हैं, और इसमें क्या नहीं है।",
  "Choose how the guide speaks, and how it listens to you.":
    "चुनें कि गाइड आपसे कैसे बोले और सुने।",
  "Preferred language": "पसंदीदा भाषा",
  "How the guide opens the conversation. It answers in whatever language you actually use, and Hinglish mixes Hindi and English the way friends talk.":
    "गाइड बातचीत कैसे शुरू करे। जवाब वह उसी भाषा में देता है जिसमें आप बात करते हैं — हिंग्लिश में हिन्दी और अंग्रेज़ी दोस्तों की तरह मिली रहती हैं।",
  "Voice responses": "आवाज़ में जवाब",
  "Replies are read aloud — by the server's speech service when it answers, and by your browser's own voice if it does not. Either way it is not a human voice, and the words stay on screen.":
    "जवाब बोलकर सुनाए जाते हैं — जब सर्वर की स्पीच सेवा जवाब देती है तो उससे, और वह न हो तो आपके ब्राउज़र की अपनी आवाज़ से। दोनों ही इंसानी आवाज़ नहीं हैं, और शब्द स्क्रीन पर रहते हैं।",
  "Hands-free mode": "हैंड्स-फ्री मोड",
  "Unsaved changes": "बदलाव सहेजे नहीं गए",
  "All changes saved": "सारे बदलाव सहेजे गए",
  "Save Changes": "बदलाव सहेजें",
  "Voice and language settings saved.": "भाषा और आवाज़ की सेटिंग्स सहेज दी गईं।",
  "This changes the menus, buttons and page titles on this device, and it stays as you left it. Nothing else switches it — not even a Hindi conversation.":
    "यह इस डिवाइस पर मेन्यू, बटन और पेज शीर्षक बदलता है, और जैसा छोड़ेंगे वैसा ही रहेगा। कोई और चीज़ इसे नहीं बदलती — हिन्दी में हुई बातचीत भी नहीं।",
  "The voice that reads replies": "जवाब पढ़ने वाली आवाज़",
  "Voice — Hindi": "आवाज़ — हिन्दी",
  "Voice — English (also used for Hinglish)": "आवाज़ — अंग्रेज़ी (हिंग्लिश के लिए भी)",
  "Not available for your current reply language — switch the language above to pick from this set.":
    "आपकी मौजूदा जवाब-भाषा के लिए उपलब्ध नहीं — इस सेट से चुनने के लिए ऊपर भाषा बदलें।",
  "The server's voice": "सर्वर की आवाज़",
  "If you heard it, replies are spoken by the server in this browser.":
    "अगर आवाज़ सुनाई दी, तो इस ब्राउज़र में जवाब सर्वर से बोले जा रहे हैं।",
  "Your browser's own voice still reads replies aloud, and it sounds different.":
    "आपके ब्राउज़र की अपनी आवाज़ अब भी जवाब बोलकर सुनाती है, और वह अलग सुनाई देती है।",
  "Answers come from a built-in demo guide until an AI key is added on the server. The demo still walks you through real exploration — but replies are scripted samples.":
    "जब तक सर्वर पर AI की चाबी नहीं जुड़ती, जवाब एक बिल्ट-इन डेमो गाइड से आते हैं। डेमो फिर भी असली खोज में साथ चलता है — पर जवाब तैयार नमूने होते हैं।",
  "Google connected": "Google जुड़ा है",
  "email sign-in ready": "ईमेल साइन इन तैयार",
  "This browser is the only way in": "अंदर आने का एकमात्र रास्ता यही ब्राउज़र है",
  "The server could not say how this account opens": "सर्वर नहीं बता सका कि यह अकाउंट कैसे खुलता है",
  "No Google sign-in — this browser is what remembers your work":
    "कोई Google साइन इन नहीं — आपका काम इसी ब्राउज़र में याद रहता है",
  "Google can open this account · this browser is remembered too":
    "Google इस अकाउंट को खोल सकता है · यह ब्राउज़र भी याद रहता है",
  "Your email can open this account · this browser is remembered too":
    "आपका ईमेल इस अकाउंट को खोल सकता है · यह ब्राउज़र भी याद रहता है",
  "Danger zone": "सावधानी क्षेत्र",
  "Signing out is reversible. Deleting the account is not.":
    "साइन आउट करके वापस आ सकते हैं। अकाउंट मिटाने पर वह वापस नहीं आएगा।",
  "Sign out of this browser": "इस ब्राउज़र से साइन आउट करें",
  "Ends this session on the server and forgets this browser. The account itself stays; Google, or your email and password, is how you open it again. It does not sign you out of Google on this device.":
    "सर्वर पर यह सत्र ख़त्म करता है और यह ब्राउज़र भूल जाता है। अकाउंट खुद बना रहता है; इसे फिर खोलने का रास्ता Google या आपका ईमेल और पासवर्ड है। यह इस डिवाइस पर आपको Google से साइन आउट नहीं करता।",
  "Sign out": "साइन आउट",
  "Erases what this account holds on the server — the messages, the assessments and their answers, the reports, the plans, the saved careers, the resume you wrote, the settings and every session on every device. The dialog lists, before you press anything, which few records stay and why.":
    "इस अकाउंट का सर्वर पर रखा सब मिटा देता है — संदेश, असेसमेंट और उनके जवाब, रिपोर्ट, प्लान, सहेजे करियर, आपका लिखा रिज़्यूमे, सेटिंग्स और हर डिवाइस का हर सत्र। कोई बटन दबाने से पहले डायलॉग बताता है कि कौन-से कुछ रिकॉर्ड बचेंगे और क्यों।",

  // The role question that opens /get-started.
  "Log in": "लॉग इन करें",
  "Student": "विद्यार्थी",
  "Parent": "अभिभावक",
  "How would you like to use CareerGuide?": "आप CareerGuide का इस्तेमाल कैसे करना चाहेंगे?",
  "Choose Student or Parent. Next you can create an account or open one you already have.":
    "विद्यार्थी या अभिभावक चुनें। आगे आप नया अकाउंट बना सकते हैं या अपना पुराना खोल सकते हैं।",
  "For students in Classes 6–12": "कक्षा 6–12 के विद्यार्थियों के लिए",
  "For parents who want to support their child's journey":
    "उन अभिभावकों के लिए जो अपने बच्चे की यात्रा में साथ देना चाहते हैं",
  "Explore interests, subjects, strengths and careers.": "रुचियाँ, विषय, ताकत और करियर खोजें।",
  "Talk in Hindi, English or Hinglish — typing always works.":
    "हिन्दी, अंग्रेज़ी या हिंग्लिश में बात करें — टाइप करना हमेशा चलता है।",
  "Keep your own reports, recommendations and next steps.":
    "अपनी रिपोर्ट, सुझाव और अगले कदम अपने पास रखें।",
  "Understand the career options your child is exploring.":
    "समझें कि आपका बच्चा किन करियर विकल्पों को देख रहा है।",
  "Support decisions with cost-aware, pressure-free guidance.":
    "खर्च का ध्यान रखते हुए, बिना दबाव के फ़ैसलों में साथ दें।",
  "See only what your child agrees to share.": "सिर्फ़ वही देखें जो आपका बच्चा साझा करना चाहे।",
  "Selected: Student. Continue below.": "चुना गया: विद्यार्थी। नीचे आगे बढ़ें।",
  "Selected: Parent. Continue below.": "चुना गया: अभिभावक। नीचे आगे बढ़ें।",
  "Choose one to continue.": "आगे बढ़ने के लिए एक चुनें।",
  "Create a student account": "विद्यार्थी अकाउंट बनाएँ",
  "Create a parent account": "अभिभावक अकाउंट बनाएँ",
  "I already have a code": "मेरे पास पहले से कोड है",
  "Create an account": "अकाउंट बनाएँ",
  "Your choice only sets up the right experience. Your account's real role, checked by the server, decides which dashboard opens — and a parent is never linked to a student without the student's sharing code and consent.":
    "आपका चुनाव सिर्फ़ सही अनुभव तय करता है। कौन-सा डैशबोर्ड खुलेगा, यह सर्वर से जाँची गई आपके अकाउंट की असली भूमिका तय करती है — और विद्यार्थी का शेयरिंग कोड और सहमति के बिना कोई अभिभावक उससे जुड़ नहीं सकता।",
  "New to CareerGuide?": "CareerGuide पर नए हैं?",
  "Explore careers first": "पहले करियर देखें",

  "Selected role:": "चुनी गई भूमिका:",
  "the account decides the dashboard": "डैशबोर्ड अकाउंट तय करता है",
  "Opening your dashboard…": "आपका डैशबोर्ड खोल रहे हैं…",
  "Something went wrong while opening the account. Please try again.":
    "अकाउंट खोलते समय कुछ गड़बड़ हुई। कृपया दोबारा कोशिश करें।",
  "Back to home": "होम पर वापस",
  "Checking how this account can be opened…": "जाँच रहे हैं कि यह अकाउंट कैसे खुल सकता है…",
  "Email not connected": "ईमेल नहीं जुड़ा",
  "No email sign-in": "ईमेल साइन इन नहीं",
  Copy: "कॉपी करें",
  Copied: "कॉपी हो गया",
  "Switch between light and dark theme": "लाइट और डार्क थीम के बीच बदलें",

  // The redesigned profile: the identity hero, read-only details, history and account.
  "Student identity": "विद्यार्थी पहचान",
  "Academic profile": "पढ़ाई की प्रोफ़ाइल",
  "Personal & academic details": "निजी और पढ़ाई की जानकारी",
  "Read from the answers on this account, and shown exactly as you gave them.":
    "यह सब इस अकाउंट पर दिए गए आपके जवाबों से पढ़ा गया है, और वैसा ही दिखाया गया है जैसा आपने बताया।",
  "School setting": "स्कूल की स्थिति",
  "Cost situation": "खर्च की स्थिति",
  "Not added yet": "अभी नहीं जोड़ा",
  History: "इतिहास",
  "Read result": "नतीजा पढ़ें",
  Account: "अकाउंट",
  "Account & sign-in": "अकाउंट और साइन इन",
  "How this account is held, and the ways back into it.":
    "यह अकाउंट कैसे सहेजा जाता है, और इसमें वापस आने के कौन-से रास्ते हैं।",
  "Account type": "अकाउंट का प्रकार",
  "Ways into this account": "इस अकाउंट में आने के रास्ते",
  "Email sign-in": "ईमेल साइन इन",
  "Checking…": "जाँचा जा रहा है…",
  "Could not check": "जाँच नहीं हो सकी",
  Connected: "जुड़ा हुआ",
  "Not connected": "जुड़ा नहीं",
  "Not offered on this server": "इस सर्वर पर उपलब्ध नहीं",
  "Other ways in": "आने के दूसरे रास्ते",
  "This browser": "यह ब्राउज़र",
  "This browser is what remembers your work": "आपका काम इसी ब्राउज़र में याद रहता है",
  Remembered: "याद रखा गया",
  "Not remembered": "याद नहीं रखा गया",
  Ready: "तैयार",
  "Google sign-in": "Google साइन इन",
  "Email and password": "ईमेल और पासवर्ड",
  "Manage in Settings": "सेटिंग्स में बदलें",

  // The stored profile values, so the read-only details match what Settings shows.
  "Government school": "सरकारी स्कूल",
  "Private school": "निजी स्कूल",
  "Home-schooled": "घर पर पढ़ाई",
  "Other or not sure": "कुछ और या पक्का नहीं",
  "Need low-cost options": "कम खर्च वाले विकल्प चाहिए",
  "Some budget for books or courses": "किताबों या कोर्स के लिए थोड़ा बजट है",
  "Cost is not a concern right now": "अभी खर्च की चिंता नहीं है",
  "Age 3 to 5": "उम्र 3 से 5",
  "Age 6 to 8": "उम्र 6 से 8",
  "Age 9 to 10": "उम्र 9 से 10",
  "Age 11 to 12": "उम्र 11 से 12",
  "Age 13 or above": "उम्र 13 या अधिक",

  // The redesigned profile screen: the hero, the three facts, the timeline,
  // the account card and the tip at the bottom.
  "A guide for classes 6 to 12": "कक्षा 6 से 12 के लिए एक मार्गदर्शक",
  "Dream": "बड़े",
  "Big...": "सपने देखें...",
  "Let's achieve your goals together!": "आइए, मिलकर आपके लक्ष्य पूरे करें!",
  "{years} years": "{years} वर्ष",
  "Not specified": "नहीं बताया",
  "Assessment History": "असेसमेंट का रिकॉर्ड",
  "View All": "सभी देखें",
  "Completed on {date}": "{date} को पूरा हुआ",
  "Read Result": "नतीजा पढ़ें",
  "Account Status": "अकाउंट की स्थिति",
  "Signed in with Google": "Google से साइन इन",
  "Member Since": "सदस्य कब से",
  "Not available": "उपलब्ध नहीं",
  "The ways into this account could not be read":
    "इस अकाउंट में आने के रास्ते पढ़े नहीं जा सके",
  "Pro Tip:": "प्रो टिप:",
  "Keep your profile picture updated to make your account more personal and recognizable.":
    "अपनी प्रोफ़ाइल फ़ोटो समय-समय पर बदलते रहें, ताकि आपका अकाउंट और भी अपना और पहचानने योग्य लगे।",

  // The profile photo: the picture beside the name and the dialog that changes it.
  "{name}'s profile photo": "{name} की प्रोफ़ाइल फ़ोटो",
  "Add a profile photo": "प्रोफ़ाइल फ़ोटो जोड़ें",
  "Add profile photo": "प्रोफ़ाइल फ़ोटो जोड़ें",
  "Change profile photo": "प्रोफ़ाइल फ़ोटो बदलें",
  "Add photo": "फ़ोटो जोड़ें",
  "Change photo": "फ़ोटो बदलें",
  "Remove photo": "फ़ोटो हटाएँ",
  "Profile photo": "प्रोफ़ाइल फ़ोटो",
  "Profile photo options": "प्रोफ़ाइल फ़ोटो के विकल्प",
  "Change the picture or remove it. Your initials show when there is no photo.":
    "तस्वीर बदलें या हटा दें। जब कोई फ़ोटो नहीं होती, आपके नाम के अक्षर दिखते हैं।",
  "Save photo": "फ़ोटो सेव करें",
  "Saving photo…": "फ़ोटो सेव हो रही है…",
  "Removing…": "हटाई जा रही है…",
  "Pick a picture that shows you. It appears beside your name on this page.":
    "अपनी एक ऐसी तस्वीर चुनें जिसमें आप दिखें। यह इस पन्ने पर आपके नाम के पास दिखेगी।",
  "The photo you selected": "आपकी चुनी हुई फ़ोटो",
  "Choose a photo from this device.": "इस डिवाइस से एक फ़ोटो चुनें।",
  "This picture cannot be shown. It may be damaged.":
    "यह तस्वीर नहीं दिखाई जा सकती। हो सकता है कि यह खराब हो।",
  "Choose another picture": "दूसरी तस्वीर चुनें",
  "JPEG, PNG or WebP, up to 5 MB.": "JPEG, PNG या WebP, 5 MB तक।",
  "A square picture looks best — the app centres and crops it for you.":
    "चौकोर तस्वीर सबसे अच्छी लगती है — ऐप उसे बीच से काटकर खुद ठीक कर देता है।",
  "Details hidden in the file, like where it was taken, are removed before it is saved.":
    "फ़ाइल में छिपी जानकारी, जैसे तस्वीर कहाँ खींची गई, सेव होने से पहले हटा दी जाती है।",
  "Remove your profile photo?": "अपनी प्रोफ़ाइल फ़ोटो हटाएँ?",
  "Your initials will show beside your name instead. You can add another photo at any time.":
    "आपके नाम के पास फिर से आपके नाम के अक्षर दिखेंगे। आप कभी भी दूसरी फ़ोटो जोड़ सकते हैं।",
  "Keep photo": "फ़ोटो रखें",
  "Your photo is saved.": "आपकी फ़ोटो सेव हो गई।",
  "Your photo is removed. Your initials show in its place.":
    "आपकी फ़ोटो हट गई। अब उसकी जगह आपके नाम के अक्षर दिखते हैं।",
  "That photo is larger than 5 MB. Choose a smaller one.":
    "यह फ़ोटो 5 MB से बड़ी है। छोटी फ़ोटो चुनें।",
  "That file is not a JPEG, PNG or WebP photo. Choose one of those.":
    "यह फ़ाइल JPEG, PNG या WebP फ़ोटो नहीं है। इन्हीं में से एक चुनें।",
  "That picture could not be read. It may be damaged or too small — try another one.":
    "यह तस्वीर पढ़ी नहीं जा सकी। यह खराब या बहुत छोटी हो सकती है — कोई दूसरी आज़माएँ।",
  "Your session has ended. Sign in again before changing the photo.":
    "आपका सत्र ख़त्म हो गया। फ़ोटो बदलने से पहले दोबारा साइन इन करें।",
  "A few photo saves in a minute is plenty. Wait a moment and try again — the saved photo has not changed.":
    "एक मिनट में इतनी बार फ़ोटो सेव करना काफ़ी है। थोड़ी देर रुककर दोबारा कोशिश करें — सेव की हुई फ़ोटो नहीं बदली है।",
  "The photo could not be sent. Check your connection and try again — the saved photo has not changed.":
    "फ़ोटो भेजी नहीं जा सकी। अपना कनेक्शन देखकर दोबारा कोशिश करें — सेव की हुई फ़ोटो नहीं बदली है।",
  "The photo could not be saved. The photo already on the account has not changed.":
    "फ़ोटो सेव नहीं हो सकी। अकाउंट पर पहले से मौजूद फ़ोटो नहीं बदली है।",

  // The Settings directory's sign-out row and its confirmation.
  "Parent account": "अभिभावक खाता",
  "Sign Out": "साइन आउट",
  "Sign out of your CareerGuide AI account on this browser.":
    "इस ब्राउज़र पर अपने CareerGuide AI अकाउंट से साइन आउट करें।",
  "Keep me signed in": "मुझे साइन इन रहने दें",
  "Sign out anyway": "फिर भी साइन आउट करें",
  "This browser holds the account's identity. Signing out forgets it, and without Google or an email and password nothing can bring this work back. The work itself is not deleted either way — it is only the way back that would be lost.":
    "यह ब्राउज़र इस अकाउंट की पहचान रखता है। साइन आउट करने पर यह पहचान भूल जाती है, और Google या ईमेल-पासवर्ड के बिना यह काम वापस नहीं आ सकेगा। काम तो किसी भी हाल में मिटता नहीं — सिर्फ़ वापस आने का रास्ता छूटता है।",
  "This browser holds the account's identity. Signing out forgets it, and without Google or an email there is nothing to bring this work back. The work itself is not deleted either way — it is only the way back that would be lost.":
    "यह ब्राउज़र इस अकाउंट की पहचान रखता है। साइन आउट करने पर यह पहचान भूल जाती है, और Google या ईमेल के बिना यह काम वापस लाने का कोई रास्ता नहीं बचता। काम तो किसी भी हाल में मिटता नहीं — सिर्फ़ वापस आने का रास्ता छूटता है।",
  "This account has no Google sign-in and no email sign-in.":
    "इस अकाउंट में न Google साइन इन है और न ईमेल साइन इन।",
  "You can return to this work by": "आप इस काम पर वापस आ सकते हैं:",
  "signing in with Google": "Google से साइन इन करके",
  "signing in with your email and password": "अपने ईमेल और पासवर्ड से साइन इन करके",
  " or ": " या ",
  ". This ends the app session on the server; it does not sign you out of Google itself, or of any other site.":
    "। इससे सिर्फ़ सर्वर पर यह ऐप सत्र ख़त्म होता है; इससे Google या किसी और साइट से साइन आउट नहीं होता।",
  "The account is kept. Only this browser's session ends.":
    "अकाउंट बना रहता है। सिर्फ़ इस ब्राउज़र का सत्र ख़त्म होता है।",
  "How else this account can be opened is not known yet.":
    "यह अकाउंट और कैसे खुल सकता है, यह अभी पता नहीं है।",
  "How else this account can be opened could not be checked yet. Signing out stays switched off until it can be, so the only way back into this work is not lost by accident.":
    "इस अकाउंट को और कैसे खोला जा सकता है, यह अभी जाँचा नहीं जा सका। जाँच पूरी होने तक साइन आउट बंद रहता है, ताकि इस काम में वापस आने का अकेला रास्ता गलती से न छूटे।",
  "Check again": "फिर जाँचें",
  "Nothing was signed out. Try again, or check your connection.":
    "कुछ भी साइन आउट नहीं हुआ। दोबारा कोशिश करें या अपना कनेक्शन देखें।",
  "There is no separate button to disconnect Google yet. Adding it gives this account another way in from any device; it does not replace this browser.":
    "Google को अलग करने का अलग बटन अभी नहीं है। इसे जोड़ने से इस अकाउंट में किसी भी डिवाइस से आने का एक और रास्ता बन जाता है; यह इस ब्राउज़र की जगह नहीं लेता।",
  "Deleting ends each one, removes its messages, and clears the interest notes it produced.":
    "हटाने पर हर बातचीत ख़त्म होती है, उसके संदेश मिटते हैं, और उससे बने दिलचस्पी के नोट भी साफ़ हो जाते हैं।",
  "Deleting history clears your conversations and the interest notes they produced. To remove the whole account — profile, assessments, reports, plans, resume and sign-in — use Delete account on the main Settings page.":
    "इतिहास हटाने से आपकी बातचीत और उनसे बने दिलचस्पी के नोट साफ़ हो जाते हैं। पूरा अकाउंट — प्रोफ़ाइल, असेसमेंट, रिपोर्ट, प्लान, रिज़्यूमे और साइन इन — हटाने के लिए सेटिंग्स के मुख्य पन्ने पर Delete account इस्तेमाल करें।",
  "This cannot be undone from this screen. Every message and every interest note the guide wrote from these conversations is deleted. Saved careers, assessment answers, reports, plans, your profile and resume stay, as do interest notes saved separately from an assessment. To erase the whole account instead, use Delete account on the main Settings page.":
    "इस पन्ने से इसे वापस नहीं लाया जा सकता। इन बातचीतों से गाइड ने जो हर संदेश और हर दिलचस्पी-नोट लिखा, वह मिट जाएगा। सहेजे गए करियर, असेसमेंट के जवाब, रिपोर्ट, प्लान, आपकी प्रोफ़ाइल और रिज़्यूमे बने रहेंगे, और असेसमेंट से अलग सहेजे गए दिलचस्पी-नोट भी। पूरा अकाउंट मिटाना हो तो सेटिंग्स के मुख्य पन्ने पर Delete account इस्तेमाल करें।",

  // The Settings directory's Delete account row and its typed confirmation.
  "Permanently erase this account and everything on it. This cannot be undone.":
    "इस अकाउंट और इस पर मौजूद सब कुछ को हमेशा के लिए मिटा दें। इसे वापस नहीं लाया जा सकता।",
  "This erases what the server holds for this account and signs out every device. Nothing on it can be brought back afterwards.":
    "इससे सर्वर पर इस अकाउंट का सब कुछ मिट जाता है और हर डिवाइस साइन आउट हो जाता है। बाद में इसमें से कुछ भी वापस नहीं लाया जा सकता।",
  "A parent account's children are not erased with it: only this account and the links to them go.":
    "अभिभावक अकाउंट मिटाने पर बच्चों के अकाउंट नहीं मिटते: सिर्फ़ यह अकाउंट और उनसे जुड़े लिंक जाते हैं।",
  "Type DELETE to confirm": "पुष्टि के लिए DELETE लिखें",
  "Nothing was confirmed as deleted. Reload the page to see where the account stands.":
    "मिटने की कोई पुष्टि नहीं हुई। यह देखने के लिए पन्ना दोबारा लोड करें कि अकाउंट की क्या स्थिति है।",
};
