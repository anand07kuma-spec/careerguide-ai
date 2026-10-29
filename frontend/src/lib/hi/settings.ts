/**
 * Hindi for the one Settings screen: language, theme, voice, email sign-in,
 * storage consent and the delete / start-over controls.
 *
 * Keys are the English source text, so an untranslated string still renders — in
 * English — instead of vanishing from a child's screen.
 */

export const HI: Record<string, string> = {
  "Not set": "नहीं बताया",

  // Language and voice
  "How the guide speaks and listens to you.": "गाइड आपसे कैसे बोलता है और कैसे सुनता है।",
  "Reply language": "जवाब की भाषा",
  "This is only how the guide opens the conversation — it answers in whatever language you actually use, and Hinglish mixes Hindi and English the way friends talk. Nothing about this setting sends your data anywhere new.":
    "यह सिर्फ़ इतना तय करता है कि गाइड बातचीत कैसे शुरू करेगा — जवाब वह उसी भाषा में देता है जिसका आप असल में इस्तेमाल करते हैं, और Hinglish में हिन्दी और अंग्रेज़ी ऐसे मिलती हैं जैसे दोस्त बात करते हैं। इस सेटिंग से आपका डेटा कहीं नई जगह नहीं जाता।",
  "Voice list could not load": "आवाज़ों की सूची नहीं खुल सकी",
  "Use the default voice": "डिफ़ॉल्ट आवाज़ इस्तेमाल करें",
  "Voice — English (also used for Hinglish)": "आवाज़ — अंग्रेज़ी (Hinglish के लिए भी यही)",
  "Not available for your current reply language — switch the language above to pick from this set.":
    "आपकी मौजूदा जवाब भाषा के लिए यह उपलब्ध नहीं है — इनमें से चुनने के लिए ऊपर वाली भाषा बदलें।",
  "Replies are read aloud by the server's speech service — the one named just below — and by your browser's own voice if that fails. Either way it is not a human voice, and the words stay on screen.":
    "जवाब सर्वर की स्पीच सर्विस बोलकर सुनाती है — उसी का नाम ठीक नीचे लिखा है — और वह नाकाम रहे तो आपके ब्राउज़र की अपनी आवाज़। जिससे भी सुनाया जाए, यह इंसान की आवाज़ नहीं है, और शब्द स्क्रीन पर लिखे रहते हैं।",
  "Keeps listening during an open call so you do not tap each turn. It never listens between calls, and nothing is recorded.":
    "कॉल चल रही हो तो वह सुनता रहता है, ताकि हर बार आपको बटन न दबाना पड़े। जब कॉल नहीं चल रही होती, तब वह कभी नहीं सुनता, और कुछ भी रिकॉर्ड नहीं होता।",
  "Server status unknown": "सर्वर की हालत पता नहीं",

  // The interface-language switch, which is device-local and deliberately not
  // the same control as the reply language above.
  "This changes the menus, buttons and page titles on this device, and it stays as you left it. Nothing else switches it — not even a Hindi conversation. Reply language below is a separate thing, and that one does follow how you actually talk.":
    "इससे इस डिवाइस पर मेन्यू, बटन और पेज के शीर्षक बदलते हैं, और जैसा आप छोड़ेंगे वैसा ही रहेगा। और कुछ इसे नहीं बदलता — हिन्दी में बातचीत करने से भी नहीं। नीचे दी «जवाब की भाषा» अलग चीज़ है, और वह आपके असल में बोलने के हिसाब से चलती है।",

  // The two call switches and the server-voice block under them.
  "Hands-free conversation on calls": "कॉल में हैंड्स-फ्री बातचीत",
  "The server's voice": "सर्वर की आवाज़",
  "If you heard it, replies are spoken by the server in this browser.":
    "अगर आपको सुनाई दिया, तो इस ब्राउज़र में जवाब सर्वर ही बोलकर सुना रहा है।",
  "Your browser's own voice still reads replies aloud, and it sounds different.":
    "आपके ब्राउज़र की अपनी आवाज़ जवाब बोलकर सुनाती रहेगी, और वह अलग सी लगती है।",
  "Answers come from a built-in demo guide until an AI key is added on the server. The demo still walks you through real exploration — but replies are scripted samples.":
    "सर्वर पर AI key जोड़ने तक जवाब ऐप के अंदर मौजूद डेमो गाइड से आते हैं। डेमो में भी खोज असल में चलती है — बस जवाब पहले से तय किए नमूने हैं।",

  // Profile
  "Display name": "दिखने वाला नाम",
  "Only coarse details are stored — never your full name at school, address, documents, Aadhaar, bank details or passwords. We do not ask for those, ever.":
    "सिर्फ़ मोटी-मोटी बातें सहेजी जाती हैं — स्कूल में आपका पूरा नाम, पता, दस्तावेज़, आधार, बैंक की जानकारी या पासवर्ड कभी नहीं। ये हम कभी नहीं माँगते।",
  "You are signed in as a parent, so your profile has no class, age or interests — those belong to your child's own account.":
    "आप अभिभावक के रूप में साइन इन हैं, इसलिए आपकी प्रोफ़ाइल में कक्षा, उम्र या रुचियाँ नहीं हैं — वे आपके बच्चे के अपने अकाउंट में होती हैं।",
  "Sets how simply the guide explains things.":
    "यह तय करता है कि गाइड बातें कितने आसान शब्दों में समझाता है।",
  "You can keep up to 12 interests — remove one to add another.":
    "आप ज़्यादा से ज़्यादा 12 रुचियाँ रख सकते हैं — नई जोड़ने के लिए कोई एक हटाएँ।",
  // These are the band labels a student picks from the two dropdowns. `Select`
  // translates an option's label, never its value, so the string sent to the API
  // stays the English one and only what the child reads changes.
  "Other or not sure": "कुछ और, या पता नहीं",
  "Helps the guide suggest realistic routes. Change it any time — nothing here is a judgment about you.":
    "इससे गाइड ऐसे रास्ते सुझाता है जो आपके लिए सच में संभव हैं। इसे कभी भी बदल सकते हैं — यह आपके बारे में कोई फैसला नहीं है।",
  "Some budget for books or courses": "किताबों या कोर्स के लिए थोड़ा बजट है",
  "Cost is not a concern right now": "अभी खर्च की कोई चिंता नहीं है",
  "A coarse band used only to suggest affordable routes and scholarships — never a judgment about your family. We never ask for bank details or documents.":
    "यह बस एक मोटा अनुमान है, जिसका इस्तेमाल सिर्फ़ इतना है कि ऐसे रास्ते और स्कॉलरशिप सुझाई जाएँ जो खर्च में बन सकें — आपके परिवार के बारे में यह कभी कोई फैसला नहीं है। हम बैंक की जानकारी या दस्तावेज़ कभी नहीं माँगते।",

  // The interest picker: the count hint, the reassurance under it, and the six
  // labels `stream.ts` does not already hold for the other sixteen.
  "(pick up to 12)": "(ज़्यादा से ज़्यादा 12 चुनें)",
  "Interests are things you might enjoy trying — they never decide what you are allowed to become.":
    "रुचियाँ वे काम हैं जो आप शौक से आज़माना चाहेंगे — ये कभी तय नहीं करतीं कि आप क्या बन सकते हैं।",
  "Designing how things look": "डिज़ाइन और लुक",
  "Maps, travel and places": "नक्शे, सफ़र और जगहें",
  "Cooking and food": "खाना पकाना और खाना",
  "Machines and vehicles": "मशीनें और वाहन",
  "History and society": "इतिहास और समाज",
  "New technologies": "नई टेक्नोलॉजी",

  // The parent's read-only half of the same card.
  "Your child's name and profile live on their account and can only be changed by them.":
    "आपके बच्चे का नाम और प्रोफ़ाइल उसके अपने अकाउंट में हैं — इन्हें बदलना सिर्फ़ आपके बच्चे के अपने हाथ में है।",

  // Email sign-in
  "Email disconnected. This browser still opens your work exactly as before.":
    "ईमेल अलग कर दिया गया। यह ब्राउज़र आपका काम बिल्कुल पहले की तरह ही खोलेगा।",
  "An email opens this account too": "इस अकाउंट को आपके ईमेल से भी खोला जा सकता है",
  "This browser is the account": "यही ब्राउज़र आपका अकाउंट है",
  Connected: "जुड़ा हुआ",
  "Disconnecting…": "अलग किया जा रहा है…",
  "Disconnect the email": "ईमेल अलग करें",

  // The Clerk paragraph. The three `<code>` chips around these fragments are
  // env-var and route names and stay exactly as the server spells them, so the
  // Hindi here is written to read as one sentence with those chips dropped in.
  "Email sign-in is not switched on for this site, and that is the operator's choice, not yours: it needs both":
    "इस साइट पर ईमेल से साइन इन अभी चालू नहीं है, और यह साइट चलाने वाले का चुनाव है, आपका नहीं। इसके लिए दोनों चाहिए —",
  "on the backend and": "बैकएंड पर, और",
  "on the frontend, plus a webhook pointed at": "फ्रंटएंड पर। साथ ही एक वेबहुक चाहिए जो यहाँ जुड़े —",
  ". Until then nothing is different here — this browser keeps your work, and there is no email or password that could be lost. The one control that can end this account is the Delete account card at the bottom of this screen, and only you can press it.":
    "। तब तक यहाँ कुछ नहीं बदलता — आपका काम इसी ब्राउज़र में सहेजा रहेगा, और खोने जैसा कोई ईमेल या पासवर्ड है ही नहीं। इस अकाउंट को बंद करने का बस एक तरीका है — इस स्क्रीन के सबसे नीचे वाला «अकाउंट डिलीट करें» कार्ड, और वह बटन सिर्फ़ आप दबा सकते हैं।",

  // The three bold lead-ins and the sentence each of them introduces. They render
  // side by side in one line, so the Hindi keeps the same full stop after the label.
  "Notifications.": "सूचनाएँ।",
  "Nothing in this app messages you, reminds you or rings you — you come to it when you want to. So there is no notification switch to offer, and no switch is hiding somewhere else.":
    "इस ऐप में आपको न कोई संदेश भेजा जाता है, न याद दिलाया जाता है, न घंटी बजाई जाती है — आप जब चाहें तब इसके पास आते हैं। इसलिए यहाँ सूचना का कोई स्विच दिखाने को नहीं है, और कोई स्विच दूसरी जगह छिपा भी नहीं है।",
  "Export.": "एक्सपोर्ट।",
  "The report PDF on your Reports page is the only export there is today. There is no button yet that hands over every conversation, every saved career and every answer at once.":
    "आपके रिपोर्ट पेज की PDF रिपोर्ट ही आज तक एकमात्र एक्सपोर्ट है। अभी ऐसा कोई बटन नहीं जो एक साथ हर बातचीत, हर सेव किया करियर और हर जवाब आपको दे दे।",
  "Delete account.": "अकाउंट डिलीट करना।",
  "The card at the bottom of this screen erases this account in one step: the conversations and messages, the assessments with their answers and results, the reports and the PDFs printed from them, the plans, saved careers, the resume as it was written, profile, settings and every consent go, and every device signs out. There is no password, phone number or email to delete, because this account was never made from one. The dialog lists the few records that stay, and why, before you press anything. Clearing conversations and starting over on this device still work on their own, for someone who wants one without the other.":
    "इस स्क्रीन के सबसे नीचे वाला कार्ड इस अकाउंट को एक ही कदम में मिटा देता है: बातचीत और उसके संदेश, असेसमेंट उनके जवाबों और नतीजों सहित, रिपोर्टें और उनसे बनी PDF, प्लान, सेव किए करियर, आपका लिखा हुआ रिज़्यूमे, प्रोफ़ाइल, सेटिंग्स और दी गई हर अनुमति — सब चले जाते हैं, और हर डिवाइस से साइन आउट हो जाता है। यहाँ मिटाने को कोई पासवर्ड, फ़ोन नंबर या ईमेल नहीं है, क्योंकि यह अकाउंट इन्हीं में से किसी से बना ही नहीं था। कौन-से कुछ रिकॉर्ड बचते हैं और क्यों — कोई बटन दबाने से पहले डायलॉग वही सूची दिखाता है। बातचीत साफ़ करना और इस डिवाइस पर नए सिरे से शुरू करना अलग-अलग भी किए जा सकते हैं, अगर किसी को बस इतना ही चाहिए।",

  // `अनुमति` for consent, and `सहेजना` for storing, are the words account.ts already
  // uses on the neighbouring rows — the same action must not get a second name here.
  "What gets stored, what you have agreed to, and how to erase it.":
    "क्या सहेजा जाता है, आपने किस चीज़ की अनुमति दी है, और उसे कैसे मिटाएँ।",
  "Save my conversation history": "मेरी बातचीत का इतिहास सहेजें",
  "If this is off, closing a conversation deletes its messages.":
    "यह बंद है तो बातचीत बंद करते ही उसके संदेश मिट जाएँगे।",
  "Turns off animations and transitions across the whole app.":
    "पूरे ऐप में एनिमेशन और ट्रांज़िशन बंद हो जाते हैं।",
  "Darker text and stronger borders for easier reading.":
    "टेक्स्ट गहरा और रेखाएँ मज़बूत — ताकि पढ़ना आसान हो।",
  // The two switch labels sit inside a `<span>` with their icon, which `Toggle`
  // cannot reach — only a plain string label self-translates.
  "Reduce motion": "मूवमेंट कम करें",
  "High contrast": "ज़्यादा कंट्रास्ट",
  "Loading your consent records…": "आपकी अनुमति के रिकॉर्ड लोड हो रहे हैं…",
  // The three consent rows. The `grant` line lands in a Toggle's `description`, which
  // translates itself; the `withdraw` line beside it on screen now goes through t().
  "Lets us keep your class, age and interests so suggestions fit you. Without it, nothing is personalised.":
    "इससे हम आपकी कक्षा, उम्र और रुचियाँ सहेज रखते हैं, ताकि सुझाव आपको सही बैठें। इसके बिना कुछ भी आपके हिसाब से ढाला नहीं जाता।",
  "Lets the guide turn what you say into text and read replies aloud. Plain typing works without this.":
    "इससे गाइड आपके बोले हुए शब्दों को टेक्स्ट बना पाता है और जवाब बोलकर सुनाता है। इसके बिना भी आप सादे टाइप से बात कर सकते हैं।",
  "Include my themes in the parent summary": "अभिभावक के सारांश में मेरी रुचि के विषय शामिल करें",
  "Lets a linked parent see the themes, saved careers and progress counts on their dashboard. Your conversation text is never included unless you switch it on for that parent.":
    "इससे आपसे जुड़ा अभिभावक अपने डैशबोर्ड पर आपकी रुचि के विषय, सेव किए करियर और प्रगति की गिनती देख सकता है। आपकी बातचीत के शब्द कभी शामिल नहीं होते, जब तक कि आप उसे उसी अभिभावक के लिए चालू न करें।",
  "Withdraw any time — we stop using the stored details for suggestions.":
    "कभी भी वापस लें — हम सहेजे हुए ब्यौरों का इस्तेमाल सुझावों के लिए करना बंद कर देंगे।",
  "Withdraw any time — voice calls will be switched off for you.":
    "कभी भी वापस लें — आपके लिए वॉइस कॉल बंद हो जाएँगी।",
  "Withdraw any time — the parent's dashboard stops updating.":
    "कभी भी वापस लें — अभिभावक का डैशबोर्ड अपडेट होना बंद कर देगा।",
  // The first two row labels. `Toggle` translates its own `label` prop, and these
  // two come from `CONSENT_SCOPES` rather than from the JSX, so hi-coverage.mjs
  // cannot see them; the third label is already above.
  "Store my profile": "मेरी प्रोफ़ाइल सहेजें",
  "Use my voice": "मेरी आवाज़ इस्तेमाल करें",

  // The consent table under those rows.
  "Exactly what you have agreed to, with the date. You can withdraw any of these here at any time — that is what this screen is for.":
    "आपने किस चीज़ पर हाँ कहा, बिल्कुल वैसा ही, तारीख़ के साथ। यहाँ से आप कोई भी अनुमति कभी भी वापस ले सकते हैं — यह स्क्रीन इसी के लिए है।",
  "Last updated {time} · consent version {version}":
    "आख़िरी बार {time} बदला · अनुमति का संस्करण {version}",
  "No decision recorded yet — treating this as not granted.":
    "अभी कोई जवाब दर्ज नहीं है — इसलिए यह अनुमति नहीं दी गई मानी जाती है।",
  "What this app protects: your conversations are not shared with parents by default, links only exist because a student chose them, and there are no ads or payments. What it does not protect: this is a demo build without a legal/compliance certification — do not enter real personal documents, and get qualified review before using it with actual children.":
    "यह ऐप क्या बचाता है: आपकी बातचीत डिफ़ॉल्ट रूप से अभिभावकों के साथ शेयर नहीं होती, लिंक सिर्फ़ तब बनते हैं जब विद्यार्थी खुद चुने, और यहाँ न कोई विज्ञापन है न भुगतान। यह क्या नहीं बचाता: यह एक डेमो बिल्ड है जिसकी क़ानूनी या अनुपालन सर्टिफ़िकेशन नहीं हुई है — इसलिए असली व्यक्तिगत दस्तावेज़ यहाँ न डालें, और असली बच्चों के साथ इस्तेमाल करने से पहले किसी योग्य व्यक्ति से जाँच ज़रूर करवाएँ।",

  // Family access
  "A parent can only see a summary if you give them this code — they cannot attach by guessing. You can revoke it any time.":
    "अभिभावक को आपका सारांश तभी दिखेगा जब आप उन्हें यह कोड देंगे — अनुमान लगाकर वे अपने आप नहीं जुड़ सकते। यह कोड आप कभी भी रद्द कर सकते हैं।",
  "New sharing code ready. The previous one stopped working.":
    "नया शेयरिंग कोड तैयार है। पुराना कोड अब काम नहीं करता।",
  "Your browser blocked copying — please write it down instead.":
    "आपके ब्राउज़र ने कॉपी करना रोक दिया — कृपया आप उसे लिख लें।",
  "Link removed. That adult can no longer see your summary.":
    "लिंक हटा दिया गया। वह अभिभावक अब आपका सारांश नहीं देख पाएँगे।",

  // The code card and the adult list it feeds.
  "Give this to a parent": "यह कोड किसी अभिभावक को दें",
  Copied: "कॉपी हो गया",
  Copy: "कॉपी करें",
  "Sharing is currently switched off": "फ़िलहाल शेयरिंग बंद है",
  "Generate a new code": "नया कोड बनाएँ",
  "Stop sharing": "शेयरिंग बंद करें",
  Linked: "लिंक हुआ",
  "· sees summary only": "· सिर्फ़ सारांश दिखेगा",
  "Conversation text shared: yes": "बातचीत का टेक्स्ट शेयर होता है: हाँ",
  "Conversation text shared: no": "बातचीत का टेक्स्ट शेयर होता है: नहीं",
  "Themes and progress are shared either way. Only turn this on if you want {name} to read the actual messages.":
    "विषय और प्रगति तो हर हालत में शेयर होते हैं। इसे तभी चालू करें जब आप चाहते हैं कि {name} असली संदेश पढ़े।",
  "{name} will no longer see your summary.": "{name} अब आपका सारांश नहीं देख पाएँगे।",
  // The remove-access dialog is one sentence split around the adult's name, so the
  // two halves have to join into a single Hindi sentence across that gap.
  "Removing access is your choice and takes effect immediately. Nothing about your account is deleted — if you ever want":
    "पहुँच हटाना आपकी अपनी मर्ज़ी है, और वह तुरंत लागू हो जाती है। आपके अकाउंट से कुछ नहीं मिटता — अगर कभी फिर चाहें कि",
  "this adult": "यह अभिभावक",
  "to see a summary again, you would share a new code.":
    "आपका सारांश दोबारा देख सकें, तो उसके लिए नया कोड शेयर करना होगा।",

  // This device
  "This prototype has no login, so this browser is what your work belongs to.":
    "इस प्रोटोटाइप में लॉगिन नहीं है, इसलिए आपका काम इसी ब्राउज़र से जुड़ा है।",
  "Start over on this device?": "इस डिवाइस पर नए सिरे से शुरू करें?",
  "This browser will be treated as somebody who has never been here.":
    "इस ब्राउज़र को ऐसा माना जाएगा जो यहाँ कभी आया ही नहीं।",
  "The server could not be asked to forget this device. Try again in a moment.":
    "सर्वर से यह नहीं कहा जा सका कि यह डिवाइस भूल जाए। थोड़ी देर बाद फिर कोशिश करें।",

  // The identity card at the top of the screen and the "This device" panel.
  Dashboard: "डैशबोर्ड",
  "There is nothing to sign out of": "साइन आउट करने जैसा कुछ नहीं है",
  "This browser is the account, so just close the tab — everything will be waiting next time you open it from here. Use start over only if somebody else will use this device.":
    "यही ब्राउज़र आपका अकाउंट है, इसलिए टैब बंद कर दीजिए — अगली बार यहाँ से खोलने पर सब कुछ वहीं मिलेगा। «नए सिरे से शुरू करें» सिर्फ़ तब दबाएँ जब यह डिवाइस कोई और भी इस्तेमाल करेगा।",
  "How this works": "यह कैसे काम करता है",
  "How you are recognised": "आपकी पहचान कैसे होती है",
  "The first time this site was opened here, the browser made up a long random number and kept it in its own storage. The server files your work under that number. It is not a name, an email or a password, so there is nothing to remember, write down or lose.":
    "इस साइट को जब पहली बार यहाँ खोला गया, तब ब्राउज़र ने एक लंबा रैंडम नंबर बनाकर अपनी स्टोरेज में रख लिया। सर्वर आपका काम उसी नंबर के नीचे सहेजता है। यह न नाम है, न ईमेल, न पासवर्ड — इसलिए याद रखने, लिखने या खोने जैसा कुछ ही नहीं है।",
  "Same phone or laptop, same browser: your conversations, saved careers and settings are waiting when you come back.":
    "वही फ़ोन या लैपटॉप, वही ब्राउज़र: वापस आने पर आपकी बातचीत, सेव किए करियर और सेटिंग्स वहीं मिलेंगे।",
  "A different device, a private window, or cleared site data starts a brand-new student. That is the price of having no sign-in — nothing can bring the old work back, so please do not use a shared or public computer.":
    "दूसरा डिवाइस, प्राइवेसी विंडो, या साइट का डेटा साफ़ कर देने पर नई शुरुआत होती है और पुरानी पहचान खत्म हो जाती है। यही बिना साइन इन की कीमत है — पुराना काम वापस लाने वाला कोई नहीं है, इसलिए साझा या सार्वजनिक कंप्यूटर पर इसका इस्तेमाल न करें।",
  "Starting over gives this browser a new identity and stops the current session on the server right away. It deletes nothing by itself: to clear what is stored, delete your conversations from the privacy section first.":
    "नए सिरे से शुरू करने पर इस ब्राउज़र की पहचान बदल जाती है और सर्वर पर चल रहा वर्तमान सत्र तुरंत रुक जाता है। यह अपने आप कुछ नहीं मिटाता: सहेजा हुआ डेटा हटाने के लिए पहले प्राइवेसी सेक्शन में जाकर अपनी बातचीत मिटाएँ।",
  "Start over on this device": "इस डिवाइस पर नए सिरे से शुरू करें",
  "You will be taken back to the one question, and whatever is in this session now will not be reachable from this browser again. If the goal is a clean slate for the messages rather than a new student, delete the conversation history in the privacy section instead.":
    "आपको वापस पहले सवाल पर ले जाया जाएगा, और इस सत्र में अभी जो कुछ है वह इस ब्राउज़र से दोबारा नहीं खुलेगा। अगर मकसद नई शुरुआत नहीं बल्कि सिर्फ़ संदेशों की सफ़ाई है, तो प्राइवेसी सेक्शन में जाकर बातचीत का इतिहास मिटाएँ।",
  "Keep them": "बातचीत रहने दें",

  // About this build — same wording as account.ts's "{count} honest limitations, in plain words"
  "Honest limitations, in plain words.": "सीड़े शब्दों में ईमानदार सीमाएँ।",
  // The six bullets of `BUILD_NOTES`, rendered as `{t(note.text)}`. The keys are the
  // exact English strings, curly quotes and all, and `/pricing` stays as written.
  "The guide’s replies come from whichever model the server is configured with. Anything written from sample content carries a ‘Demo guide answer’ label on the reply itself, so the answer tells you which one you are reading.":
    "गाइड के जवाब उसी मॉडल से आते हैं जो सर्वर पर सेट होता है। नमूना कॉन्टेंट से लिखा गया हर जवाब अपने ऊपर «डेमो गाइड का जवाब» का लेबल रखता है, ताकि जवाब ही बता दे कि आप कौन-सा जवाब पढ़ रहे हैं।",
  "The career catalogue is seeded sample data. Fees, entrances and eligibility change yearly — always verify against official sources before deciding anything.":
    "करियर कैटलॉग पहले से भरा हुआ नमूना डेटा है। फ़ीस, एंट्रेंस और पात्रता हर साल बदलती हैं — इसलिए कुछ भी पक्का करने से पहले ऑफ़िशियल सोर्स से जाँच लें।",
  "Speech recognition depends on your browser: it works best in recent Chrome and Edge on desktop, and typing always remains available as a fallback.":
    "आवाज़ पहचानना आपके ब्राउज़र पर निर्भर है: डेस्कटॉप पर नए Chrome और Edge में यह सबसे अच्छा चलता है, और दिक्कत हो तो टाइप करने का रास्ता हमेशा खुला रहता है।",
  "Nothing is sold here except the plans on /pricing, and those are switched off until the operator sets real payment keys. No course, coaching class or institution is sold, and guidance is never influenced by partners or by what a family paid.":
    "यहाँ /pricing वाले प्लान के अलावा कुछ भी नहीं बिकता, और साइट चलाने वाला सर्वर पर असली भुगतान कुंजियाँ न लगा दे, तब तक वे भी बंद हैं। न कोई कोर्स बिकता है, न कोचिंग क्लास, न संस्थान — और मार्गदर्शन पर कभी पार्टनर्स या किसी परिवार के खर्च किए पैसे का असर नहीं पड़ता।",
  "This prototype has no login on purpose. Your work is tied to this browser only, so a different phone or cleared browser data starts a new student and the old progress cannot be recovered.":
    "इस प्रोटोटाइप में जान-बूझकर लॉगिन नहीं है। आपका काम सिर्फ़ इसी ब्राउज़र से जुड़ा है, इसलिए दूसरा फ़ोन या ब्राउज़र का डेटा साफ़ कर देने पर एक नए विद्यार्थी की शुरुआत होती है और पुरानी प्रगति वापस नहीं मिलती।",
  "Qualified legal review (including child-data rules like India's DPDP Act) is needed before any real deployment with children. This build makes no compliance claim.":
    "असली बच्चों के साथ इसे चलाने से पहले किसी योग्य क़ानूनी जाँच की ज़रूरत है — बच्चों के डेटा के नियमों जैसे भारत के DPDP एक्ट की भी। यह बिल्ड किसी क़ानून के पालन का दावा नहीं करता।",

  // Destructive confirmations
  "Delete your conversation history?": "अपनी बातचीत का इतिहास मिटाएँ?",
  "Remove this adult's access?": "इस अभिभावक की पहुँच हटाएँ?",
  // The delete-history card and its confirm dialog. Both singular and plural keys
  // are listed because the code picks between them with a ternary; the Hindi reads
  // right with the number dropped in, and the two buttons are meant to look the
  // same in either case.
  "Delete my conversation history": "मेरी बातचीत का इतिहास मिटाएँ",
  "Checking your stored conversations…": "आपकी सहेजी हुई बातचीत देख रहे हैं…",
  "No conversations are stored right now.": "अभी कोई बातचीत सहेजी नहीं गई है।",
  "{count} conversation stored. Deleting ends each one and removes its messages.":
    "{count} बातचीत सहेजी गई है। मिटाने से वह खत्म हो जाएगी और उसके संदेश भी मिट जाएँगे।",
  "{count} conversations stored. Deleting ends each one and removes its messages.":
    "{count} बातचीत सहेजी गई हैं। मिटाने से हर बातचीत खत्म हो जाएगी और उसके संदेश भी मिट जाएँगे।",
  "Delete history": "इतिहास मिटाएँ",
  "Your parent account does not store conversations. Conversation history belongs to each child's own account, and only they can view or delete it.":
    "आपके अभिभावक अकाउंट में बातचीत सहेजी नहीं जाती। बातचीत का इतिहास हर बच्चे के अपने अकाउंट का हिस्सा है, और उसे सिर्फ़ वह बच्चा ही देख या मिटा सकता है।",
  "This ends and clears {count} conversation — the messages, not your saved careers or themes.":
    "इससे {count} बातचीत खत्म होकर साफ़ हो जाएगी — सिर्फ़ उसके संदेश, आपके सेव किए करियर या विषय नहीं।",
  "This ends and clears {count} conversations — the messages, not your saved careers or themes.":
    "इससे {count} बातचीत खत्म होकर साफ़ हो जाएँगी — सिर्फ़ उनके संदेश, आपके सेव किए करियर या विषय नहीं।",
  "Delete {count} conversation": "{count} बातचीत मिटाएँ",
  "Delete {count} conversations": "{count} बातचीत मिटाएँ",
  "This cannot be undone from this screen. Saved careers, interest themes and your journey counts stay — only the message text is deleted. If you want everything gone, that is fine: delete the history, then remove careers you saved from the explorer.":
    "यह इस स्क्रीन से वापस नहीं होगा। सेव किए करियर, रुचि के विषय और आपकी यात्रा की गिनतियाँ बनी रहेंगी — सिर्फ़ संदेशों का टेक्स्ट मिटेगा। अगर सब कुछ हटाना चाहते हैं तो ठीक है: पहले इतिहास मिटाएँ, फिर एक्सप्लोरर में जाकर सेव किए करियर हटाएँ।",

  // The two band headings the profile picker reads from `types.ts`, and the one
  // sentence the account card prints under a parent's name. The section titles above
  // this line already have a home in `account.ts`, which is the file that introduced
  // them.
  "Government school": "सरकारी स्कूल",
  "Private school": "प्राइवेट स्कूल",
  "Parent account · sees only what a child shares":
    "अभिभावक अकाउंट · सिर्फ़ वह दिखेगा जो बच्चा शेयर करे",

  // ---------------------------------------------- Sentences the server writes
  // Three lines on this screen are not typed in the frontend at all: the voice note
  // comes from `services/tts.py`, the email note from `routers/clerk.py`, the sharing
  // note from `routers/auth.py`. They are UI copy a student reads, so they are
  // translated here; all three provider variants get an entry because which one
  // renders depends on the deployment's keys, not on this file.
  "Audio is generated by Microsoft Edge TTS, an online service. It needs internet access and can be unavailable at times, so every reply also stays readable as text.":
    "आवाज़ Microsoft Edge TTS से बनती है, जो एक ऑनलाइन सर्विस है। इसके लिए इंटरनेट चाहिए और कभी-कभी यह उपलब्ध नहीं रहती, इसलिए हर जवाब टेक्स्ट में भी पढ़ने लायक रहता है।",
  "Audio is generated by Google Gemini TTS, an online service called with the server's key. The reply text is sent to Google to make the audio. It needs internet access and can be unavailable at times, so every reply also stays readable as text.":
    "आवाज़ Google Gemini TTS से बनती है — यह ऑनलाइन सर्विस सर्वर की की से कॉल होती है। आवाज़ बनाने के लिए जवाब का टेक्स्ट Google तक भेजा जाता है। इसके लिए इंटरनेट चाहिए और कभी-कभी यह उपलब्ध नहीं रहती, इसलिए हर जवाब टेक्स्ट में भी पढ़ने लायक रहता है।",
  "Audio is generated by Microsoft Azure Speech, an online service called with the server's key. The reply text is sent to Microsoft to make the audio. It needs internet access and can be unavailable at times, so every reply also stays readable as text.":
    "आवाज़ Microsoft Azure Speech से बनती है — यह ऑनलाइन सर्विस सर्वर की की से कॉल होती है। आवाज़ बनाने के लिए जवाब का टेक्स्ट Microsoft तक भेजा जाता है। इसके लिए इंटरनेट चाहिए और कभी-कभी यह उपलब्ध नहीं रहती, इसलिए हर जवाब टेक्स्ट में भी पढ़ने लायक रहता है।",
  "This account lives in this browser. Connecting an email lets you open the same work from another device; it does not move anything or delete the device account.":
    "यह अकाउंट आपके ब्राउज़र में ही रहता है। ई-मेल जोड़ने से वही काम दूसरे डिवाइस से भी खुलेगा — इसमें कुछ भी हटाया या स्थानांतरित नहीं होता, और इस डिवाइस का अकाउंट नहीं मिटता।",
  "Share this only with a parent or guardian you choose. They will see the summary you allow, never your conversations, unless you turn that on.":
    "यह कोड सिर्फ़ उन्हीं अभिभावकों को दें जिनकी आप चाहते हैं। उन्हें वही सारांश दिखेगा जिसकी आपने मंज़ूरी दी है — आपकी बातचीत कभी नहीं, जब तक आप इसे चालू न करें।",

  // ------------------------------------------------ Voice status, one word per branch
  "Voice — Hindi": "आवाज़ — हिन्दी",
  "Voice — {language}": "आवाज़ — {language}",
  "Asking the server which speech service it uses…":
    "सर्वर से पूछा जा रहा है कि वह कौन सी स्पीच सर्विस इस्तेमाल करता है…",
  "Asking the server whether an email is connected…":
    "सर्वर से पूछा जा रहा है कि ई-मेल जुड़ा है या नहीं…",
  "The server could not be reached, so its voice is unknown.":
    "सर्वर से संपर्क नहीं हो सका, इसलिए उसकी आवाज़ पता नहीं।",
  "{provider} turned a reply into real audio{when}.":
    "{provider} ने एक जवाब को असली आवाज़ में बदल दिया था{when}।",
  "{provider} was asked and refused: {reason} Replies are read by your browser's own voice instead.":
    "{provider} से आवाज़ माँगी गई पर वह नहीं दी: {reason} अब जवाब आपके ब्राउज़र की अपनी आवाज़ में सुनाए जाएँगे।",
  "Nothing has been spoken by {provider} yet. Run the test below to ask it for audio.":
    "{provider} ने अभी तक कुछ बोला नहीं है। आवाज़ माँगने के लिए नीचे दिया टेस्ट चलाएँ।",
  "no audio came back": "कोई आवाज़ वापस नहीं आई",
  "the server": "सर्वर",

  // The two profile pickers whose option lists live in `types.ts`.
  "School setting": "स्कूल कैसा है",
  "Cost situation": "खर्चे की हालत",
};
