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

  // Email sign-in
  "Email disconnected. This browser still opens your work exactly as before.":
    "ईमेल अलग कर दिया गया। यह ब्राउज़र आपका काम बिल्कुल पहले की तरह ही खोलेगा।",

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
  "Loading your consent records…": "आपकी अनुमति के रिकॉर्ड लोड हो रहे हैं…",
  // The three consent rows. The `grant` line lands in a Toggle's `description`, which
  // does run through t(); the `withdraw` line beside it on screen is rendered bare and
  // so has no dictionary hit yet — it needs a t() in the page first.
  "Lets us keep your class, age and interests so suggestions fit you. Without it, nothing is personalised.":
    "इससे हम आपकी कक्षा, उम्र और रुचियाँ सहेज रखते हैं, ताकि सुझाव आपको सही बैठें। इसके बिना कुछ भी आपके हिसाब से ढाला नहीं जाता।",
  "Lets the guide turn what you say into text and read replies aloud. Plain typing works without this.":
    "इससे गाइड आपके बोले हुए शब्दों को टेक्स्ट बना पाता है और जवाब बोलकर सुनाता है। इसके बिना भी आप सादे टाइप से बात कर सकते हैं।",
  "Include my themes in the parent summary": "अभिभावक के सारांश में मेरी रुचि के विषय शामिल करें",
  "Lets a linked parent see the themes, saved careers and progress counts on their dashboard. Your conversation text is never included unless you switch it on for that parent.":
    "इससे आपसे जुड़ा अभिभावक अपने डैशबोर्ड पर आपकी रुचि के विषय, सेव किए करियर और प्रगति की गिनती देख सकता है। आपकी बातचीत के शब्द कभी शामिल नहीं होते, जब तक कि आप उसे उसी अभिभावक के लिए चालू न करें।",

  // Family access
  "A parent can only see a summary if you give them this code — they cannot attach by guessing. You can revoke it any time.":
    "अभिभावक को आपका सारांश तभी दिखेगा जब आप उन्हें यह कोड देंगे — अनुमान लगाकर वे अपने आप नहीं जुड़ सकते। यह कोड आप कभी भी रद्द कर सकते हैं।",
  "New sharing code ready. The previous one stopped working.":
    "नया शेयरिंग कोड तैयार है। पुराना कोड अब काम नहीं करता।",
  "Your browser blocked copying — please write it down instead.":
    "आपके ब्राउज़र ने कॉपी करना रोक दिया — कृपया आप उसे लिख लें।",
  "Link removed. That adult can no longer see your summary.":
    "लिंक हटा दिया गया। वह अभिभावक अब आपका सारांश नहीं देख पाएँगे।",

  // This device
  "This prototype has no login, so this browser is what your work belongs to.":
    "इस प्रोटोटाइप में लॉगिन नहीं है, इसलिए आपका काम इसी ब्राउज़र से जुड़ा है।",
  "Start over on this device?": "इस डिवाइस पर नए सिरे से शुरू करें?",
  "This browser will be treated as somebody who has never been here.":
    "इस ब्राउज़र को ऐसा माना जाएगा जो यहाँ कभी आया ही नहीं।",
  "The server could not be asked to forget this device. Try again in a moment.":
    "सर्वर से यह नहीं कहा जा सका कि यह डिवाइस भूल जाए। थोड़ी देर बाद फिर कोशिश करें।",

  // About this build — same wording as account.ts's "{count} honest limitations, in plain words"
  "Honest limitations, in plain words.": "सीड़े शब्दों में ईमानदार सीमाएँ।",

  // Destructive confirmations
  "Delete your conversation history?": "अपनी बातचीत का इतिहास मिटाएँ?",
  "Remove this adult's access?": "इस अभिभावक की पहुँच हटाएँ?",
};
