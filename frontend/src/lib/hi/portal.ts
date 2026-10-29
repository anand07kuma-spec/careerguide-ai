/**
 * Hindi for the school, district and counsellor-practice portal screens: the invitation
 * link a student opens, the roster and invites, a counsellor's notes, the portal's own
 * look, its summary and its tier list.
 *
 * Keys are the English source text, so an untranslated string still renders — in
 * English — instead of vanishing from a child's screen.
 */

export const HI: Record<string, string> = {
  // The analytics panel: counts of a group, never a row about one child.
  "Loading the cohort": "समूह लोड हो रहा है",
  "This portal's questionnaire progress": "इस पोर्टल में प्रश्नावारी की प्रगति",
  "In the cohort": "समूह में",
  "Finished": "पूरे किए",
  "Shared their own results": "अपने रिज़ल्ट शेयर किए",
  "By stage": "चरण के हिसाब से",
  "By language": "भाषा के हिसाब से",
  "Sample too small": "नमूना बहुत छोटा",
  "Reportable": "रिपोर्ट के लायक",
  "Only counts children who chose to":
    "सिर्फ़ उन बच्चों की, जिन्होंने खुद चुनकर ऐसा किया",
  "Withheld to keep the cohort anonymous":
    "समूह पहचान में न आए, इसलिए ये आँकड़े हटा दिए",
  "This portal can see these numbers were dropped and why. It cannot see who is inside them.":
    "इस पोर्टल को दिखता है कि ये आँकड़े हटाए गए और क्यों। यह नहीं दिखता कि उनके अंदर कौन-कौन हैं।",
  "Too few members to report a breakdown. The totals below are still counts of a group, and nothing here names a child.":
    "इतने सदस्य नहीं कि अलग-अलग आँकड़े रिपोर्ट किए जाएँ। नीचे दी कुल गिनतियाँ फिर भी एक समूह की ही हैं, और इनमें किसी बच्चे का नाम नहीं है।",
  "No stage breakdown is reportable for this cohort.":
    "इस समूह के लिए चरण के हिसाब से आँकड़े रिपोर्ट नहीं किए जा सकते।",
  "No language breakdown is reportable for this cohort.":
    "इस समूह के लिए भाषा के हिसाब से आँकड़े रिपोर्ट नहीं किए जा सकते।",

  // Branding: the portal's own look, with no power over what the platform means.
  "How this portal looks to the people who join it":
    "जो लोग इससे जुड़ते हैं, उन्हें यह पोर्टल कैसा दिखता है",
  "The heading and the note are what a student reads before deciding to open the link. Nothing here changes what the portal can see.":
    "शीर्षक और नोट वही चीज़ें हैं जो एक विद्यार्थी लिंक खोलने का फ़ैसला करने से पहले पढ़ता है। यहाँ से यह नहीं बदलता कि पोर्टल क्या देख सकता है।",
  "Loading the portal's look": "पोर्टल का रूप लोड हो रहा है",
  "Something went wrong.": "कुछ गड़बड़ हो गई।",
  "Portal heading": "पोर्टल का शीर्षक",
  "Shown above the platform's own name. The platform label is always there too.":
    "प्लेटफ़ॉर्म के अपने नाम के ऊपर दिखता है। प्लेटफ़ॉर्म का लेबल हमेशा साथ में रहता है।",
  "Welcome note": "स्वागत नोट",
  "Only a member of this portal reads it. Nothing written here is sent to another portal.":
    "यह सिर्फ़ इस पोर्टल का सदस्य पढ़ता है। यहाँ लिखा गया कुछ भी किसी दूसरे पोर्टल नहीं भेजा जाता।",
  "Logo link (https)": "लोगो का लिंक (https)",
  "A logo has to be a plain https link, with no spaces and no password in it.":
    "लोगो एक सादा https लिंक होना चाहिए — न उसमें स्पेस हों, न कोई पासवर्ड।",
  "There is no upload on this platform, so the file stays hosted by whoever owns it.":
    "इस प्लेटफ़ॉर्म पर अपलोड नहीं होता, इसलिए फ़ाइल वहीं होस्ट होती है जिसकी वह है।",
  "Accent colour": "एक्सेंट रंग",
  "Seven colours, the platform's own. A portal can look like itself and still cannot redefine what a colour means.":
    "सात रंग — प्लेटफ़ॉर्म के अपने। पोर्टल अपना रूप रख सकता है, पर किसी रंग का मतलब बदल नहीं सकता।",
  "Last changed": "पिछला बदलाव:",

  // Inviting: holding a place for an address, nothing more.
  "riya@example.com, Class 11 A\narjun@example.com":
    "riya@example.com, कक्षा 11 A\narjun@example.com",
  "riya@example.com": "riya@example.com",
  "Class 11 A": "कक्षा 11 A",
  "One address": "एक पता",
  "Paste a list": "सूची पेस्ट करें",
  "Invite a class": "कक्षा को आमंत्रित करें",
  "One address per line, or address then a label separated by a comma. The first 50 lines are sent.":
    "हर पंक्ति में एक पता, या पता और फिर कॉमा से अलग किया हुआ लेबल। पहले 50 पंक्तियाँ भेजी जाती हैं।",
  "The address is the only detail stored on the place, and it is cleared the moment somebody accepts.":
    "इस जगह पर सिर्फ़ यही पता सहेजा जाता है, और किसी के स्वीकार करते ही वह मिट जाता है।",
  "A staff role can be given here. A child's account is never handed one.":
    "यहाँ स्टाफ़ भूमिका दी जा सकती है। किसी बच्चे के खाते को कभी नहीं दी जाती।",
  "Only students and parents can be invited by this portal.":
    "यह पोर्टल सिर्फ़ विद्यार्थी और अभिभावक को ही आमंत्रित कर सकता है।",
  "No places left. A bigger tier is arranged with a person, not bought here.":
    "कोई जगह नहीं बची। बड़ा टियर किसी इंसान से तय होता है, यहाँ से खरीदा नहीं जाता।",
  "Addresses": "पते",
  "Paste from a spreadsheet. Lines that are not an address are skipped, not sent.":
    "स्प्रेडशीट से पेस्ट करें। जो पंक्तियाँ पता नहीं हैं, उन्हें छोड़ दिया जाता है — भेजी नहीं जातीं।",
  "Email address": "ईमेल पता",
  "Label (optional)": "लेबल (ज़रूरी नहीं)",
  "What the roster will call this place, until the person chooses a name themselves.":
    "रोस्टर में इस जगह को यही नाम मिलेगा, जब तक व्यक्ति खुद अपना नाम न चुन ले।",
  "Hold a place": "जगह सुरक्षित रखें",
  "A waiting place already holds this portal's last seat":
    "इंतज़ार में पड़ी एक जगह ही इस पोर्टल की आख़िरी सीट लिए हुई है",

  // The join screen. Consent wording here is a statement, not a welcome.
  "Checking this device": "यह डिवाइस जाँचा जा रहा है",
  "You have joined": "आप जुड़ गए",
  "You are on this portal as": "आप इस पोर्टल पर इस भूमिका में हैं",
  "Your finished reports are visible to it. You can change that whenever you like.":
    "आपकी पूरी रिपोर्ट उसे दिखती हैं। आप यह कभी भी बदल सकते हैं।",
  "Nothing you write or answer is visible to it. Only what you choose to share, and you have not chosen yet.":
    "आप जो लिखते हैं या जो जवाब देते हैं, उसमें से कुछ भी उसे नहीं दिखता। सिर्फ़ वही दिखेगा जो आप खुद शेयर करना चुनें — और आपने अभी कुछ नहीं चुना।",
  "Open the portal": "पोर्टल खोलें",
  "Go to my own work": "मेरे अपने काम पर जाएँ",
  "You have been invited to": "आपको आमंत्रण भेजा गया है",
  "Verified by the platform": "प्लेटफ़ॉर्म से सत्यापित",
  "Not verified": "सत्यापित नहीं",
  "That portal is not open here, so its name is not shown. The invitation below still works if the link is live.":
    "वह पोर्टल यहाँ खुला नहीं है, इसलिए उसका नाम नहीं दिखता। लिंक ज़िंदा है तो नीचे दिया आमंत्रण फिर भी काम करेगा।",
  "An invitation to a portal": "पोर्टल का आमंत्रण",
  "This link does not say which school or practice sent it, and the platform will not guess: the name appears when the invitation is accepted.":
    "इस लिंक से नहीं बता जाता कि उसे किस स्कूल या प्रैक्टिस ने भेजा, और प्लेटफ़ॉर्म अनुमान नहीं लगाएगा: नाम तब दिखेगा जब आमंत्रण स्वीकार होगा।",
  "Your answers, your conversations and your report stay yours.":
    "आपके जवाब, आपकी बातचीत और आपकी रिपोर्ट आपके ही रहते हैं।",
  "Joining holds a place for you. It does not hand this portal anything.":
    "जुड़ने से आपके लिए जगह रहती है। इस पोर्टल के हाथ में कुछ नहीं आता।",
  "No tier, price or sponsorship changes what the guide tells you.":
    "न टियर, न कीमत, न प्रायोजन — कोई भी नहीं बदलता कि गाइड आपको क्या बताता है।",
  "There is no invitation in this link. Open the one from the letter, or ask the portal to write to your address again.":
    "इस लिंक में कोई आमंत्रण नहीं है। पत्र में दिया लिंक खोलें, या पोर्टल से कहें कि वे आपके पते पर दोबारा लिखें।",
  "This browser has not been introduced to CareerGuide AI yet. Choose who is using it, then open this link again — the invitation waits for you.":
    "यह ब्राउज़र अभी CareerGuide AI से मिलाया नहीं गया है। बताइए इसका कौन इस्तेमाल कर रहा है, फिर यह लिंक दोबारा खोलें — आमंत्रण आपका इंतज़ार करेगा।",
  "Say who is using this device": "बताइए कि यह डिवाइस कौन इस्तेमाल कर रहा है",
  "Let this portal see my finished reports": "इस पोर्टल को मेरी पूरी रिपोर्ट दिखने दें",
  "Off to begin with. A school that wants your reports asks, and you answer here or in the portal.":
    "शुरुआत में बंद रहता है। रिपोर्ट चाहने वाला स्कूल पूछता है, और जवाब आप यहाँ या पोर्टल में देते हैं।",
  "Accept the invitation": "आमंत्रण स्वीकार करें",
  "The link is the invitation. Nobody checks who it was addressed to, so keep it on your own device: whoever opens it next is the person who takes the place.":
    "लिंक ही आमंत्रण है। कोई जाँचता नहीं कि यह किसके पते पर भेजा गया था, इसलिए इसे अपने ही डिवाइस पर रखें: इसे अगला जो भी खोलेगा, वही जगह ले लेगा।",
  "My own work": "मेरा अपना काम",

  // What a student or guardian sees of the portal they joined.
  "Notes your counsellor sent you": "आपके काउंसलर ने जो नोट आपको भेजे",
  "Only the notes somebody chose to share. A note that was never sent does not appear here, and it cannot be made to.":
    "सिर्फ़ वे नोट जो किसी ने शेयर करना चुना। जो नोट भेजा ही नहीं गया, वह यहाँ नहीं दिखता, और उसे यहाँ दिखाने का कोई तरीका नहीं है।",
  "Leave this portal?": "यह पोर्टल छोड़ें?",
  "Student account": "विद्यार्थी का अकाउंट",
  "This portal has not written a note for its members.":
    "इस पोर्टल ने अपने सदस्यों के लिए कोई नोट नहीं लिखा है।",
  "Your portal can now see your finished reports.":
    "अब आपके पोर्टल को आपकी पूरी रिपोर्ट दिखती हैं।",
  "Your results are private again.": "आपके रिज़ल्ट फिर से निजी हो गए।",
  "Off by default. Turning it on shows the counts and the report this portal invited you to; your conversations and your drafts stay yours.":
    "डिफ़ॉल्ट में बंद। चालू करने पर गिनतियाँ और वह रिपोर्ट दिखेगी जिसके लिए इस पोर्टल ने आपको आमंत्रित किया था; आपकी बातचीत और आपके ड्राफ़्ट आपके ही रहेंगे।",
  "Nobody has shared a note with you here yet.":
    "अभी तक यहाँ किसी ने आपके साथ कोई नोट शेयर नहीं किया।",
  "Leaving closes your place here. Your account, your answers and your reports are untouched.":
    "छोड़ देने पर यहाँ आपकी जगह बंद हो जाएगी। आपके अकाउंट, आपके जवाब और आपकी रिपोर्ट पर कुछ नहीं होगा।",
  "Leave this portal": "यह पोर्टल छोड़ें",

  // A counsellor's notes: private until shared, and a transcript never lands here.
  "Write down what happened": "लिखिए क्या हुआ",
  "What was discussed and what happens next. A student's transcript is not part of this field and does not arrive here — it stays in their own account.":
    "किससे बात हुई और आगे क्या होगा। विद्यार्थी का ट्रांसक्रिप्ट इस फ़ील्ड का हिस्सा नहीं है और यहाँ नहीं आता — वह उसके अपने अकाउंट में रहता है।",
  "No clients to write about yet": "अभी लिखने के लिए कोई क्लाइंट नहीं",
  "Nobody has joined this practice, or nobody who is yours to see. A note is written against a person who accepted an invitation.":
    "इस प्रैक्टिस में कोई नहीं जुड़ा, या आपके लिए दिखने लायक कोई नहीं। नोट उसी व्यक्ति के नाम लिखा जाता है जिसने आमंत्रण स्वीकार किया हो।",
  "Choose a client": "क्लाइंट चुनें",
  "Talked through the class 10 streams. Arjun wants to see a physical-therapy college before deciding.":
    "कक्षा 10 के स्ट्रीम पर बात हुई। अर्जुन फ़ैसला करने से पहले एक फ़िज़ियोथेरेपी कॉलेज देखना चाहता है।",
  "Loading your notes": "आपके नोट लोड हो रहे हैं",
  "Delete this note?": "यह नोट हटाएँ?",
  "It goes at once, including for a family it was shared with. This cannot be undone.":
    "यह तुरंत मिट जाएगा, जिस परिवार के साथ शेयर किया गया था उनके पास से भी। इसे वापस नहीं लाया जा सकता।",
  "Client": "क्लाइंट",
  "A member with no label": "बिना लेबल का सदस्य",
  "The list is the members of this portal alone, and only those its own settings allow to be listed.":
    "इस सूची में सिर्फ़ इसी पोर्टल के सदस्य हैं, और वे भी बस जिनका नाम दिखाने की छूट पोर्टल की अपनी सेटिंग्स देती हैं।",
  "Note": "नोट",
  "Save note": "नोट सेव करें",
  "Shared": "शेयर किया हुआ",
  "Private": "निजी",
  "Unshare": "शेयर हटाएँ",
  "Share": "शेयर करें",
  "The family has been able to read this since": "परिवार इसे इस तारीख़ से पढ़ पा रहा है:",

  // The two portal dashboards and the lists they open.
  "Loading your portals": "आपके पोर्टल लोड हो रहे हैं",
  "Loading the roster": "रोस्टर लोड हो रहा है",
  "Loading your clients": "आपके क्लाइंट लोड हो रहे हैं",
  "Open an invitation link": "आमंत्रण का लिंक खोलें",
  "This account has not joined that portal. Nobody becomes a member of a school from a URL.":
    "इस अकाउंट ने वह पोर्टल जॉइन नहीं किया। कोई भी सिर्फ़ URL से किसी स्कूल का सदस्य नहीं बन जाता।",
  "The portals this account has joined. A roster, a chart and an invitation list belong to the school that holds them, and appear only to its staff.":
    "यह अकाउंट जिन पोर्टलों से जुड़ा है। रोस्टर, चार्ट और आमंत्रणों की सूची उसी स्कूल की होती है जो उन्हें रखता है, और वे सिर्फ़ उसके स्टाफ़ को दिखती हैं।",
  "Your own practice, and any practice you have joined as a counsellor.":
    "आपकी अपनी प्रैक्टिस, और कोई भी प्रैक्टिस जिसमें आप काउंसलर के तौर पर शामिल हैं।",
  "A school's portal is opened by the platform, not by a person inside it — an institution's credibility is not something one request can declare. When your school has one, the letter it sends carries a link that brings you here.":
    "स्कूल का पोर्टल प्लेटफ़ॉर्म खोलता है, उसके अंदर का कोई इंसान नहीं — किसी संस्थान की साख एक रिक्वेस्ट से घोषित नहीं की जा सकती। जब आपके स्कूल का पोर्टल होगा, तो उसके भेजे पत्र में वही लिंक होगा जो आपको यहाँ ले आएगा।",
  "Start one below. It holds places for your own clients, and nothing about any other practice.":
    "नीचे से अपना एक शुरू करें। इसमें आपके अपने क्लाइंट के लिए जगहें रहती हैं, और किसी दूसरी प्रैक्टिस के बारे में कुछ नहीं।",
  "You run this portal. What you can change is its look, its roster and its places — never what a child's report says.":
    "आप यह पोर्टल चलाते हैं। आप इसका रूप, इसका रोस्टर और इसकी जगहें बदल सकते हैं — किसी बच्चे की रिपोर्ट क्या कहती है, वह कभी नहीं।",
  "You work inside this portal. You can see the clients who are yours and write their notes; its name, colour and roster belong to its administrator.":
    "आप इस पोर्टल के अंदर काम करते हैं। आपको वे क्लाइंट दिखते हैं जो आपके हैं, और आप उनके नोट लिख सकते हैं; इसका नाम, रंग और रोस्टर उसके प्रशासक के पास रहता है।",
  "You joined this portal. Nothing on it is visible to its staff unless you say so.":
    "आप इस पोर्टल से जुड़े हैं। जब तक आप खुद नहीं कहते, इस पर मौजूद कुछ भी उसके स्टाफ़ को नहीं दिखता।",
  "Nobody has joined this practice yet, or nobody who is yours to see.":
    "इस प्रैक्टिस में अभी कोई नहीं जुड़ा, या आपके लिए दिखने लायक कोई नहीं।",
  "Shares results": "रिज़ल्ट शेयर करता है",
  "With": "इनके साथ:",
  "Joined": "शामिल हुए",
  "Start a practice": "अपना प्रैक्टिस शुरू करें",
  "Practice name": "प्रैक्टिस का नाम",
  "An address for it is made from the name and shown after it is created.":
    "इसका पता नाम से बनता है और प्रैक्टिस बनने के बाद दिखाया जाता है।",
  "Create": "बनाएँ",

  // The portal's own header: what it is called and how many places it holds.
  "Waiting": "इंतज़ार में",
  "Adults on staff": "स्टाफ़ में शामिल बड़े",
  "Places left": "बची हुई जगहें",
  "Seats used": "इस्तेमाल की गई सीटें",

  // The roster, including the seat an unsent invitation still holds.
  "Nobody yet": "अभी कोई नहीं",
  "Nobody is on this roster yet.": "इस रोस्टर पर अभी कोई नहीं है।",
  "Results shared": "रिज़ल्ट शेयर किए गए",
  "Results kept private": "रिज़ल्ट निजी रखे गए",
  "Place held for": "यह जगह इस पते के लिए सुरक्षित है:",
  "until": "इस तारीख़ तक:",
  "Cancel invite": "आमंत्रण रद्द करें",
  "Assigned counsellor": "नियुक्त काउंसलर",
  "A counsellor with no label": "बिना लेबल का काउंसलर",
  "A person to sit with. It opens no file: what this counsellor may read is still the student's own choice.":
    "वह व्यक्ति जिसके साथ बैठकर बात होगी। इससे कोई फ़ाइल नहीं खुलती: यह काउंसलर क्या पढ़ सकता है, वह अब भी विद्यार्थी की अपनी मर्ज़ी है।",
  "Invite a counsellor to this portal before assigning students to one.":
    "विद्यार्थी किसी काउंसलर से जोड़ने से पहले, इस पोर्टल में एक काउंसलर को आमंत्रित करें।",
  "Cancel this invitation?": "यह आमंत्रण रद्द करें?",
  "Take this place back?": "यह जगह वापस लें?",
  "The link in the letter stops working and the seat comes back. Nothing else changes.":
    "पत्र में दिया लिंक काम करना बंद कर देगा और सीट वापस आ जाएगी। इसमें और कुछ नहीं बदलता।",
  "The account keeps everything it wrote and its own sharing switch. The place in this portal is closed.":
    "अकाउंट के पास वह सब रहेगा जो उसमें लिखा गया था, और रिपोर्ट शेयर करने की उसकी अपनी स्विच भी। बस इस पोर्टल में उसकी जगह बंद हो जाएगी।",

  // Tiers: a ceiling on seats, with no price and no buy button on screen.
  "Loading the tiers": "टियर लोड हो रहे हैं",
  "Places this portal can hold": "जितनी जगहें यह पोर्टल रख सकता है",
  "A tier is a ceiling on seats, not a level of service to a child. Nobody's recommendations, answers or report change with the tier their school is on.":
    "टियर सीटों पर लगी ऊपरी हद है, किसी बच्चे को मिलने वाली सेवा का स्तर नहीं। जिस टियर पर उसका स्कूल है, इससे किसी की सिफ़ारिश, उसके जवाब या उसकी रिपोर्ट नहीं बदलती।",
  "In use": "इस्तेमाल में",
  "places": "जगहें",
  "no price is set on this platform": "इस प्लेटफ़ॉर्म पर कोई कीमत तय नहीं",
  "There is no buy button on this screen. A bigger tier is arranged with the platform by a person, and no card moves a seat.":
    "इस स्क्रीन पर खरीदने का कोई बटन नहीं। बड़ा टियर प्लेटफ़ॉर्म से किसी इंसान के ज़रिए तय होता है, और कार्ड चलाकर सीट नहीं मिलती।",
};
