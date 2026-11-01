/**
 * Hindi for the public study-abroad pages: `/study-abroad`, `/study-abroad/<country>`
 * and the shared frame in `components/study-abroad/study-shell.tsx`, plus the
 * enquiry form's own sentences.
 *
 * What is translated here is the site's own chrome — headings, buttons, notices,
 * failure states and the form. The directory data (country overviews, fee and
 * intake notes, university names and cities, service summaries, published
 * stories) arrives from the backend in English and stays English; each Hindi
 * page says so on itself via `PublicLangNotice`. Country names, university names
 * and test names like IELTS/TOEFL are never translated.
 *
 * Two deliberate English leftovers, following the `/careers` convention:
 * - the university search placeholder still lists `engineering, medicine,
 *   Melbourne`, because the directory is stored in English and Hindi search
 *   words would guarantee an empty result (the key maps to itself);
 * - `you@example.com` and `+91…` are format examples, not words (same treatment);
 * - `metadata` titles and descriptions stay English for crawlers.
 *
 * Every entry is on one line on purpose: the two checkers in `scripts/` read this
 * folder as text, and a key wrapped onto its own line is a key they cannot see.
 */
export const HI: Record<string, string> = {
  // ------------------------------------------------------------ /study-abroad index
  "Study abroad made simple": "विदेश में पढ़ाई, आसान भाषा में",
  "{n} destinations explained in the language a family actually argues in, {u} universities with each one's own official site attached, and a plain description of what a paid adviser does at every stage — from a class 9 profile to a visa document list.": "{n} देशों की जानकारी उसी भाषा में जिसमें परिवार असल में बात करता है, {u} विश्वविद्यालय हर एक की अपनी आधिकारिक साइट के साथ, और हर पड़ाव पर एक सशुल्क सलाहकार क्या करता है इसका साफ़ विवरण — कक्षा 9 की प्रोफ़ाइल से लेकर वीज़ा दस्तावेज़ों की लिस्ट तक।",
  "What this directory does not do is quote a number it has not read from a source. Tuition, living costs, application deadlines and visa rules are the four things that change every year, so a page here that has not been re-read says so and links to the government or university page that owns the answer. An estimate would look more finished and be worth less.": "यह डायरेक्टरी कोई ऐसा आँकड़ा नहीं बताती जो उसने किसी स्रोत से पढ़ा न हो। ट्यूशन फ़ीस, रहने का खर्च, आवेदन की आख़िरी तारीख़ और वीज़ा नियम — ये चार चीज़ें हर साल बदलती हैं, इसलिए यहाँ जिस पेज को दोबारा नहीं पढ़ा गया है, वह खुद कह देता है और उस सरकारी या विश्वविद्यालय पेज का लिंक देता है जिसके पास असली जवाब है। अंदाज़े से बताई गई बात देखने में पूरी लगेगी, पर उसकी कीमत कम होगी।",
  "Book a free consultation": "मुफ़्त परामर्श बुक करें",
  "“Book” here means an enquiry, not a calendar slot: nothing is scheduled until somebody replies. See the form at the bottom of this page.": "यहाँ “बुक” का मतलब पूछताछ है, कैलेंडर में समय पक्का करना नहीं: जब तक कोई जवाब न दे, कुछ भी तय नहीं होता। इस पेज के नीचे दिया फ़ॉर्म देखें।",
  "Browse career profiles instead": "बजाय इसके करियर प्रोफ़ाइलें देखें",
  "country and service descriptions": "देशों और सेवाओं के विवरण",
  "Destinations": "पढ़ाई के देश",
  "Each country page covers the same five things: how admission works there, when the intakes are, what the money question looks like, which English test the universities accept, and which official portal owns the visa rule.": "हर देश का पेज वही पाँच बातें बताता है: वहाँ दाखिला कैसे होता है, इंटेक कब होते हैं, पैसे का सवाल कैसा दिखता है, विश्वविद्यालय कौन-सा अंग्रेज़ी टेस्ट मानते हैं, और वीज़ा नियम किस आधिकारिक पोर्टल के पास है।",
  "No destination is listed yet": "अभी कोई देश लिस्ट में नहीं है",
  "The directory table is empty on this deployment, which means the seed has not been run — not that studying abroad is impossible. Nothing has been invented to fill these cards.": "इस इंस्टॉलेशन में डायरेक्टरी टेबल ख़ाली है, यानी सीड डेटा नहीं डाला गया है — इसका मतलब यह नहीं कि विदेश में पढ़ाई नामुमकिन है। इन कार्डों को भरने के लिए कुछ भी गढ़ा नहीं गया है।",
  "{n} university listed": "{n} विश्वविद्यालय लिस्ट में",
  "{n} universities listed": "{n} विश्वविद्यालय लिस्ट में",
  "copy re-checked": "जानकारी दोबारा जाँची गई",
  "copy not yet re-checked": "जानकारी अभी दोबारा नहीं जाँची गई",
  "What we do, and what we refuse to do": "हम क्या करते हैं, और क्या करने से साफ़ मना करते हैं",
  "Four services, each with the part it will not take on written next to it. The refusal is the more useful half of the description: a statement of purpose has to be the student's own words, and a visa decision is not anybody's to promise.": "चार सेवाएँ, हर एक के साथ यह भी लिखा है कि वह क्या नहीं करेगी। मना करना ही विवरण का ज़्यादा काम का हिस्सा है: स्टेटमेंट ऑफ़ पर्पज़ विद्यार्थी के अपने शब्दों में होना चाहिए, और वीज़ा का फ़ैसला कोई वादा करके नहीं दे सकता।",
  "No service is listed yet": "अभी कोई सेवा लिस्ट में नहीं है",
  "The services table is empty on this deployment. Read the careers guide or the": "इस इंस्टॉलेशन में सेवाओं की टेबल ख़ाली है। तब तक करियर गाइड या",
  "contact page": "संपर्क पेज",
  "in the meantime.": "पढ़ें।",
  "Offered": "उपलब्ध",
  "Not offered yet": "अभी उपलब्ध नहीं",
  "Never covers: ": "कभी शामिल नहीं: ",
  "Success stories": "सफलता की कहानियाँ",
  "There are none yet, and there will not be a fabricated one to fill this space. A story appears here when a student or a parent has agreed by name to it being published, with the year and the destination they are willing to be quoted on.": "अभी कोई कहानी नहीं है, और यह जगह भरने के लिए कोई गढ़ी हुई कहानी नहीं डाली जाएगी। कहानी यहाँ तभी दिखती है जब कोई विद्यार्थी या अभिभावक अपना नाम देकर उसे प्रकाशित करने पर राज़ी हो, उस साल और देश के साथ जिसका ज़िक्र वे करवाना चाहते हैं।",
  "If that describes you, the enquiry form below is the place to say so — a quote is added only after it is written down and confirmed.": "अगर यह बात आप पर लागू होती है, तो नीचे दिए पूछताछ फ़ॉर्म में बताइए — कोई बात उद्धृत तभी की जाती है जब वह लिखकर पक्की कर ली गई हो।",
  "Ask for a free consultation": "मुफ़्त परामर्श के लिए पूछें",
  "Tell us the student's class and the destination you are thinking about. A person reads every one of these; there is no auto-reply and no call centre.": "हमें विद्यार्थी की कक्षा और वह देश बताइए जिसके बारे में आप सोच रहे हैं। हर पूछताछ एक इंसान पढ़ता है; न कोई ऑटो-रिप्लाई है, न कोई कॉल सेंटर।",

  // ------------------------------------------------- /study-abroad/<country> — one destination
  "All destinations": "सभी देश",
  "Studying in {country}": "{country} में पढ़ाई",
  "country description and university details": "देश का विवरण और विश्वविद्यालयों की जानकारी",
  "Universities in this directory": "इस डायरेक्टरी के विश्वविद्यालय",
  "{shown} shown · {verified} with a detail somebody has read off a source": "{shown} दिखाए गए · {verified} की कोई जानकारी किसी ने स्रोत से पढ़ी है",
  "Search universities in {country}": "{country} के विश्वविद्यालय खोजें",
  // The directory is stored in English; Hindi search words would find nothing.
  "engineering, medicine, Melbourne": "engineering, medicine, Melbourne",
  "No university here matches that word": "यहाँ कोई विश्वविद्यालय उस शब्द से मेल नहीं खाता",
  "No university listed for this destination yet": "इस देश के लिए अभी कोई विश्वविद्यालय लिस्ट में नहीं है",
  "The list above is everything this directory holds for this country. An empty result means the word is not in a name or city, not that the university does not exist.": "ऊपर की लिस्ट इस देश के लिए इस डायरेक्टरी में मौजूद सब कुछ है। ख़ाली नतीजे का मतलब है कि वह शब्द किसी नाम या शहर में नहीं है, यह नहीं कि विश्वविद्यालय होता ही नहीं।",
  "This destination is described, but nobody has added its institutions to the directory. Use the official portals below until it is filled.": "इस देश का विवरण है, पर अभी किसी ने इसके संस्थान डायरेक्टरी में नहीं डाले हैं। जब तक यह नहीं भर जाता, नीचे दिए आधिकारिक पोर्टल इस्तेमाल करें।",
  "{kind} university": "{kind} विश्वविद्यालय",
  "Public": "सरकारी",
  "paid listing": "सशुल्क लिस्टिंग",
  "A name, a city and a link are the only claims made here. Fees, deadlines and entry requirements belong to the university's own page, which is why every row links out rather than quoting.": "यहाँ सिर्फ़ नाम, शहर और लिंक बताए गए हैं। फ़ीस, आख़िरी तारीख़ और दाखिले की शर्तें विश्वविद्यालय के अपने पेज पर होती हैं, इसलिए हर पंक्ति आँकड़ा बताती नहीं, बल्कि उसी पेज का लिंक देती है।",
  "What it costs": "खर्चा कितना",
  "Intakes": "इंटेक (दाखिले के दौर)",
  "English requirements": "अंग्रेज़ी की शर्तें",
  "Visa, work rights and what changes": "वीज़ा, काम का अधिकार और क्या बदलता है",
  "Questions to answer from an official page": "वे सवाल जिनका जवाब आधिकारिक पेज से लें",
  "Not from ours. Each of these has a published answer that moves between admission cycles, and the one printed on the university's own site for the year a student would start is the only one worth planning on.": "हमारे पेज से नहीं। इनमें से हर सवाल का प्रकाशित जवाब हर दाखिला दौर में बदलता है, और विद्यार्थी जिस साल शुरू करेगा उस साल के लिए विश्वविद्यालय की अपनी साइट पर छपा जवाब ही योजना बनाने लायक है।",
  "The pages that own these rules": "वे पेज जिनके पास इन नियमों की असली जानकारी है",
  "Student visa and work rights": "स्टूडेंट वीज़ा और काम का अधिकार",
  "Recognition of Indian qualifications": "भारतीय डिग्रियों की मान्यता",
  "This site is not a government service, is not affiliated with these portals, and cannot see or speed up anything filed through them.": "यह साइट कोई सरकारी सेवा नहीं है, इन पोर्टलों से इसका कोई संबंध नहीं है, और इनके ज़रिए जमा की गई किसी चीज़ को यह न देख सकती है, न तेज़ कर सकती है।",
  "Ask about {country}": "{country} के बारे में पूछें",
  "Say that you are asking about {country} and what stage the student is at. Whoever reads this sees the destination attached to the enquiry.": "लिखिए कि आप {country} के बारे में पूछ रहे हैं और विद्यार्थी किस पड़ाव पर है। जो भी इसे पढ़ेगा, उसे पूछताछ के साथ देश भी दिखेगा।",
  "Back to all destinations": "वापस सभी देशों पर",
  "The services are listed with the destinations": "सेवाएँ देशों के साथ लिस्ट में हैं",
  "Every service has its own page under this address. The list of them, with which are being offered now, is on the study abroad page.": "हर सेवा का इसी पते के नीचे अपना पेज है। उनकी लिस्ट, और कौन-सी अभी दी जा रही हैं, विदेश में पढ़ाई वाले पेज पर है।",
  "See the services": "सेवाएँ देखें",

  // ------------------------------------------------------- study-shell — shared failure states
  "The study-abroad list could not be loaded": "विदेश में पढ़ाई की लिस्ट लोड नहीं हो सकी",
  "This page asked the directory API for {what} and got no usable answer. The destinations and universities are stored in the backend database, so nothing here can be listed until that service is reachable again.": "इस पेज ने डायरेक्टरी API से {what} माँगा और कोई काम का जवाब नहीं मिला। देश और विश्वविद्यालय बैकएंड डेटाबेस में हैं, इसलिए जब तक वह सेवा फिर से उपलब्ध न हो, यहाँ कुछ भी दिख नहीं सकता।",
  "This is not the site saying the directory is empty — it is the site saying it does not know. Nothing has been filled in from a cached or invented list.": "यह साइट यह नहीं कह रही कि डायरेक्टरी ख़ाली है — यह साइट यह कह रही है कि उसे पता नहीं है। यहाँ कोई कैश की गई या गढ़ी हुई लिस्ट भरकर नहीं दिखाई गई है।",
  "the destinations, the services and the published stories": "देशों, सेवाओं और प्रकाशित कहानियों की लिस्ट",
  "the destination “{slug}” and its university list": "देश “{slug}” और उसकी विश्वविद्यालय लिस्ट",
  "Talk to the career guide instead": "बजाय इसके करियर गाइड से बात करें",
  "No destination is listed under that name": "इस नाम से कोई देश लिस्ट में नहीं है",
  "No service is listed under that name": "इस नाम से कोई सेवा लिस्ट में नहीं है",
  "is not in the directory this deployment has seeded. It may have been renamed, or the link may have come from a different build.": "इस इंस्टॉलेशन की डायरेक्टरी में नहीं है। हो सकता है इसका नाम बदल गया हो, या लिंक किसी दूसरे बिल्ड से आया हो।",
  "See the destinations that are listed": "जो देश लिस्ट में हैं उन्हें देखें",
  "See the services that are listed": "जो सेवाएँ लिस्ट में हैं उन्हें देखें",
  "The words on this page have not been re-read against the government portals linked below since they were written. Read those portals for the rule that applies to you; this page is a description, not the source.": "इस पेज की बातें लिखे जाने के बाद नीचे लिंक किए सरकारी पोर्टलों से दोबारा नहीं जाँची गई हैं। आप पर लागू नियम के लिए वे पोर्टल पढ़ें; यह पेज एक विवरण है, स्रोत नहीं।",
  "Last re-read against the official portals on {day}. Rules and fees move; the linked pages are still the authority.": "आधिकारिक पोर्टलों से आख़िरी बार {day} को दोबारा जाँचा गया। नियम और फ़ीस बदलते रहते हैं; लिंक किए पेज ही अभी भी असली प्रमाण हैं।",
  "Not verified yet — check the university's own site.": "अभी जाँचा नहीं गया — विश्वविद्यालय की अपनी साइट देखें।",
  "Open it": "खोलें",
  "Details verified": "विवरण जाँचे गए",
  "Name and address only": "सिर्फ़ नाम और पता",

  // ------------------------------------------------------------- lead-form — the enquiry form
  "Tick the box first — nothing is stored without it.": "पहले बॉक्स पर टिक करें — इसके बिना कुछ भी सेव नहीं होता।",
  "A name and an email address are needed to reply.": "जवाब देने के लिए नाम और ईमेल पता चाहिए।",
  "The enquiry could not be sent. Check your connection and try again.": "पूछताछ भेजी नहीं जा सकी। अपना कनेक्शन जाँचें और फिर कोशिश करें।",
  "Your enquiry is stored. Nothing else has happened yet.": "आपकी पूछताछ सेव हो गई है। अभी और कुछ नहीं हुआ है।",
  "A copy has been sent to the address you gave, so check your inbox for it.": "आपके दिए पते पर एक कॉपी भेज दी गई है, इसलिए अपना इनबॉक्स देखें।",
  "No confirmation mail left this server:": "इस सर्वर से कोई पुष्टि मेल नहीं गया:",
  "No consultation is booked by this form. No date or time is held for anyone, and no university or visa outcome is promised. If a reply comes, it comes to the address you typed.": "इस फ़ॉर्म से कोई परामर्श बुक नहीं होता। किसी के लिए कोई तारीख़ या समय नहीं रखा जाता, और न किसी विश्वविद्यालय या वीज़ा नतीजे का वादा है। जवाब आएगा तो उसी पते पर आएगा जो आपने लिखा है।",
  "This deployment has no operator address configured, so nobody was mailed about it either. The /contact page is the channel that does not depend on that setting.": "इस इंस्टॉलेशन में ऑपरेटर का पता सेट नहीं है, इसलिए किसी को इसकी मेल भी नहीं गई। /contact पेज वह ज़रिया है जो इस सेटिंग पर निर्भर नहीं करता।",
  "Open contact": "संपर्क पेज खोलें",
  "This enquiry will say it came from:": "इस पूछताछ में लिखा होगा कि यह यहाँ से आई:",
  "Who should we address?": "हम किस नाम से संबोधित करें?",
  "Used only to reply to this enquiry. It is not added to any mailing list.": "सिर्फ़ इस पूछताछ का जवाब देने के लिए। इसे किसी मेलिंग लिस्ट में नहीं डाला जाता।",
  "Phone (optional)": "फ़ोन (वैकल्पिक)",
  "Only if you would rather be called. It is never shared with a university.": "सिर्फ़ अगर आप फ़ोन पर बात करना चाहें। यह कभी किसी विश्वविद्यालय से साझा नहीं होता।",
  "Where the student is (optional)": "विद्यार्थी अभी कहाँ है (वैकल्पिक)",
  "Not stated": "बताया नहीं",
  "Already in college": "पहले से कॉलेज में",
  "Somewhere else": "कहीं और",
  "What would you like to ask? (optional)": "आप क्या पूछना चाहेंगे? (वैकल्पिक)",
  "One or two sentences is enough for a first conversation.": "पहली बातचीत के लिए एक-दो वाक्य काफ़ी हैं।",
  "Please leave out the school name, marks, documents and any other detail that identifies the student by record. A first conversation does not need them.": "कृपया स्कूल का नाम, अंक, दस्तावेज़ और कोई और ऐसी जानकारी न लिखें जिससे विद्यार्थी के रिकॉर्ड की पहचान हो। पहली बातचीत के लिए इनकी ज़रूरत नहीं।",
  "You may contact me at this address about this enquiry.": "आप इस पूछताछ के बारे में मुझसे इस पते पर संपर्क कर सकते हैं।",
  "Without this tick nothing is stored at all. The enquiry can be deleted on request — see the privacy policy.": "इस टिक के बिना कुछ भी सेव नहीं होता। पूछताछ कहने पर मिटाई जा सकती है — प्राइवेसी पॉलिसी देखें।",
  "Send enquiry": "पूछताछ भेजें",
  // Format examples, not words — they render the same in both languages.
  "you@example.com": "you@example.com",
  "+91…": "+91…",
};