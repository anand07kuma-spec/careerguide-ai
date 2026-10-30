/**
 * Hindi for the public study-abroad pages — `/study-abroad`, one destination page,
 * one service page, the shared `study-shell` frame around them, and the enquiry
 * form that sits at the bottom of all three — plus the bare `Career` heading the
 * app's own career page shows when there is nothing to show.
 *
 * Keys are the English source text, so an untranslated string still renders — in
 * English — instead of vanishing from a child's screen.
 *
 * These are server components, so the swap happens before the HTML is sent (see
 * `lib/public-i18n.ts`), and `metadata` titles and descriptions stay English exactly
 * as on `/careers`. The form's sentences about what it stores, what it never shares
 * and whether a mail actually left are translated at the same strength as the English
 * says them — nothing promised that the server has not promised, nothing softened.
 *
 * Two things deliberately stay English on the Hindi render, and each page says so on
 * itself with `PublicLangNotice` rather than leaving the reader to notice the gap: the
 * directory's own records — country names, overviews, service titles, university rows,
 * the `to_check` questions — are the backend's English text, and the university search
 * placeholder suggests English words because that is what the rows are stored in.
 */

export const HI: Record<string, string> = {
  // The enquiry form's own messages, most of them legal-adjacent
  "Tick the box first — nothing is stored without it.":
    "पहले बॉक्स पर टिक करें — उसके बिना कुछ भी सहेजा नहीं जाता।",
  "A name and an email address are needed to reply.": "जवाब देने के लिए नाम और ईमेल पता ज़रूरी है।",
  "The enquiry could not be sent. Check your connection and try again.":
    "पूछताछ भेजी नहीं जा सकी। अपना कनेक्शन जाँचें और फिर कोशिश करें।",
  "Your enquiry is stored. Nothing else has happened yet.":
    "आपकी पूछताछ सहेज ली गई है। अभी इसके सिवा और कुछ नहीं हुआ है।",
  "A copy has been sent to the address you gave, so check your inbox for it.":
    "आपके दिए पते पर इसकी एक प्रति भेज दी गई है, इसलिए अपने इनबॉक्स में देख लें।",
  // Says "no mail left", because on a build with no key configured none can leave.
  "No confirmation mail left this server:": "इस सर्वर से कोई पुष्टि-मेल नहीं भेजा गया:",
  "Open contact": "संपर्क पेज खोलें",
  "This enquiry will say it came from:": "इस पूछताछ में लिखा होगा कि यह कहाँ से आई है:",
  // Every negation survives: nothing booked, no date held, no outcome promised, and a reply
  // only if one comes — the conditional stays a conditional.
  "No consultation is booked by this form. No date or time is held for anyone, and no university or visa outcome is promised. If a reply comes, it comes to the address you typed.":
    "इस फ़ॉर्म से कोई काउंसलेशन बुक नहीं होता। किसी के लिए कोई तारीख़ या समय नहीं रखा जाता, और न ही किसी यूनिवर्सिटी या वीज़ा के नतीजे का वादा किया जाता है। अगर जवाब आएगा, तो उसी पते पर आएगा जो आपने लिखा है।",
  // Says nobody was mailed, because with no operator address set there was nobody to mail.
  "This deployment has no operator address configured, so nobody was mailed about it either. The /contact page is the channel that does not depend on that setting.":
    "इस डिप्लॉयमेंट पर ऑपरेटर का पता सेट नहीं है, इसलिए इस बारे में किसी को भी मेल नहीं भेजा गया। /contact पेज वह रास्ता है जो इस सेटिंग पर निर्भर नहीं करता।",
  // The one sentence the index page hands to the form as `intro`.
  "Tell us the student's class and the destination you are thinking about. A person reads every one of these; there is no auto-reply and no call centre.":
    "बताएँ कि विद्यार्थी कौन-सी कक्षा में है और आप किस देश के बारे में सोच रहे हैं। यह हर पूछताछ कोई इंसान ही पढ़ता है; यहाँ कोई ऑटो-रिप्लाई नहीं है और न कोई कॉल सेंटर है।",

  // Field labels, placeholders and hints
  "Who should we address?": "किसका नाम लिखें?",
  "Used only to reply to this enquiry. It is not added to any mailing list.":
    "इसका इस्तेमाल सिर्फ़ इस पूछताछ का जवाब देने के लिए होगा। इसे किसी मेलिंग लिस्ट में नहीं जोड़ा जाता।",
  "Phone (optional)": "फ़ोन (ज़रूरी नहीं)",
  "Only if you would rather be called. It is never shared with a university.":
    "सिर्फ़ अगर आप फ़ोन पर बात करना चाहें। यह नंबर किसी विश्वविद्यालय को कभी नहीं दिया जाता।",
  "Where the student is (optional)": "विद्यार्थी अभी कहाँ है (ज़रूरी नहीं)",
  "Not stated": "बताया नहीं गया",
  // `Select` translates every `options[].label` itself, so the stage list needs its own key.
  "Already in college": "पहले से कॉलेज में",
  "What would you like to ask? (optional)": "आप क्या पूछना चाहते हैं? (ज़रूरी नहीं)",
  "One or two sentences is enough for a first conversation.":
    "पहली बातचीत के लिए एक-दो वाक्य काफ़ी हैं।",
  "Please leave out the school name, marks, documents and any other detail that identifies the student by record. A first conversation does not need them.":
    "कृपया स्कूल का नाम, अंक, दस्तावेज़ और कोई भी ऐसी बात न लिखें जिससे विद्यार्थी का रिकॉर्ड पहचाना जा सके। पहली बातचीत में इनकी ज़रूरत नहीं होती।",
  // The consent tick — worded as the same sentence is worded in `legal.ts`.
  "You may contact me at this address about this enquiry.":
    "इस पूछताछ के बारे में आप मुझे इस पते पर संपर्क कर सकते हैं।",
  "Without this tick nothing is stored at all. The enquiry can be deleted on request — see the privacy policy.":
    "इस टिक के बिना कुछ भी सहेजा नहीं जाता। पूछताछ को कहने पर हटवाया जा सकता है — गोपनीयता नीति देखें।",
  "Send enquiry": "पूछताछ भेजें",
  // Both placeholders are the form an address or a number has to be typed in, so they
  // stay as written: `you@example.com` and `+91…` mean the same to a Hindi reader.
  "you@example.com": "you@example.com",
  "+91…": "+91…",

  // Section headings on `/study-abroad/[country]`
  "What it costs": "कितना खर्च होता है",
  "Intakes": "प्रवेश के महीने",
  "English requirements": "अंग्रेज़ी की शर्तें",
  "Visa, work rights and what changes": "वीज़ा, काम के अधिकार और क्या बदलता है",
  // Like the `/careers` search box, this placeholder lists English words: the
  // university names and cities in the directory are stored in English, so Hindi
  // suggestions would send a reader to a guaranteed empty result.
  "engineering, medicine, Melbourne": "engineering, medicine, Melbourne",
  "Search universities in {name}": "{name} के विश्वविद्यालय खोजें",
  "Universities in this directory": "इस डायरेक्टरी के विश्वविद्यालय",
  "{n} shown · {m} with a detail somebody has read off a source":
    "{n} दिख रहे हैं · {m} के बारे में किसी ने किसी स्रोत से पढ़कर जानकारी लिखी है",
  "Official site": "आधिकारिक साइट",
  "Public university": "सरकारी विश्वविद्यालय",
  "Private university": "प्राइवेट विश्वविद्यालय",
  "paid listing": "पैसा देकर लिस्ट में",
  "No university here matches that word": "यहाँ कोई विश्वविद्यालय उस शब्द से मेल नहीं खाता",
  "No university listed for this destination yet": "इस देश के लिए अभी कोई विश्वविद्यालय लिस्ट में नहीं है",
  // Names and cities are stored in English, so an empty result is usually the
  // reader typing Hindi — said here the same way `/careers` says it.
  "The list above is everything this directory holds for this country. An empty result means the word is not in a name or city, not that the university does not exist.":
    "ऊपर जो लिस्ट दिखती है, इस देश के लिए डायरेक्टरी में बस वही है। ख़ाली नतीजे का मतलब यह नहीं कि वह विश्वविद्यालय होता ही नहीं, बल्कि यह कि वह शब्द किसी नाम या शहर में नहीं है। नाम और शहर अंग्रेज़ी में लिखे हैं, इसलिए अंग्रेज़ी का शब्द खोजें।",
  "This destination is described, but nobody has added its institutions to the directory. Use the official portals below until it is filled.":
    "इस देश के बारे में पेज लिखा है, पर किसी ने भी उसकी संस्थाएँ डायरेक्टरी में नहीं जोड़ी हैं। यह भरने तक नीचे दिए आधिकारिक पोर्टल देखें।",
  "A name, a city and a link are the only claims made here. Fees, deadlines and entry requirements belong to the university’s own page, which is why every row links out rather than quoting.":
    "यहाँ बस तीन बातों का दावा किया जाता है — नाम, शहर और एक लिंक। फ़ीस, डेडलाइन और दाखिले की शर्तें विश्वविद्यालय के अपने पन्ने पर होती हैं, इसलिए हर क़तार कुछ कोट करने के बजाय बाहर का लिंक देती है।",
  "Studying in {name}": "{name} में पढ़ाई",
  "All destinations": "सभी देश",
  "Back to all destinations": "सभी देश पर वापस जाएँ",
  "Ask about {name}": "{name} के बारे में पूछें",
  "Questions to answer from an official page": "वे सवाल जिनका जवाब आधिकारिक पन्ने से लेना है",
  "Not from ours. Each of these has a published answer that moves between admission cycles, and the one printed on the university’s own site for the year a student would start is the only one worth planning on.":
    "हमारे पेज से नहीं। हर सवाल का जवाब कहीं छपा होता है, और दो दाखिला चक्रों के बीच वह बदल जाता है; जो जवाब विश्वविद्यालय अपनी साइट पर उस साल के लिए छापता है जब विद्यार्थी पढ़ाई शुरू करेगा, वही योजना बनाने लायक है।",
  "The pages that own these rules": "वे पन्ने जिनके नियम ये हैं",
  "Student visa and work rights": "स्टूडेंट वीज़ा और काम के अधिकार",
  "Recognition of Indian qualifications": "भारतीय योग्यताओं की मान्यता",
  "This site is not a government service, is not affiliated with these portals, and cannot see or speed up anything filed through them.":
    "यह साइट कोई सरकारी सेवा नहीं है, इन पोर्टल से उसका कोई संबंध नहीं है, और इन पर जमा हुई किसी बात को वह देख भी नहीं सकती और तेज़ भी नहीं कर सकती।",
  // `/study-abroad/services` is the section on the index, not a destination, so this
  // branch of the destination route points the reader back to it.
  "The services are listed with the destinations": "सेवाएँ देशों के साथ लिस्ट की गई हैं",
  "Every service has its own page under this address. The list of them, with which are being offered now, is on the study abroad page.":
    "हर सेवा का अपना पेज इस पते पर है। उनकी पूरी लिस्ट, और इसमें अभी कौन-सी मिल रही है, विदेश में पढ़ाई के पेज पर है।",
  "See the services": "सेवाएँ देखें",

  // The `study-shell` frame: the outage panel, the unknown-slug panel, and the two
  // honesty labels that say whether a fact was read off a source.
  "The study-abroad list could not be loaded": "विदेश में पढ़ाई की लिस्ट लोड नहीं हो सकी",
  "This page asked the directory API for {what} and got no usable answer. The destinations and universities are stored in the backend database, so nothing here can be listed until that service is reachable again.":
    "इस पेज ने डायरेक्टरी API से {what} माँगा और कोई काम का जवाब नहीं मिला। देशों और विश्वविद्यालयों की जानकारी बैकएंड डेटाबेस में है, इसलिए जब तक वह सेवा फिर से उपलब्ध न हो, यहाँ कुछ भी दिख नहीं सकता।",
  "This is not the site saying the directory is empty — it is the site saying it does not know. Nothing has been filled in from a cached or invented list.":
    "यह साइट यह नहीं कह रही कि डायरेक्टरी खाली है — यह साइट यह कह रही है कि उसे पता नहीं है। यहाँ कोई कैश की गई या गढ़ी हुई लिस्ट भरकर नहीं दिखाई गई है।",
  "Talk to the career guide instead": "बजाय इसके, करियर गाइड से बात करें",
  "No destination is listed under that name": "इस नाम से कोई देश लिस्ट में नहीं है",
  "No service is listed under that name": "इस नाम से कोई सेवा लिस्ट में नहीं है",
  // The slug prints as a `<code>` piece before this, so the key is the rest of the
  // sentence — and Hindi is fine with the subject first and the verb at the end.
  "is not in the directory this deployment has seeded. It may have been renamed, or the link may have come from a different build.":
    "इस इंस्टॉलेशन की डायरेक्टरी में नहीं है। हो सकता है इसका नाम बदल गया हो, या लिंक किसी दूसरे बिल्ड से आया हो।",
  "See the destinations that are listed": "जो देश लिस्ट में हैं उन्हें देखें",
  "See the services that are listed": "जो सेवाएँ लिस्ट में हैं उन्हें देखें",
  "The words on this page have not been re-read against the government portals linked below since they were written. Read those portals for the rule that applies to you; this page is a description, not the source.":
    "यह पेज जो लिखा गया है, उसे लिखे जाने के बाद नीचे दिए सरकारी पोर्टल से मिलाकर दोबारा नहीं पढ़ा गया। अपने पर लागू होने वाला नियम उन पोर्टल पर पढ़ें; यह पेज विवरण है, स्रोत नहीं।",
  "Last re-read against the official portals on {day}. Rules and fees move; the linked pages are still the authority.":
    "{day} को आधिकारिक पोर्टल से मिलाकर आख़िरी बार पढ़ा गया। नियम और फ़ीस बदलते रहते हैं; अधिकार अब भी लिंक किए गए पन्नों का है।",
  "Not verified yet — check the university’s own site.":
    "अभी जाँची नहीं गई — विश्वविद्यालय की अपनी साइट पर देखें।",
  "Open it": "खोलें",
  "Details verified": "जानकारी जाँची गई",
  "Name and address only": "सिर्फ़ नाम और पता",

  // `/study-abroad` — the index
  "Study abroad made simple": "विदेश में पढ़ाई, आसान भाषा में",
  "{n} destinations explained in the language a family actually argues in, {m} universities with each one’s own official site attached, and a plain description of what a paid adviser does at every stage — from a class 9 profile to a visa document list.":
    "{n} देश उस भाषा में समझाए गए हैं जिसमें एक परिवार सच में बह करता है, {m} विश्वविद्यालय हर एक की अपनी आधिकारिक साइट के साथ, और साफ़ शब्दों में बताया गया है कि पैसे लेकर सलाह देने वाला हर चरण पर क्या करता है — कक्षा 9 की प्रोफ़ाइल से वीज़ा के दस्तावेज़ों की लिस्ट तक।",
  "What this directory does not do is quote a number it has not read from a source. Tuition, living costs, application deadlines and visa rules are the four things that change every year, so a page here that has not been re-read says so and links to the government or university page that owns the answer. An estimate would look more finished and be worth less.":
    "यह डायरेक्टरी वह आँकड़ा नहीं बताती जो किसी स्रोत से पढ़ा नहीं गया हो। ट्यूशन, रहने का खर्चा, आवेदन की डेडलाइन और वीज़ा के नियम — ये चार चीज़ें हर साल बदलती हैं, इसलिए जो पेज यहाँ दोबारा जाँचा नहीं गया, वह खुद ऐसा कहता है और सरकार या विश्वविद्यालय के उस पन्ने पर लिंक देता है जहाँ सही जवाब है। अनुमान से भरा पेज दिखने में ज़्यादा पूरा लगता, पर कम के होता।",
  "Book a free consultation": "मुफ़्त काउंसलेशन बुक करें",
  // The button promises a booking, and the line under it takes the promise back —
  // both halves have to travel together or the Hindi page over-promises.
  "“Book” here means an enquiry, not a calendar slot: nothing is scheduled until somebody replies. See the form at the bottom of this page.":
    "यहाँ “बुक करें” का मतलब पूछताछ भेजना है, कैलेंडर में जगह नहीं — जब तक कोई जवाब नहीं देता, कुछ भी तय नहीं होता। इस पेज के सबसे नीचे दिया फ़ॉर्म देखें।",
  "Browse career profiles instead": "बजाय इसके, करियर प्रोफ़ाइलें देखें",
  "Destinations": "पढ़ाई के लिए देश",
  "Each country page covers the same five things: how admission works there, when the intakes are, what the money question looks like, which English test the universities accept, and which official portal owns the visa rule.":
    "हर देश का पेज यही पाँच बातें बताता है: वहाँ दाखिला कैसे मिलता है, प्रवेश के महीने कौन-से हैं, पैसे का सवाल कैसा है, विश्वविद्यालय कौन-सा इंग्लिश टेस्ट मानते हैं, और वीज़ा का नियम किस आधिकारिक पोर्टल के पास है।",
  "No destination is listed yet": "अभी कोई देश लिस्ट में नहीं है",
  "The directory table is empty on this deployment, which means the seed has not been run — not that studying abroad is impossible. Nothing has been invented to fill these cards.":
    "इस इंस्टॉलेशन पर डायरेक्टरी की टेबल खाली है, यानी सीड नहीं चलाया गया — इसका मतलब यह नहीं कि विदेश में पढ़ाई असंभव है। इन कार्डों को भरने के लिए कुछ भी गढ़ा नहीं गया।",
  // Singular and plural are one sentence in Hindi, so both keys carry the same line.
  "{n} university listed": "{n} विश्वविद्यालय लिस्ट में",
  "{n} universities listed": "{n} विश्वविद्यालय लिस्ट में",
  "copy re-checked": "जानकारी दोबारा जाँची गई",
  "copy not yet re-checked": "जानकारी अभी दोबारा जाँची नहीं गई",
  "What we do, and what we refuse to do": "हम क्या करते हैं, और क्या करने से मना करते हैं",
  "Four services, each with the part it will not take on written next to it. The refusal is the more useful half of the description: a statement of purpose has to be the student’s own words, and a visa decision is not anybody’s to promise.":
    "चार सेवाएँ, और हर एक के बगल में वह हिस्सा लिखा है जो हम नहीं करेंगे। यह मना करना ही विवरण का ज़्यादा काम का हिस्सा है: SOP यानी स्टेटमेंट ऑफ़ पर्सपोज़ में विद्यार्थी के अपने शब्द होने चाहिए, और वीज़ा के फ़ैसले का वादा किसी के बस का नहीं है।",
  "No service is listed yet": "अभी कोई सेवा लिस्ट में नहीं है",
  // One English sentence split at the inline link to `/contact`; Hindi puts the
  // verb after the link, so the three parts still read as a single sentence.
  "The services table is empty on this deployment. Read the careers guide or the":
    "इस इंस्टॉलेशन पर सर्विसेज़ की टेबल खाली है। तब तक करियर गाइड या",
  "contact page": "संपर्क पेज",
  "in the meantime.": "पढ़ लें।",
  "Offered": "उपलब्ध",
  "Not offered yet": "अभी उपलब्ध नहीं",
  "Never covers:": "कभी नहीं करते:",
  "Success stories": "सफलता की कहानियाँ",
  "There are none yet, and there will not be a fabricated one to fill this space. A story appears here when a student or a parent has agreed by name to it being published, with the year and the destination they are willing to be quoted on.":
    "अभी ऐसी कोई कहानी नहीं है, और जगह भरने के लिए कोई गढ़ी हुई कहानी यहाँ नहीं आएगी। कहानी तभी छपती है जब कोई विद्यार्थी या अभिभावक अपने नाम से उसे प्रकाशित करने की मंज़ूरी दे, और साल व देश भी बताए जिसके बारे में वह कहने को तैयार हो।",
  "If that describes you, the enquiry form below is the place to say so — a quote is added only after it is written down and confirmed.":
    "अगर यह आपके बारे में सही है, तो नीचे दिए पूछताछ फ़ॉर्म में बताएँ — कोई उद्धरण तभी जोड़ा जाता है जब उसे लिखा और पक्का किया गया हो।",
  "Ask for a free consultation": "मुफ़्त काउंसलेशन के लिए पूछताछ करें",

  // `/study-abroad/services/[service]` — one service
  "Who it is for:": "यह किसके लिए है:",
  "How it goes": "यह कैसे चलता है",
  "What you get": "इसमें आपको क्या मिलता है",
  "What this never covers": "इसमें जो कभी शामिल नहीं होता",
  "No amount is printed on this page because no amount is fixed here: a fee is quoted for the work a family actually needs, before any of it starts, and nothing is charged automatically.":
    "इस पेज पर कोई रकम नहीं लिखी है, क्योंकि यहाँ कोई रकम तय नहीं है: फ़ीस उस काम के हिसाब से बताई जाती है जो परिवार को सच में चाहिए, वह काम शुरू होने से पहले, और कोई चार्ज अपने आप नहीं कटा जाता।",
  "This one cannot be asked for yet": "इस सेवा के लिए अभी पूछताछ नहीं की जा सकती",
  // The service's own title leads, because it is the directory's English record and
  // is not translated; the placeholder lets Hindi keep it at the front anyway.
  "{name} is described above because the boundary it sits inside matters even when nobody is offering the service: what is written here is what a family should expect from anybody who does. There is deliberately no enquiry form on this page — sending a request for work that is not being taken on would only put a family on a list nobody reads.":
    "ऊपर {name} का वर्णन इसलिए किया गया है कि इस सेवा की हदें जानना ज़रूरी है, चाहे कोई इसे दे रहा हो या न दे: यहाँ जो लिखा है, वही एक परिवार को किसी ऐसे व्यक्ति से चाहिए जो यह काम करता है। इस पेज पर जान-बूझकर पूछताछ का फ़ॉर्म नहीं है — जो काम लिया ही नहीं जाएगा, उसके लिए अनुरोध भेजना परिवार को ऐसी लिस्ट में डालना है जिसे कोई पढ़ता नहीं।",
  "A question that needs a registered adviser should be taken to one. For anything else, the contact page is the channel a person watches.":
    "जो सवाल रजिस्टर्ड सलाहकार से पूछना चाहिए, वह उसे ही ले जाइए। बाक़ी किसी भी बात के लिए संपर्क पेज वह रास्ता है जिस पर कोई इंसान नज़र रखता है।",

  // Phrases interpolated into the failure panel and the Hindi-only notice, so the
  // page can name which half of itself is still English.
  "the destinations, the services and the published stories": "देश, सेवाएँ और प्रकाशित की गई कहानियाँ",
  "the destination “{slug}” and its university list": "देश “{slug}” और उसकी विश्वविद्यालय लिस्ट",
  "the service “{slug}”": "सेवा “{slug}”",
  "the destination and service descriptions": "देशों और सेवाओं के विवरण",
  "the destination overview and the university list": "इस देश का विवरण और विश्वविद्यालयों की लिस्ट",
  "the service description": "सेवा का विवरण",

  // The two `LeadForm` intros that are built on a page from the row's own name.
  "Say that you are asking about {name} and what stage the student is at. Whoever reads this sees the destination attached to the enquiry.":
    "बताएँ कि आप {name} के बारे में पूछ रहे हैं और विद्यार्थी किस चरण पर है। यह पूछताछ जिसे भी पढ़ने के लिए जाएगी, उसे देश के साथ जुड़ी हुई मिलेगी।",
  "Say that you are asking about {name} and what stage the student is at. A person reads every one of these.":
    "बताएँ कि आप {name} के बारे में पूछ रहे हैं और विद्यार्थी किस चरण पर है। यह हर पूछताछ कोई इंसान ही पढ़ता है।",

  // The heading on `/app/careers/[slug]` when the career is missing
  Career: "करियर",
};
