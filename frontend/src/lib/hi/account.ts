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
  "Erases what this account holds on the server — the messages, the assessments and their answers, the reports, the plans, the saved careers, the settings and every session on every device. Not everything goes: the dialog lists, before you press anything, exactly which few records stay and why.":
    "इस अकाउंट पर सर्वर में जो-जो है वह मिट जाएगा — संदेश, असेसमेंट और उनके जवाब, रिपोर्ट, प्लान, सहेजे गए करियर, सेटिंग्स, और हर डिवाइस पर चल रहा सत्र। पर सब कुछ नहीं जाएगा: कोई बटन दबाने से पहले डायलॉग बताता है कि कौन-से रिकॉर्ड बचेंगे और क्यों।",
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
};
