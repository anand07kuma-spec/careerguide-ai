/** Hindi for the trust pages: the consent banner and panel, the site footer, the
 * terms of use, the refund policy, the disclaimer, about, contact and the legal
 * index. See ./index.ts.
 *
 * These are the pages a parent reads before deciding whether a child should use
 * the app, so they are translated in full — Hindi headings over English prose
 * would be the worst of both. Brand and product names (Groq, Gemini, Vercel,
 * GitHub, Resend) stay in Latin, as do the settings paths quoted from the
 * interface itself. */
export const HI: Record<string, string> = {
  // ---- Storage consent: the banner
  "Storage and privacy": "स्टोरेज और गोपनीयता",
  "This site sets no cookies": "यह साइट कोई कुकी नहीं रखती",
  "Your choice decides whether anything is measured": "आपका चुनाव तय करता है कि कुछ मापा जाएगा या नहीं",
  "It keeps four values in this browser — a random student id, a session token, your language choice, and the answer you give this banner — so the same student can come back without a password.":
    "यह आपके ब्राउज़र में चार चीज़ें रखती है — एक रैंडम स्टूडेंट आईडी, एक सेशन टोकन, आपकी भाषा का चुनाव और इस नोटिस को आपके द्वारा दिया गया जवाब — ताकि वही स्टूडेंट बिना पासवर्ड के लौट सके।",
  "There is no analytics, no advertising and nothing that follows you to another site.":
    "यहाँ न एनालिटिक्स है, न विज्ञापन, और कुछ भी ऐसा नहीं जो आपको दूसरी साइट तक ले जाए।",
  "With your agreement this site loads two measurement services by name: Google Analytics for page counts, and Microsoft Clarity for how a page is used. They run only on the public pages — never on a student's or a parent's screen, where an answer or a name could be recorded along with it. Rejecting keeps both off. Changing your mind later turns them off and clears what they stored in this browser.":
    "आपकी अनुमति से यह साइट दो मापने वाली सेवाएँ नाम के साथ चलाती है — कौन-सा पेज कितनी बार खुला इसके लिए Google Analytics, और पेज का इस्तेमाल कैसे हुआ इसके लिए Microsoft Clarity। ये दोनों सिर्फ़ सार्वजनिक पेजों पर चलती हैं — स्टूडेंट या पैरेंट की स्क्रीन पर कभी नहीं, जहाँ उनके साथ कोई जवाब या नाम भी दर्ज हो सकता है। इनकार करने पर दोनों बंद रहती हैं। बाद में मन बदलें तो ये बंद हो जाती हैं और आपके ब्राउज़र में इन्होंने जो रखा था वह भी मिट जाता है।",
  "If whoever runs this site later switches on the optional email sign-in, the service that runs it keeps its own session here for the students who use it; the privacy policy says so in plain words.":
    "अगर साइट चलाने वाले बाद में वैकल्पिक ईमेल साइन इन चालू कर दें, तो उसे चलाने वाली सेवा, उसे इस्तेमाल करने वाले स्टूडेंट्स का अपना सेशन यहीं रखती है; गोपनीयता नीति यह बात सीड़े शब्दों में बताती है।",
  "Rejecting changes nothing about how this app runs today, because the four values above are the ones it needs to work. What you choose is recorded, and anything added later has to obey it.":
    "अस्वीकार करने से आज इस ऐप के चलने में कुछ नहीं बदलता, क्योंकि ऊपर बताई चारों चीज़ें ही इसे चलने के लिए चाहिए। आपने जो चुना वह दर्ज रहता है, और बाद में जो भी जोड़ा जाएगा उसे इसी का पालन करना होगा।",
  "Rejecting changes nothing about how this app runs — the four values above are the ones it needs to work, and they are kept whichever answer you give. What rejecting does is keep the two measurement services from ever loading, on this page or on any student's screen.":
    "अस्वीकार करने से इस ऐप के चलने में कुछ नहीं बदलता — ऊपर बताई चारों चीज़ें ही इसे चलने के लिए चाहिए, और आप जो भी जवाब दें, ये चारों रखी जाती हैं। अस्वीकार करने का असर यह है कि दोनों मापने वाली सेवाएँ कभी नहीं खुलतीं — न इस पेज पर, न किसी स्टूडेंट की स्क्रीन पर।",
  "Read the privacy policy": "गोपनीयता नीति पढ़ें",
  "Accept all": "सब स्वीकार करें",
  "Reject all": "सब अस्वीकार करें",
  "Manage preferences": "पसंद बदलें",

  // ---- Storage consent: the preferences panel
  "Storage preferences": "स्टोरेज पसंद",
  "What this browser keeps, and what it does not.": "यह ब्राउज़र क्या रखता है, और क्या नहीं।",
  "Save choices": "चुनाव सहेजें",
  Necessary: "ज़रूरी",
  Analytics: "एनालिटिक्स",
  Marketing: "मार्केटिंग",
  Functional: "फंक्शनल",
  "A random student id, a session token and your language choice, kept in this browser. The app cannot run without them, so this one cannot be switched off.":
    "एक रैंडम स्टूडेंट आईडी, एक सेशन टोकन और आपकी भाषा का चुनाव — यह सब आपके इसी ब्राउज़र में। इनके बिना ऐप चल ही नहीं सकता, इसलिए इसे बंद नहीं किया जा सकता।",
  "Analytics on this site is two services, named: Google Analytics for page counts and Microsoft Clarity for how a public page is used. Neither loads on a student's screen, a parent's screen or the entry screens, whatever you choose here. Switching this off stops both and clears the identifiers they left in this browser.":
    "इस साइट का एनालिटिक्स दो नाम-लिखित सेवाओं का है — पेज गिनती के लिए Google Analytics और सार्वजनिक पेज का इस्तेमाल कैसे हुआ इसके लिए Microsoft Clarity। आप यहाँ जो चुनें, ये दोनों स्टूडेंट की स्क्रीन, पैरेंट की स्क्रीन या शुरूआती स्क्रीनों पर नहीं चलतीं। इसे बंद करने पर दोनों थम जाती हैं और आपके ब्राउज़र में ये जिन पहचान-निशानियों को रखती थीं वे भी हट जाती हैं।",
  "No analytics project is configured for this deployment, so nothing about how you use it is measured. Your answer here is still saved, and any analytics added later has to obey it.":
    "इस डिप्लॉयमेंट के लिए कोई एनालिटिक्स प्रोजेक्ट सेट नहीं किया गया है, इसलिए आप इसे कैसे इस्तेमाल करते हैं इसका कोई माप नहीं होता। यहाँ आपका जवाब फिर भी सहेजा जाता है, और बाद में कोई एनालिटिक्स जोड़ी जाए तो उसे इसी चुनाव का पालन करना होगा।",
  "There is no advertising SDK, marketing tag or tracking pixel in this codebase, and no data is ever sold. This switch is saved for the same reason as the one above.":
    "इस कोडबेस में न कोई विज्ञापन SDK है, न मार्केटिंग टैग, न ट्रैकिंग पिक्सेल, और कोई डेटा कभी बेचा नहीं जाता। यह स्विच भी उसी कारण से सहेजा जाता है जो ऊपर बताया गया।",
  "Preferences that remember how the app behaves for you. Today the only one it keeps is the interface language, which is already counted under Necessary.":
    "ऐसी पसंद जो याद रखती है कि ऐप आपके लिए कैसा बर्ताव करे। आज इसकी एक ही पसंद है — इंटरफ़ेस की भाषा — और वह पहले से 'ज़रूरी' में ही गिनी जाती है।",
  "The values this site keeps for itself are not cookies — they sit in your own browser's storage, and clearing the site's data removes them. If analytics is switched on for this deployment and you accept it, Google's and Clarity's own scripts add cookies of theirs to this browser, and switching the answer off removes those. On a deployment where the optional email sign-in is switched on, Clerk's library keeps its own session values here too, and only for the students who use it.":
    "यह साइट जो मान अपने लिए रखती है वे कुकी नहीं हैं — वे आपके अपने ब्राउज़र के स्टोरेज में रहती हैं, और साइट का डेटा हटाने पर ये भी चले जाएँगी। अगर इस डिप्लॉयमेंट पर एनालिटिक्स चालू है और आप उसे स्वीकार करते हैं, तो Google और Clarity की अपनी स्क्रिप्ट इस ब्राउज़र में अपनी कुकी डाल देती हैं, और जवाब बाद में बंद करने पर वे भी हट जाती हैं। जहाँ वैकल्पिक ईमेल साइन इन चालू हो, वहाँ Clerk का लाइब्रेरी अपना सेशन भी यहीं रखता है, और सिर्फ़ उन्हीं स्टूडेंट्स का जो इसे इस्तेमाल करते हैं।",

  // ---- Footer
  Product: "प्रोडक्ट",
  Social: "सोशल",
  "Chat with the guide": "गाइड से बात करें",
  "Streams after class 10": "कक्षा 10 के बाद के स्ट्रीम",
  "How it works": "यह कैसे काम करता है",
  Pricing: "कीमत",
  "nothing is for sale yet": "अभी बिक्री के लिए कुछ नहीं",
  "Refund policy": "रिफ़ंड नीति",
  Disclaimer: "अस्वीकरण",
  About: "हमारे बारे में",
  Blog: "ब्लॉग",
  "Career profiles": "करियर प्रोफ़ाइल",
  "Careers at CareerGuide": "CareerGuide में नौकरी",
  "not hiring": "भर्ती नहीं हो रही",
  "GitHub repository": "GitHub रिपॉज़िटरी",
  "no account": "कोई अकाउंट नहीं",
  LinkedIn: "LinkedIn",
  "X (Twitter)": "X (Twitter)",
  Instagram: "Instagram",
  YouTube: "YouTube",
  "CareerGuide AI supports exploration. It is not a replacement for a qualified career counsellor, teacher or doctor.":
    "CareerGuide AI खोज में मदद करता है। यह किसी योग्य करियर काउंसलर, शिक्षक या डॉक्टर का बदल नहीं है।",
  "A prototype for Indian students from class 6 to 12, and their parents.":
    "कक्षा 6 से 12 के भारतीय स्टूडेंट्स और उनके माता-पिता के लिए बना प्रोटोटाइप।",
  "Prototype — no compliance claims": "प्रोटोटाइप — किसी क़ानून के पालन का दावा नहीं",
  "Made in India": "भारत में बना",

  // ---- Terms of use
  "Terms of Use": "उपयोग की शर्तें",
  "Accepting these terms": "इन शर्तों को स्वीकार करना",
  "What this service is": "यह सेवा क्या है",
  "Who may use it": "इसे कौन इस्तेमाल कर सकता है",
  "Accounts: this browser is the account": "अकाउंट: यह ब्राउज़र ही अकाउंट है",
  "Acceptable use": "स्वीकार्य इस्तेमाल",
  "The guide, and what it never does": "गाइड, और वह कभी क्या नहीं करता",
  "The catalogue is sample data": "कैटलॉग नमूना डेटा है",
  "Intellectual property": "बौद्धिक संपदा",
  "Payments, and refunds": "भुगतान, और रिफ़ंड",
  "Ending it": "इसे ख़त्म करना",
  Liability: "ज़िम्मेदारी",
  "Indemnification — what is not promised here": "क्षतिपूर्ति — यहाँ क्या वादा नहीं किया गया",
  "Third-party services": "थर्ड-पार्टी सेवाएँ",
  "Governing law": "लागू क़ानून",
  Disputes: "विवाद",
  "Changes to these terms": "इन शर्तों में बदलाव",
  "Using the site is the acceptance. There is no checkbox, no signature and no contract stored about you, because there is nothing to attach one to — the app identifies a browser, not a person.":
    "साइट इस्तेमाल करना ही इन्हें स्वीकार करना है। न कोई चेकबॉक्स, न हस्ताक्षर, न आपके बारे में सहेजा गया कोई अनुबंध — क्योंकि जोड़ने के लिए कुछ है ही नहीं; यह ऐप ब्राउज़र पहचानता है, व्यक्ति नहीं।",
  "If these terms do not work for you, close the tab. Nothing else has to be undone: the site keeps no email, phone or password that would have to be cancelled, and clearing its data removes the four values it stored in this browser. What clearing does not touch is what the server gathered about the student during the conversation — that is what Settings → Delete account erases, and it is the one step that removes those rows rather than only throwing away the key to them.":
    "अगर ये शर्तें आपको ठीक नहीं लगतीं तो टैब बंद कर दीजिए। इसके अलावा कुछ हटाने की ज़रूरत नहीं: साइट के पास ईमेल, फ़ोन नंबर या पासवर्ड कुछ भी नहीं जो रद्द करना पड़े, और उसका डेटा हटाने पर इस ब्राउज़र में रखे चारों मान भी चले जाते हैं। जो डेटा मिटाने से नहीं मिटता वह सर्वर पर जमा हुआ वह सब है जो बातचीत के दौरान स्टूडेंट के बारे में जाना गया — यही Settings → Delete account से मिटता है, और यही एक ऐसा क़दम है जो उन रिकॉर्डों को सचमुच हटाता है, न कि सिर्फ़ उन तक पहुँच की चाबी फेंक देता है।",
  "This document has not had qualified legal review. It states how the software behaves; it does not pretend to be advice about what any law requires.":
    "इस दस्तावेज़ की किसी योग्य क़ानूनविद से जाँच नहीं हुई है। यह इतना बताता है कि सॉफ़्टवेयर कैसा बर्ताव करता है; यह यह नहीं कहता कि किसी क़ानून की क्या माँग है।",
  "The screens that exist today are the conversation, voice calls, careers, the class 10 stream choice, exams, interests, study plans, reports, a parent view reached by a sharing code, and settings. Any of them can change or disappear without notice, because this is a prototype and not a contracted service.":
    "आज जो स्क्रीन मौजूद हैं वे हैं — बातचीत, वॉइस कॉल, करियर, कक्षा 10 के बाद स्ट्रीम चुनना, परीक्षाएँ, रुचियाँ, अध्ययन योजना, रिपोर्ट, शेयरिंग कोड से दिखने वाला पैरेंट व्यू, और सेटिंग्स। इनमें से कोई भी बिना बताए बदल या ख़त्म हो सकती है, क्योंकि यह प्रोटोटाइप है और कोई अनुबंधित सेवा नहीं।",
  "It is written for Indian students from class 6 to 12 and for their parents or guardians. There is no age gate, no identity check and no way for the app to know who is typing.":
    "यह कक्षा 6 से 12 के भारतीय स्टूडेंट्स और उनके माता-पिता या अभिभावक के लिए बना है। न कोई उम्र की जाँच, न पहचान सत्यापन, और ऐप के पास यह जानने का कोई तरीक़ा कि टाइप कौन कर रहा है।",
  "Because there is no password, there is nothing to reset, nothing to steal, and no support ticket that can restore a lost student. That is the trade this design makes, stated on the privacy page too.":
    "चूँकि कोई पासवर्ड नहीं है, न रीसेट करने को कुछ है, न चोरी होने को, और न कोई सपोर्ट टिकट जो खोया हुआ स्टूडेंट वापस ला सके। यह इस डिज़ाइन का सौदा है, जो गोपनीयता पेज पर भी लिखा है।",
  "Use it to explore careers. The rest of this list is what the design cannot protect against, or what it actively blocks:":
    "इससे करियर खोजिए। इस सूची में बाक़ी बातें वे हैं जिनसे यह डिज़ाइन खुद को बचा नहीं सकता, या जिनको वह सक्रिय रूप से रोकता है:",
  "Do not use a shared or public computer and leave the tab open — the next person inherits this student's conversation. Use Settings → This device → Start over when you are done.":
    "साझा या सार्वजनिक कंप्यूटर पर टैब खुला न छोड़ें — अगला व्यक्ति इस स्टूडेंट की बातचीत पा लेगा। काम ख़त्म होने पर Settings → This device → Start over इस्तेमाल करें।",
  "Do not try to read another student's data. Requests are checked against a session token on the server, so this does not work; attempting it against a deployed service is also unlawful.":
    "किसी दूसरे स्टूडेंट का डेटा पढ़ने की कोशिश न करें। अनुरोध सर्वर पर सेशन टोकन से मिलाए जाते हैं, इसलिए यह काम नहीं करेगा; चल रही सेवा के साथ ऐसी कोशिश क़ानूनन भी ग़लत है।",
  "Do not paste another child's conversation, nickname or device id into the guide, into a report, or into a public issue.":
    "किसी और बच्चे की बातचीत, उपनाम या डिवाइस आईडी गाइड में, रिपोर्ट में या सार्वजनिक issue में न डालें।",
  "Do not use the guide to impersonate a person, an institution or a board.":
    "किसी व्यक्ति, संस्थान या बोर्ड की नकल करने के लिए गाइड इस्तेमाल न करें।",
  "Do not treat it as a crisis line, a counsellor, a doctor or a legal adviser. It is none of those.":
    "इसे क्राइसिस लाइन, काउंसलर, डॉक्टर या क़ानूनी सलाहकार न समझें। यह इनमें से कुछ नहीं है।",
  "Do not rely on any fee, deadline, seat or salary figure in the catalogue without checking the official source for it.":
    "कैटलॉग में दी कोई फीस, समय-सीमा, सीट या वेतन की संख्या उसे चलाने वाले आधिकारिक स्रोत से जाँचे बिना ठीक न मानें।",
  "Replies come from a language model called through an API. It can be confident and wrong in the same sentence. Nothing it says has been checked by a human before it reaches you.":
    "जवाब एक भाषा मॉडल से आते हैं जिसे API से बुलाया जाता है। एक ही वाक्य में यह पूरे भरोसे के साथ ग़लत हो सकता है। आपको पहुँचने से पहले इसका एक भी वाक्य किसी इंसान ने जाँचा नहीं है।",
  "Sponsored institution entries are badged where they exist, and no payment changes a career suggestion — there is no ranking code for money to influence.":
    "जहाँ प्रायोजित संस्थान की एंट्री होती है वह लेबल के साथ दिखती है, और कोई भुगतान करियर का सुझाव नहीं बदलता — यहाँ ऐसी कोई रैंकिंग कोड है ही नहीं जिस पर पैसा असर डाले।",
  "The code is published in a public repository so anyone can read what the app really does. A public repository is not a licence: no permission to reuse, rebrand or redistribute any of it is granted here, and none is implied.":
    "कोड एक सार्वजनिक रिपॉज़िटरी में प्रकाशित है ताकि कोई भी पढ़ सके कि ऐप असल में क्या करता है। सार्वजनिक रिपॉज़िटरी लाइसेंस नहीं है: यहाँ इसे दोबारा इस्तेमाल करने, नए नाम से चलाने या आगे बाँटने की कोई छूट नहीं दी गई है, और न ही ऐसा कुछ माना जाए।",
  "What a student types and the replies they receive stay theirs to use however they like. This app claims no ownership over a conversation, and it does not train a model on it.":
    "स्टूडेंट जो टाइप करता है और जो जवाब पाता है, वह उसका अपना है — जैसे चाहे वैसा इस्तेमाल करे। यह ऐप किसी बातचीत पर अपना हक़ नहीं जताता, और न किसी मॉडल को उस पर ट्रेन करता है।",
  "Names of exams, boards and institutions belong to the bodies that run them. They appear here to describe those exams, not to suggest any endorsement.":
    "परीक्षाओं, बोर्डों और संस्थानों के नाम उन्हें चलाने वाली संस्थाओं के हैं। वे यहाँ उन्हें बताने के लिए लिखे गए हैं, किसी समर्थन का इशारा करने के लिए नहीं।",
  "The refund policy states what changes when a paid tier exists:":
    "रिफ़ंड नीति बताती है कि पेड टियर आने पर क्या बदलेगा:",
  "The refund policy states what is owed, and how it is asked for:":
    "रिफ़ंड नीति बताती है कि क्या मिलना चाहिए और वह कैसे माँगना है:",
  "You can end your use at any moment by closing the tab. Ending the data is a different act, and the app now has one: Settings → Delete account erases what the server holds and signs out every device, and it cannot be undone afterwards. Clearing this site’s data or using Settings → This device → Start over only stops this browser from reaching those rows — they stay until they are erased. No notice is needed and none is asked for.":
    "आप किसी भी समय टैब बंद करके अपना इस्तेमाल ख़त्म कर सकते हैं। डेटा ख़त्म करना अलग काम है, और उसके लिए ऐप में अब एक सुविधा है: Settings → Delete account सर्वर पर जो कुछ है उसे मिटा देता है और हर डिवाइस से साइन आउट कर देता है; दबाने के बाद इसे वापस नहीं लाया जा सकता। साइट का डेटा हटाकर या Settings → This device → Start over से सिर्फ़ इतना होता है कि यह ब्राउज़र उन रिकॉर्डों तक पहुँच नहीं पाता — वे मिटाए नहीं जाएँ तो वैसे ही रहते हैं। किसी नोटिस की ज़रूरत नहीं है और न ही कोई माँगा जाता है।",
  "On this side: the site can be taken down, changed or switched off without notice. It runs on a non-commercial hosting plan as a personal prototype, so there is no service level, no uptime promise and no obligation to keep it online. Losing it loses every student's history in it, which is why the app is not a place to store anything you cannot afford to lose.":
    "इस पक्ष से: साइट बिना बताए हटाई, बदली या बंद की जा सकती है। यह एक निजी प्रोटोटाइप के रूप में ग़ैर-व्यावसायिक होस्टिंग प्लान पर चलती है, इसलिए कोई सर्विस लेवल नहीं, कोई अपटाइम का वादा नहीं, और ऑनलाइन रखने की कोई ज़िम्मेदारी नहीं। यह खो गई तो इसमें हर स्टूडेंट का इतिहास खो जाता है — इसीलिए यह ऐप वह जगह नहीं है जहाँ आप वह चीज़ सहेजें जो खोने का ख़तरा मोल नहीं ले सकते।",
  "To the maximum extent the law allows, the people behind this prototype are not liable for loss or damage arising from its use — including a career, subject, exam or institution decision made on the strength of anything shown here. A decision that shapes a student's future should be taken with a human professional and the official sources, not with a prototype alone.":
    "क़ानून जो तक इजाज़त देता है, उस तक इस प्रोटोटाइप के पीछे के लोग इसके इस्तेमाल से हुए किसी नुक़सान या क्षति के लिए ज़िम्मेदार नहीं हैं — जिसमें यहाँ दिखी किसी बात के आधार पर ली गई करियर, विषय, परीक्षा या संस्थान की फ़ैसला भी शामिल है। स्टूडेंट के भविष्य को आकार देने वाला फ़ैसला किसी इंसान पेशेवर और आधिकारिक स्रोतों के साथ मिलकर लेना चाहिए, किसी प्रोटोटाइप के दम पर अकेले नहीं।",
  "Nothing in this section excludes liability that cannot lawfully be excluded, including for death, personal injury, or fraud caused by the people running the service.":
    "इस अनुच्छेद में कोई बात ऐसी ज़िम्मेदारी को नहीं छोड़ती जिसे क़ानूनन छोटा नहीं जा सकता — जिसमें सेवा चलाने वालों की वजह से हुई मौत, शारीरिक चोट या धोखाधड़ी भी शामिल है।",
  "A standard terms page asks the user to cover the provider's legal costs if the provider gets sued because of that user. This page does not impose that on a student's family, and it would be wrong to print the clause as though it had been agreed with anyone.":
    "एक आम शर्त-पेज यूज़र से कहता है कि अगर उसकी वजह से प्रदाता पर मुक़दमा हो तो वह उसका क़ानूनी ख़र्च उठाए। यह पेज वह बात किसी स्टूडेंट के परिवार पर थोपता नहीं है, और उसे इस तरह छापना ग़लत होगा मानों यह किसी के साथ तय हुआ हो।",
  "What is asked instead is on the acceptable-use list: do not put another child's private conversation into this app or into its public issue tracker. Whether any indemnity is appropriate at all is a question for the legal review this build has not had.":
    "इसके बदले जो माँगा जाता है वह स्वीकार्य-इस्तेमाल की सूची में है: किसी और बच्चे की निजी बातचीत इस ऐप में या इसके सार्वजनिक issue tracker में न डालें। और क्या कोई क्षतिपूर्ति ठीक भी रहेगी — यह उसी क़ानूनी जाँच का सवाल है जो इस बिल्ड ने नहीं करवाई।",
  "The app depends on services this project does not control: Groq for the model, Google Gemini for spoken replies, the browser's own speech recognition, and Vercel for hosting and the database. Each has its own terms and its own privacy policy, and using this app means your text passes through them.":
    "यह ऐप ऐसी सेवाओं पर चलता है जिन पर इस प्रोजेक्ट का नियंत्रण नहीं है: मॉडल के लिए Groq, बोले जाने वाले जवाबों के लिए Google Gemini, ब्राउज़र की अपनी स्पीच पहचान, और होस्टिंग व डेटाबेस के लिए Vercel। हर एक की अपनी शर्तें और अपनी गोपनीयता नीति है, और यह ऐप इस्तेमाल करना अपना टेक्स्ट उनके सामने रखना है।",
  "Their terms are not incorporated into these terms by a link nobody clicks. They are listed on the privacy page, with what each one receives, and their data-retention behaviour has not been verified by this project.":
    "इन शर्तों में उनकी शर्तें किसी ऐसे लिंक से शामिल नहीं की गई हैं जिस पर कोई क्लिक नहीं करता। वे गोपनीयता पेज पर लिखी हैं, यह बताते हुए कि हर एक को क्या मिलता है; और वे अपना डेटा कितने दिन रखती हैं, इसकी जाँच इस प्रोजेक्ट ने नहीं की है।",
  "These terms are written for use in India, and Indian law is the law this project assumes applies to them. That is a statement of intent, not a determination — no lawyer has reviewed it.":
    "ये शर्तें भारत में इस्तेमाल के लिए लिखी गई हैं, और इस प्रोजेक्ट का मानना है कि इन पर भारतीय क़ानून लागू होता है। यह इरादा ज़ाहिर करना है, तय करना नहीं — इसे किसी वकील ने नहीं पढ़ा।",
  "The usual next line names the courts of a city. Those are the":
    "अगली पंक्ति आमतौर पर किसी शहर की अदालतों का नाम लेती है। यहाँ वे",
  "courts, because that is where whoever operates this deployment works from.":
    "की अदालतें हैं, क्योंकि यह डिप्लॉयमेंट चलाने वाला उसी शहर से काम करता है।",
  "There is no arbitration clause and no forum-selection clause, so the sentence above is the whole of it. If something here goes wrong for you, the contact form and the public issue tracker are the two routes, and the issue tracker is at least visible to others.":
    "न कोई सुलह (arbitration) अनुच्छेद है, न मंच-चुनाव की शर्त, इसलिए ऊपर लिखी पंक्ति ही इस हिस्से की पूरी बात है। अगर यहाँ आपके साथ कुछ ग़लत होता है तो संपर्क फ़ॉर्म और सार्वजनिक issue tracker — बस ये दो रास्ते हैं, और issue tracker की बात कम-से-कम दूसरे भी देख सकते हैं।",
  "A deployment that holds a real child's data needs that path working rather than merely named: an inbox somebody reads, an officer whose name is filled in, and a lawyer who has read this page. The note printed beside the contact details on these pages says which of those this build has.":
    "जो तैनाती असली बच्चे का डेटा रखती है, उसे शिकायत का रास्ता सिर्फ़ नाम से नहीं, चलते हुए चाहिए: कोई ऐसी इनबॉक्स जिसे कोई पढ़े, कोई अधिकारी जिसका नाम भरा हो, और कोई वकील जिसने यह पेज पढ़ा हो। इन पेजों पर संपर्क मानों के बगल में जो नोट छपता है, वह यही बताता है कि इस बिल्ड में उनमें से क्या मौजूद है।",
  "These terms change by being edited and republished, with the date at the top moved forward. There is no email to notify, no in-app banner and no version history shown to you — continuing to use the app after a change is the acceptance of it.":
    "ये शर्तें संपादित और दोबारा प्रकाशित होकर बदलती हैं, और ऊपर लिखी तारीख आगे खिसक जाती है। सूचित करने के लिए ईमेल नहीं, ऐप के अंदर बैनर नहीं, और आपको कोई संस्करण-इतिहास नहीं दिखता — बदलाव के बाद ऐप इस्तेमाल करना ही उसे स्वीकार करना है।",
  "The page you are reading is stored with the code, so the terms you see match the build you are using, and every past version is public in the repository.":
    "आप जो पेज पढ़ रहे हैं वह कोड के साथ ही सहेजा है, इसलिए आपको दिखने वाली शर्तें उसी बिल्ड की हैं जो आप चला रहे हैं, और हर पुराना संस्करण रिपॉज़िटरी में सार्वजनिक है।",
  "The contact page has a form, and the repository has an issue tracker. Neither is a support desk, and no reply time is promised.":
    "संपर्क पेज पर एक फ़ॉर्म है, और रिपॉज़िटरी में issue tracker। दोनों में से कोई सपोर्ट डेस्क नहीं है, और जवाब देने का कोई समय तय नहीं किया गया।",
  "Go to the contact page": "संपर्क पेज पर जाएँ",
  // The terms page now opens by saying why it is short, and its payments clause
  // describes a checkout that exists but has never taken money. Both stay exactly
  // as un-reassuring as the English.
  "These are the terms for using CareerGuide AI. They are short because the app is a prototype with no password, no advertising and no promises it cannot keep. Where a normal clause would describe something this build does not have, the page says so instead of borrowing the wording for it.":
    "ये CareerGuide AI इस्तेमाल करने की शर्तें हैं। ये छोटी हैं क्योंकि यह ऐप एक प्रोटोटाइप है — न पासवर्ड, न विज्ञापन, और न ऐसा कोई वादा जो वह रख न सके। जहाँ एक आम शर्त किसी ऐसी चीज़ का ब्यौरा देती है जो इस बिल्ड में है ही नहीं, वहाँ यह पेज उसके लिए उधार की लिखावट इस्तेमाल करने की जगह सीधे यही कहता है।",
  "A paid tier exists as software now. The plans, the order, the signature check, the webhook and the billing screen are built and covered by a suite that stands in for the payment provider; none of it is a mock-up. It is switched off until the operator sets real keys on the server, and with none set the pricing page disables its own Upgrade buttons and says why. No payment has been taken on this deployment, so no refund has been owed by it.":
    "पेड टियर अब सॉफ़्टवेयर के रूप में मौजूद है। प्लान, ऑर्डर, सिग्नेचर जाँच, वेबहुक और बिलिंग स्क्रीन बने हुए हैं, और उन्हें एक ऐसी टेस्ट सुइट ढकती है जो भुगतान प्रदाता की जगह नक़ली बनकर चलती है; इनमें से एक भी सिर्फ़ दिखावे का मॉक-अप नहीं है। यह तब तक बंद है जब तक इसे चलाने वाला सर्वर पर असली कुंजियाँ न सेट कर दे, और कुंजियाँ न हों तो कीमत वाला पेज अपने अपग्रेड बटन ख़ुद बंद कर देता है और कारण भी बताता है। इस तैनाती पर कोई भुगतान लिया नहीं गया है, इसलिए इसका कोई रिफ़ंड देना भी नहीं बना।",
  "Two things a usual paid product has are deliberately absent. There is no auto-renewal: one payment buys one fixed period, nothing charges again by itself, so there is no subscription to cancel and no mandate held on a card. And there is no refund action inside the app — no refund button, no refund call, no invoice to reverse. A refund would be issued from the payment provider's own dashboard by whoever holds that account, and this page states that instead of describing a control that does not exist.":
    "ऐसी दो चीज़ें जो आम पेड प्रोडक्ट में होती हैं, यहाँ इन्हें जान-बूझकर नहीं रखा गया। न कोई ऑटो-रिन्यूअल: एक भुगतान एक निश्चित अवधि खरीदता है, कुछ भी ख़ुद-ब-ख़ुद दोबारा नहीं कटता, इसलिए न रद्द करने को सब्सक्रिप्शन है और न कार्ड पर रखा कोई मेन्डेट। और ऐप के अंदर कोई रिफ़ंड क्रिया नहीं है — न रिफ़ंड बटन, न रिफ़ंड कॉल, न पलटने को कोई इनवॉइस। रिफ़ंड भुगतान प्रदाता के अपने डैशबोर्ड से दिया जाएगा, उस इंसान द्वारा जो वह अकाउंट रखता है, और यह पेज यही बताता है — मौजूद ही न होने वाले बटन का ब्यौरा देने के बजाय।",
  "What money cannot buy here is the point of the whole product: the order of a career suggestion, a stream recommendation or an exam list. There is no ranking code for a payment to influence, the entire career catalogue sits on the free plan, and a sponsored listing — if one ever appears — will be badged where it shows.":
    "यही इस पूरे प्रोडक्ट का मक़सद है कि पैसा यहाँ कुछ नहीं खरीद सकता: करियर के सुझाव का क्रम, स्ट्रीम का सुझाव या परीक्षाओं की सूची। कोई रैंकिंग कोड है ही नहीं जिस पर भुगतान असर डाले, पूरा करियर कैटलॉग मुफ़्त प्लान में ही है, और कोई प्रायोजित लिस्टिंग — अगर कभी दिखे भी — तो अपनी जगह लेबल के साथ दिखेगी।",

  // ---- Refund policy
  "Refund Policy": "रिफ़ंड नीति",
  Overview: "सारांश",
  "What is true right now": "अभी जो सच है",
  "Free services": "मुफ़्त सेवाएँ",
  "What is free, and on every plan": "क्या मुफ़्त है — और हर प्लान में मुफ़्त है",
  "Paid services": "पेड सेवाएँ",
  "When a refund is due": "कब रिफ़ंड मिलना चाहिए",
  "A refund is owed in these cases, written against what the app actually records:":
    "इन हालातों में रिफ़ंड देना होगा — और यह सिर्फ़ उतना ही जितना ऐप असल में दर्ज करता है:",
  "What is not refundable": "क्या रिफ़ंड नहीं होगा",
  "How to ask": "कैसे माँगें",
  "Processing time": "प्रक्रिया में समय",
  "How the money comes back": "पैसे वापस कैसे आएँगे",
  "Cancelling a subscription": "सब्सक्रिप्शन रद्द करना",
  "Renewing, ending a period, and cancelling": "प्लान का बढ़ना, एक अवधि का खत्म होना, और रद्द करना",
  "Disputed payments": "विवादित भुगतान",
  "Built, and not switched on": "बनाया गया है, पर चालू नहीं है",
  "No payment has been taken on this deployment, and there is no refund button in the app.":
    "इस तैनाती पर एक भी भुगतान नहीं लिया गया है, और ऐप में रिफ़ंड का कोई बटन नहीं है।",
  "There is nothing to refund, because nothing is for sale. This page says so plainly, then sets out the rules that will apply from the day a payment provider is actually connected.":
    "रिफ़ंड करने को कुछ नहीं है, क्योंकि बिक्री के लिए कुछ नहीं है। यह पेज पहले यही सीधे कहता है, फिर उन्हीं नियमों को लिखता है जो उस दिन से लागू होंगे जब भुगतान प्रदाता सच में जुड़ेगा।",
  "CareerGuide AI is free to use today. There is no checkout, no subscription, no card form and no payment provider integrated with this build, so no payment can be made to it and no refund can be owed by it.":
    "CareerGuide AI आज मुफ़्त है। न कोई चेकआउट, न सब्सक्रिप्शन, न कार्ड फ़ॉर्म, और इस बिल्ड से कोई भुगतान प्रदाता जुड़ा नहीं है — इसलिए इसमें कोई भुगतान हो नहीं सकता और इसका कोई रिफ़ंड देना भी नहीं बनता।",
  "That is the state of the software, not a marketing claim about the future. If a screen ever asks a student or a parent for money, this page is out of date and the version in the repository is the one to read.":
    "यह सॉफ़्टवेयर की मौजूदा हालत है, भविष्य के बारे में मार्केटिंग दावा नहीं। अगर कभी कोई स्क्रीन स्टूडेंट या अभिभावक से पैसे माँगे तो यह पेज पुराना हो जाएगा, और तब रिपॉज़िटरी वाला संस्करण पढ़ना सही होगा।",
  "No payments are enabled": "भुगतान चालू नहीं हैं",
  "Nothing on this site takes money.": "इस साइट पर कोई चीज़ पैसे नहीं लेती।",
  "Every screen in the app is free: the conversation, voice calls, careers, streams, exams, interests, study plans, reports, the parent view reached by a sharing code, and settings.":
    "ऐप की हर स्क्रीन मुफ़्त है: बातचीत, वॉइस कॉल, करियर, स्ट्रीम, परीक्षाएँ, रुचियाँ, अध्ययन योजना, रिपोर्ट, शेयरिंग कोड से दिखने वाला पैरेंट व्यू, और सेटिंग्स।",
  "Because these cost nothing, there is no refund question about them. If a real service is ever charged for on top of them, the paid part falls under the sections below and the free part stays free — a subscription here will not be the thing that unlocks a child’s basic exploration.":
    "इन पर कुछ खर्च नहीं होता, इसलिए इनका रिफ़ंड वाला सवाल ही नहीं बनता। अगर कभी इनके ऊपर कोई असली सेवा पैसे माँगे तो पेड हिस्सा नीचे वाले अनुच्छेदों में आएगा और मुफ़्त हिस्सा मुफ़्त रहेगा — यहाँ सब्सक्रिप्शन कभी वह चीज़ नहीं होगा जो बच्चे की बुनियादी खोज खोले।",
  "This section is not in force. It describes what will apply once a payment provider is connected, tested, and named on this page. Until then it is a commitment written in advance, not a live policy.":
    "यह अनुच्छेद फ़िलहाल लागू नहीं है। यह बताता है कि भुगतान प्रदाता जुड़ने, उसकी जाँच होने और इस पेज पर उसका नाम आने पर क्या लागू होगा। तब तक यह पहले से लिखा हुआ एक वादा है, चलती हुई नीति नहीं।",
  "Two conditions come before any refund rule matters. A purchase will be made by an identifiable paying adult, through a regulated payment processor whose own dispute and refund flow the app will show; and the price, what is bought, and how long it lasts will be on screen before the charge, not in an email afterwards.":
    "किसी भी रिफ़ंड नियम से पहले दो शर्तें आती हैं। खरीद एक पहचाने जाने योग्य व्यक्ति का होगा जो भुगतान कर रहा है, और वह भी एक नियमित भुगतान प्रोसेसर के ज़रिए जिसका अपना विवाद और रिफ़ंड रास्ता ऐप दिखाएगा; कीमत, क्या खरीदा जा रहा है और कितने दिन रहेगा — यह शुल्क कटने से पहले स्क्रीन पर दिखेगा, बाद में ईमेल में नहीं।",
  "Institutions and employers are the intended paid parties, never a family buying access to a better career answer. A paid tier may add reports, human review or teacher tools. It will never change the order of a career suggestion for a student — there is no ranking code for money to influence, and the terms say so.":
    "पैसे देने वाली तरफ़ संस्थान और नियोक्ता होंगे, कभी कोई परिवार नहीं जो बेहतर करियर जवाब खरीद रहा हो। पेड टियर रिपोर्ट, इंसानी जाँच या शिक्षक के औज़ार जोड़ सकता है। वह कभी किसी स्टूडेंट के करियर सुझाव का क्रम नहीं बदलेगा — यहाँ ऐसी रैंकिंग कोड है ही नहीं जिस पर पैसा असर डाले, और शर्तें भी यही कहती हैं।",
  "Once payments exist, a refund will be owed in these cases:":
    "भुगतान आने के बाद, इन हालातों में रिफ़ंड देना होगा:",
  "A paid feature was charged for and never became available in this build.":
    "किसी पेड फीचर के पैसे लिए गए और वह इस बिल्ड में कभी चालू ही नहीं हुआ।",
  "A payment was taken twice for the same purchase, or taken and then reversed by the provider without the service being stopped.":
    "एक ही खरीद पर भुगतान दो बार कटा, या कटकर प्रदाता ने बिना सेवा रोके वापस कर दिया।",
  "A purchase was made by a child without the knowledge of the grown-up who pays the bills, and it is raised within fourteen days of the charge.":
    "खरीद किसी बच्ने ने की और बिल भरने वाले बड़े को उसकी ख़बर नहीं थी, और यह बात कटने से चौदह दिन के अंदर उठाई गई।",
  "The service was switched off from this side while a paid period was still running.":
    "पेड अवधि अभी चल रही थी और सेवा इस तरफ़ से बंद कर दी गई।",
  "The child-purchase clause exists because this app is used by minors on devices their parents pay for. Fourteen days is the window the project commits to; a regulator could set a different one, and the legal review this build has not had would be the point at which that gets checked.":
    "बच्चे-खरीद वाला अनुच्छेद इसलिए है क्योंकि यह ऐप नाबालिग इस्तेमाल करते हैं, उन डिवाइस पर जिनका पैसे उनके माता-पिता देते हैं। चौदह दिन वह समय-सीमा है जो प्रोजेक्ट खुद को देता है; कोई नियामक इसे अलग तय कर सकता है, और वह जाँच इसी क़ानूनी समीक्षा में तय होगी जो इस बिल्ड ने नहीं करवाई।",
  "A refund is not the remedy for these, and pretending otherwise would set up a promise the app cannot keep:":
    "इनका इलाज रिफ़ंड नहीं है, और अन्यथा का दिखावा ऐसा वादा खड़ा करना होगा जो ऐप रख नहीं सकता:",
  "A career suggestion, a stream choice or an exam list that turned out to be wrong, unhelpful or disagreeable. The advice is a starting point, it is labelled as machine-generated, and no outcome is guaranteed anywhere in this app — so a refund is not the remedy for a bad answer.":
    "करियर का सुझाव, स्ट्रीम का चुनाव या परीक्षाओं की सूची ग़लत, बेकार या नापसंद लगे। सलाह एक शुरुआत है, उसे मशीन से बनी कहा गया है, और इस ऐप में कहीं किसी नतीजे की गारंटी नहीं दी जाती — इसलिए बुरे जवाब का इलाज रिफ़ंड नहीं है।",
  "A decision made on the strength of the app that led to a cost: a dropped subject, a missed deadline, an application fee. The disclaimer and the terms both say this tool is not the basis for a decision of that weight.":
    "ऐप के दम पर कोई फ़ैसला लिया और उससे खर्च हो गया: कोई विषय छोड़ दिया, कोई समय-सीमा चूक गए, कोई फॉर्म फीस दे दी। अस्वीकरण और शर्तें दोनों कहती हैं कि इतने भारी फ़ैसले की बुनियाद यह औज़ार नहीं है।",
  "Losing access because the browser’s data was cleared, the tab was opened in private mode, or a different device or browser was used. There is no account to recover a student from, and that limitation is stated on the first screen and in the terms.":
    "ब्राउज़र का डेटा हट जाने, टैब निजी मोड में खुलने, या दूसरे डिवाइस या ब्राउज़र से चलने की वजह से पहुँच खो जाना। स्टूडेंट वापस पाने के लिए कोई अकाउंट नहीं है, और यह कमी पहली स्क्रीन पर भी और शर्तों में भी लिखी है।",
  "A subscription period that was simply not used, once the paid feature was actually available during it.":
    "सब्सक्रिप्शन की अवधि इस्तेमाल नहीं हुई, जबकि उस दौरान पेड फीचर असल में उपलब्ध था।",
  "A change of mind after a download, an exported report or any other digital good was delivered.":
    "एक डाउनलोड, निर्यात की गई रिपोर्ट या कोई और डिजिटल चीज़ मिलने के बाद मन बदल जाना।",
  "Today there is no request to make. When there is, the route will be the contact form with the subject set to the payment question, plus the reference the payment processor put on the receipt.":
    "आज कोई अनुरोध करने की ज़रूरत नहीं है। जब होगी, तो रास्ता संपर्क फ़ॉर्म होगा — विषय भुगतान वाला चुनकर, और उस रेफ़रेंस के साथ जो भुगतान प्रोसेसर रसीद पर लिखता है।",
  "What will not be required: an explanation of why the product was not good enough, a phone call, a postal address, or the upload of a document. There is no account in this app, so a refund claim cannot be tied to one either — it will be tied to a payment reference, which is the only thing that identifies a purchase here.":
    "यह नहीं माँगा जाएगा: यह समझाना कि प्रोडक्ट काफ़ी अच्छा क्यों नहीं था, फ़ोन कॉल, डाक पता, या कोई दस्तावेज़ अपलोड करना। इस ऐप में अकाउंट नहीं है, इसलिए रिफ़ंड दावे को अकाउंट से जोड़ा भी नहीं जा सकता — उसे एक भुगतान रेफ़रेंस से जोड़ा जाएगा, क्योंकि यहाँ खरीद पहचानने का एकमात्र तरीक़ा वही है।",
  "The commitment for a paid build is an answer within five working days of a request, and the money moved within ten working days of an approved one. A card refund then takes another two to five working days depending on the issuing bank, which is the processor’s time and not this app’s.":
    "पेड बिल्ड के लिए वादा यह है कि अनुरोध पर पाँच कार्यदिवसों में जवाब मिलेगा, और मंज़ूरी के दस कार्यदिवसों में पैसा भेज दिया जाएगा। कार्ड रिफ़ंड को उसके बाद और दो से पाँच कार्यदिवस लग सकते हैं, यह जारी करने वाले बैंक पर निर्भर है — वह प्रोसेसर का समय है, इस ऐप का नहीं।",
  "No queue, no ticketing system and no service-level agreement exists today, so these are not measured numbers. They are the times the project intends to hold itself to, published before anyone has paid for anything.":
    "आज न कोई क़तार है, न टिकटिंग सिस्टम, न सर्विस-लेवल एग्रीमेंट, इसलिए ये मापी हुई संख्याएँ नहीं हैं। ये वह समय हैं जिन पर प्रोजेक्ट खुद को चलने देना चाहता है, और किसी के कुछ भी पैसे देने से पहले प्रकाशित किए गए हैं।",
  "Back the way it came. A refund is issued to the original payment method through the same processor that took the payment, so the receipt and the refund carry the same reference and the bank sees the same pair.":
    "जिस रास्ते आए थे, उसी रास्ते वापस। रिफ़ंड उसी मूल भुगतान-विधि पर भेजा जाता है, उसी प्रोसेसर के ज़रिए जिससे भुगतान कटा था, ताकि रसीद और रिफ़ंड पर एक ही रेफ़रेंस रहे और बैंक को दोनों साथ दिखें।",
  "There will be no wallet credit, no voucher, and no “store credit instead of cash” default. Where the original method genuinely cannot receive a refund, the app will say so in writing and agree a different route with the person who paid rather than quietly substituting a credit.":
    "न कोई वॉलेट क्रेडिट, न वाउचर, और न “पैसे की जगह स्टोर क्रेडिट” वाला डिफ़ॉल्ट। जहाँ मूल विधि सच में रिफ़ंड नहीं ले सकती, वहाँ ऐप लिखित में यह कहेगा और जिसने भुगतान किया उसके साथ दूसरा रास्ता तय करेगा — चुपचाप क्रेडिट देकर नहीं।",
  "There is no subscription to cancel, because there is no subscription to start.":
    "रद्द करने के लिए कोई सब्सक्रिप्शन नहीं है, क्योंकि शुरू करने के लिए कोई सब्सक्रिप्शन नहीं है।",
  "When one exists, cancelling will mean: the recurring charge stops immediately, the paid period already paid for runs to the date it was bought for, and a request to cancel will not require a phone call or a retention conversation. Any unused part of a paid period will be prorated under the same rules as a refund above.":
    "जब कोई सब्सक्रिप्शन होगा, तब रद्द करना मतलब: बार-बार कटने वाला शुल्क तुरंत रुकेगा, पहले से पेड अवधि उसी तारीख तक चलेगी जिसके लिए खरीदी गई थी, और रद्द करने के लिए न फ़ोन कॉल लगेगी और न मनाने की बातचीत होगी। पेड अवधि का इस्तेमाल न हुआ हिस्सा ऊपर लिखे रिफ़ंड के ही नियमों से अनुपात में लौटेगा।",
  "Closing a free account is a different thing and stays available regardless. Settings → Delete account erases what the server holds, and it works whether or not anything is ever sold; the one record that outlives it is the payment or refund ledger entry, which a money ledger has to keep even after the person it is about asks to be forgotten — that is why a receipt can still be matched to an order after the account that paid is gone. Settings → This device → Start over is the lighter step: it stops this browser from reaching that account and leaves the rows where they are.":
    "मुफ़्त अकाउंट बंद करना अलग बात है और वह हर हालत में उपलब्ध रहेगा। Settings → Delete account सर्वर पर जो कुछ है उसे मिटा देता है, और यह तभी भी काम करता है — चाहे कभी कुछ बेचा जाए या नहीं; इसके बाद भी बचने वाला एकमात्र रिकॉर्ड भुगतान या रिफ़ंड बही-खाते की क़तर है, जिसे पैसों का बही-खाता को उस इंसान के भुलाए जाने के बाद भी रखना होता है जिसके बारे में वह है — इसीलिए अकाउंट मिट जाने के बाद भी उसकी रसीद को ऑर्डर से जोड़ा जा सकता है। Settings → This device → Start over हल्क़ा क़दम है: यह ब्राउज़र को उस अकाउंट तक पहुँच से रोक देता है, पर रिकॉर्ड जहाँ के वहीं रहते हैं।",
  "A dispute raised with a bank is called a chargeback, and it is not something this app can process, block or judge. If a payment is disputed, the processor will contact this project the way it contacts any merchant, and the project will answer with what the service actually delivered rather than contesting a family’s claim by default.":
    "बैंक के साथ उठाए गए विवाद को chargeback कहते हैं, और यह इस ऐप का काम नहीं कि उसे चलाए, रोके या फ़ैसला करे। अगर किसी भुगतान पर विवाद होता है तो प्रोसेसर इस प्रोजेक्ट से वैसे ही संपर्क करेगा जैसे किसी भी व्यापारी से करता है, और प्रोजेक्ट जवाब में यह बताएगा कि सेवा ने असल में क्या दिया — बिना किसी परिवार के दावे को स्वतः चुनौती दिए।",
  "A dispute does not replace the refund route above, and the app will not close off the contact form because a bank was contacted first. It also does not decide anything about a child’s data: an unpaid or disputed invoice will never be used as a reason to withhold or delete a student’s history. Access to a free service cannot be repossessed, because nothing here is gated behind money.":
    "विवाद ऊपर लिखे रिफ़ंड रास्ते की जगह नहीं लेता, और बैंक से पहले संपर्क होने के कारण ऐप संपर्क फ़ॉर्म बंद नहीं करेगा। यह बच्चे के डेटा के बारे में भी कुछ तय नहीं करता: बकाया न देने या विवादित इनवॉइस को कभी किसी स्टूडेंट का इतिहास रोकने या मिटाने का बहाना नहीं बनाया जाएगा। मुफ़्त सेवा की पहुँच छीनी नहीं जा सकती, क्योंकि यहाँ कुछ भी पैसे के पीछे बंद नहीं है।",
  "Questions about this page — including whether a paid tier is actually live — go to the contact form. The receipt from a payment processor is answered by that processor first, because they hold the transaction, not this app.":
    "इस पेज के बारे में सवाल — जिसमें यह भी कि पेड टियर सच में चल रहा है या नहीं — संपर्क फ़ॉर्म पर भेजें। भुगतान प्रोसेसर की रसीद का जवाब पहले वही प्रोसेसर देगा, क्योंकि लेनदेन उनके पास है, इस ऐप के पास नहीं।",
  "A refund question reaches whoever operates this deployment through the contact page; there is no separate refunds desk, and this page is not going to print an address the contact page has not already published.":
    "रिफ़ंड का सवाल संपर्क पेज के ज़रिए इस डिप्लॉयमेंट को चलाने वाले तक पहुँचता है; कोई अलग रिफ़ंड डेस्क नहीं है, और यह पेज ऐसा पता नहीं छापेगा जो संपर्क पेज ने पहले से न बताया हो।",
  "Privacy: grievance officer": "गोपनीयता: शिकायत अधिकारी",
  // The refund page rewritten around a checkout that is built and idle. Every
  // "not in force", "will apply once" and "no payment has been taken" below stays
  // a statement about this deployment, never a promise of one.
  "A checkout is built into this app, and no payment has ever been taken by it. This page says which rules are live, which are promises written in advance, and where the software has not caught up with the promise.":
    "इस ऐप में चेकआउट बना हुआ है, और उससे आज तक एक भी भुगतान नहीं लिया गया। यह पेज बताता है कि कौन-से नियम अभी चल रहे हैं, कौन-से वादे पहले से लिखे गए हैं, और कहाँ सॉफ़्टवेयर अपने वादे तक अभी पहुँचा नहीं है।",
  "The plans, the Razorpay order, the signature check on the callback, the webhook and the billing screen exist in the code, and a test suite runs them against a stand-in provider. Prices are quoted in paise, an order cannot be priced by the browser, and a plan is unlocked only when the server can prove the payment is the one it asked for.":
    "प्लान, Razorpay का ऑर्डर, कॉलबैक पर सिग्नेचर जाँच, वेबहुक और बिलिंग स्क्रीन — ये सब कोड में मौजूद हैं, और एक टेस्ट सुइट इन्हें प्रदाता की जगह चलने वाली नक़ली सेवा के साथ चलाकर जाँचता है। कीमतें पैसे में लिखी जाती हैं, ऑर्डर की कीमत ब्राउज़र तय नहीं कर सकता, और प्लान तभी खुलता है जब सर्वर यह साबित कर सके कि भुगतान वही है जो उसने माँगा था।",
  "None of that is switched on for this deployment until the person running it puts real keys on the server. With no keys, the pricing page reads that answer from the server and disables its own Upgrade buttons rather than opening a checkout that cannot work, and no plan limit is being enforced, so every screen still behaves as a free one.":
    "इस तैनाती पर उनमें से कुछ भी चालू नहीं है, जब तक इसे चलाने वाला व्यक्ति सर्वर पर असली कुंजियाँ न रख दे। कुंजियाँ न हों तो कीमत वाला पेज सर्वर से यही जवाब पढ़ता है और अपने अपग्रेड बटन ख़ुद बंद कर देता है — ऐसे चेकआउट को खोलने के बजाय जो चल ही नहीं सकता; और प्लान की कोई हद लागू नहीं की जा रही, इसलिए हर स्क्रीन अब भी मुफ़्त वाली तरह चलती है।",
  "Which means: nothing has been charged here, and no refund has been paid here. The rules below are what will apply from the first capture, and they are published now rather than after a family has a complaint.":
    "मतलब: यहाँ एक भी शुल्क नहीं काटा गया, और यहाँ का एक भी रिफ़ंड नहीं दिया गया। नीचे लिखे नियम पहला भुगतान कैप्चर होने से लागू होंगे, और इन्हें अभी प्रकाशित किया गया है — किसी परिवार के शिकायत करने के बाद नहीं।",
  "Everything about careers is free and stays free on every plan: the conversations and voice calls that are within a plan's allowance, the careers, streams, exams, resources, scholarships and institutes, the interest and aptitude work, a student's own journey and reports, and the right to see, export and delete what this app holds.":
    "करियर से जुड़ी हर चीज़ मुफ़्त है और हर प्लान में मुफ़्त ही रहेगी: वे बातचीत और वॉइस कॉल जो प्लान में तय मात्रा के अंदर हैं, करियर, स्ट्रीम, परीक्षाएँ, संसाधन, स्कॉलरशिप और संस्थान, रुचि और एप्टिट्यूड का काम, स्टूडेंट की अपनी यात्रा और रिपोर्ट, और यह हक़ कि वह देख सके, निर्यात कर सके और मिटा सके कि इस ऐप के पास उसके बारे में क्या है।",
  "Because those cost nothing, there is no refund question about them. What a paid plan adds is conversation volume, repeatable questionnaires, a printable PDF report and the parent dashboard — and if a paid period ever has to be refunded, the free part of the app is not taken away with it.":
    "चूँकि इन पर कुछ खर्च नहीं होता, इनका रिफ़ंड वाला सवाल नहीं बनता। पेड प्लान जो जोड़ता है वह है बातचीत की मात्रा, दोबारा भरी जा सकने वाली प्रश्नावली, एक प्रिंट होने वाली PDF रिपोर्ट और पैरेंट डैशबोर्ड — और अगर कभी किसी पेड अवधि का रिफ़ंड देना पड़े, तो ऐप का मुफ़्त हिस्सा उसके साथ छीना नहीं जाएगा।",
  "A report a family already generated, or an answer a student already received, is never repossessed over money. A dispute about an invoice cannot be a reason to withhold a child's history, because nothing a student already made is inside a paywall.":
    "जो रिपोर्ट परिवार ने पहले ही बना ली है, या जो जवाब स्टूडेंट ने पहले ही पा लिया है, वह पैसे के चलते कभी वापस नहीं लिया जाता। इनवॉइस के विवाद को किसी बच्चे का इतिहास रोकने का बहाना नहीं बनाया जा सकता, क्योंकि स्टूडेंट ने जो कुछ पहले बना लिया है वह किसी पेवॉल के पीछे नहीं है।",
  "The provider is named, because this section is no longer hypothetical: Razorpay. An order is created by this server and priced from the same numbers the plan limits are enforced from, and it is paid inside Razorpay's own page. A card number, an expiry, a CVV and a cardholder name have never existed in this application — the database holds an order id, a payment id, an amount in paise, a receipt and the attestation that went with it.":
    "प्रदाता का नाम यहाँ दिया गया है, क्योंकि यह हिस्सा अब कल्पना नहीं रहा: Razorpay. ऑर्डर इसी सर्वर से बनता है और उसी संख्या से कीमत पाता है जिससे प्लान की हदें लागू होती हैं, और भुगतान Razorpay की अपनी पेज पर होता है। कार्ड नंबर, समाप्ति तारीख, CVV और कार्डधारक का नाम इस ऐप में कभी रहे ही नहीं — डेटाबेस में एक ऑर्डर आईडी, एक भुगतान आईडी, पैसे में राशि, एक रसीद और उसके साथ आई प्रमाण-पत्र ही रखे जाते हैं।",
  "Two conditions come before any refund rule matters, and both are in the build now. A purchase is made by an adult who ticks, at the moment the order is created, that they are 18 or older and are paying for this knowingly — an order is refused without that answer. And the price, what it buys and how long it lasts are on screen before the charge, not in an email afterwards.":
    "किसी भी रिफ़ंड नियम के काम आने से पहले दो शर्तें आती हैं, और दोनों इस बिल्ड में अभी मौजूद हैं। खरीद हमेशा कोई बड़ा व्यक्ति करता है — ऑर्डर बनते ही वह चेक लगाता है कि उसकी उम्र 18 या उससे ज़्यादा है और वह समझकर ही पैसे दे रहा है; यह जवाब न देने पर ऑर्डर बनता ही नहीं। और कीमत, उससे क्या मिलता है और कितने दिन तक — यह शुल्क कटने से पहले स्क्रीन पर दिखता है, बाद में ईमेल में नहीं।",
  "Institutions are the intended large paid party, never a family buying a better career answer. A paid tier adds conversation volume, repeatable questionnaires, a printable report and a guardian's view. It does not change the order of a career suggestion for a student — there is no ranking code for money to influence, and the test suite checks that a recommendation comes out identical before a payment and after one.":
    "पैसे देने वाली बड़ी तरफ़ संस्थान होंगे, कभी कोई परिवार नहीं जो बेहतर करियर जवाब खरीद रहा हो। पेड टियर में बातचीत की मात्रा, दोबारा भरी जा सकने वाली प्रश्नावली, प्रिंट होने वाली रिपोर्ट और अभिभावक का व्यू जुड़ता है। वह किसी स्टूडेंट के करियर सुझाव का क्रम नहीं बदलता — यहाँ ऐसी कोई रैंकिंग कोड है ही नहीं जिस पर पैसा असर डाले, और टेस्ट सुइट यह जाँचता है कि सुझाव भुगतान से पहले और बाद बिल्कुल एक जैसा निकले।",
  "What is not built, and is therefore not a promise: there is no refund request inside this app. No button, no route, no call to the provider's refund API. Until one exists, a refund that is owed would be issued by hand from the payment provider's dashboard by whoever holds that account, using the receipt this app prints and a message through the contact page. That is a person doing it slowly rather than a product feature, and this page says so instead of describing a control that is not there.":
    "जो बनाया नहीं गया है, इसलिए वह वादा भी नहीं है: इस ऐप के अंदर रिफ़ंड माँगने का कोई तरीक़ा नहीं है। न कोई बटन, न कोई रास्ता, न प्रदाता की रिफ़ंड API पर कोई कॉल। जब तक ऐसा कुछ नहीं बनता, देय रिफ़ंड भुगतान प्रदाता के डैशबोर्ड से, उस अकाउंट को रखने वाले व्यक्ति द्वारा हाथ से दिया जाएगा — इस ऐप की छपी रसीद और संपर्क पेज पर भेजे गए संदेश के आधार पर। यह किसी इंसान का धीरे-धीरे कर दिया हुआ काम है, प्रोडक्ट का फीचर नहीं, और यह पेज यही लिखता है — मौजूद ही न होने वाले बटन का ब्यौरा देने के बजाय।",
  "The route is the contact form, carrying the receipt this app prints on its billing page and the payment reference if the provider gave one. Today there has been no payment to ask about, so nobody has used it: the form exists, the queue does not.":
    "रास्ता संपर्क फ़ॉर्म है, जिसमें इस ऐप की बिलिंग पेज पर छपी रसीद और — अगर प्रदाता ने दिया हो तो — भुगतान का रेफ़रेंस भी साथ भेजा जाता है। आज तक कोई भुगतान हुआ ही नहीं जिसके बारे में पूछा जाए, इसलिए किसी ने इसका इस्तेमाल नहीं किया: फ़ॉर्म मौजूद है, क़तार नहीं।",
  "What will not be required: an explanation of why the product was not good enough, a phone call, a postal address, or the upload of a document. A claim is tied to a payment reference rather than to a login, because there is no account in this app to tie it to — and the same receipt identifies the order to both sides.":
    "यह नहीं माँगा जाएगा: यह समझाना कि प्रोडक्ट काफ़ी अच्छा क्यों नहीं था, फ़ोन कॉल, डाक पता, या कोई दस्तावेज़ अपलोड करना। दावा किसी लॉगिन से नहीं, भुगतान रेफ़रेंस से जोड़ा जाता है, क्योंकि इस ऐप में दावे को जोड़ने को अकाउंट ही नहीं है — और वही रसीद दोनों तरफ़ उस ऑर्डर को पहचान देती है।",
  "The commitment is an answer within five working days of a request, and the money moved within ten working days of an approved one. A card refund then takes another two to five working days depending on the issuing bank, which is the processor’s time and not this app’s.":
    "वादा यह है कि अनुरोध के पाँच कार्यदिवसों के अंदर जवाब मिलेगा, और मंज़ूरी के दस कार्यदिवसों के अंदर पैसा भेज दिया जाएगा। कार्ड रिफ़ंड को उसके बाद और दो से पाँच कार्यदिवस लग सकते हैं, जो जारी करने वाले बैंक पर निर्भर है — वह प्रोसेसर का समय है, इस ऐप का नहीं।",
  "No queue, no ticketing system and no service-level agreement exists today, and on a build that has taken no payment these times have never been measured against a real case. They are published as the standard to be held to, not reported as a track record.":
    "आज न कोई क़तार है, न टिकटिंग सिस्टम, न सर्विस-लेवल एग्रीमेंट; और ऐसे बिल्ड पर जिसने कोई भुगतान नहीं लिया, इन समयों को किसी असली केस से कभी मापा नहीं गया। इन्हें उस मानक के तौर पर प्रकाशित किया गया है जिस पर चलना होगा — पुराना रिकॉर्ड बताते हुए नहीं।",
  "There is no subscription to cancel, and that is a decision rather than an unfinished feature: one payment buys one period with an end date, nothing charges again by itself, and no card mandate is held. The billing screen therefore offers to renew, and offers to switch to the free plan after naming what that gives up, and never offers to cancel something that was never going to repeat.":
    "रद्द करने को कोई सब्सक्रिप्शन नहीं है, और यह एक फ़ैसला है — अधूरा फीचर नहीं: एक भुगतान एक निश्चित अंत-तारीख वाली अवधि खरीदता है, कुछ भी ख़ुद-ब-ख़ुद दोबारा नहीं कटता, और कार्ड का कोई मेन्डेट नहीं रखा जाता। इसलिए बिलिंग स्क्रीन प्लान बढ़ाने का विकल्प देती है, और मुफ़्त प्लान पर जाने का भी — पहले यह बताकर कि इससे क्या छूट जाएगा; पर वह कभी रद्द करने का विकल्प नहीं देता जो दोबारा होने वाला ही नहीं था।",
  "Real auto-renewal would need the provider's subscription object, a live account and a mandate flow. None of that exists in this build, and none of it could have been tested without taking somebody's money — which is the reason this app does not claim a cancellation flow it cannot run.":
    "असली ऑटो-रिन्यूअल को प्रदाता के सब्सक्रिप्शन ऑब्जेक्ट, चालू अकाउंट और मेन्डेट की पूरी प्रक्रिया चाहिए। इस बिल्ड में वह कुछ भी नहीं है, और किसी के पैसे लिए बिना उसकी जाँच भी नहीं की जा सकती थी — यही कारण है कि यह ऐप रद्द करने की ऐसी प्रक्रिया का दावा नहीं करता जो चल ही नहीं सकती।",
  "Switching to the free plan early ends a period that was already paid for, and the confirmation on that button says so in days rather than hiding it. Whether part of an unused period is then refundable is decided by the rules above, not by the button: it gives up the features, and the money question stays with the receipt.":
    "मुफ़्त प्लान पर जल्दी जाना मतलब पहले से पेड अवधि को ख़त्म कर देना, और उस बटन की पुष्टि यह दिन गिनकर बताती है, छिपाती नहीं। अवधि का इस्तेमाल न हुआ हिस्सा रिफ़ंड होगा या नहीं — यह ऊपर लिखे नियम तय करेंगे, बटन नहीं: बटन सिर्फ़ फीचर छोड़ता है, पैसे का सवाल रसीद के साथ ही रहता है।",
  "A dispute does not replace the refund route above, and the app will not close off the contact form because a bank was contacted first. It also does not decide anything about a child’s data: an unpaid or disputed invoice will never be a reason to withhold or delete a student’s history. Nothing a student has already made sits behind a paywall, and the parts of the app that a paid plan adds are additions to a free path, not the path itself.":
    "विवाद ऊपर लिखे रिफ़ंड रास्ते की जगह नहीं लेता, और बैंक से पहले संपर्क होने के कारण ऐप संपर्क फ़ॉर्म बंद नहीं करेगा। यह बच्चे के डेटा के बारे में भी कुछ तय नहीं करता: बकाया न देने या विवादित इनवॉइस को कभी किसी स्टूडेंट का इतिहास रोकने या मिटाने का बहाना नहीं बनाया जाएगा। स्टूडेंट ने जो पहले से बना लिया है वह किसी पेवॉल के पीछे नहीं बैठता, और पेड प्लान जो हिस्से जोड़ता है वे एक मुफ़्त रास्ते की अतिरिक्त परतें हैं — वही रास्ता नहीं।",
  "Whether a paid plan can actually be bought here is answered on the pricing page itself, from the server, rather than by this document. A refund question goes to the contact form with the receipt printed on the billing page. A statement on a card is answered by the payment provider first, because they hold the transaction, not this app.":
    "क्या पेड प्लान यहाँ सच में खरीदा जा सकता है, इसका जवाब यह दस्तावेज़ नहीं, कीमत वाला पेज ख़ुद सर्वर से पढ़कर देता है। रिफ़ंड का सवाल संपर्क फ़ॉर्म पर जाता है, बिलिंग पेज पर छपी रसीद के साथ। कार्ड की स्टेटमेंट का जवाब पहले भुगतान प्रदाता देगा, क्योंकि लेनदेन उनके पास है, इस ऐप के पास नहीं।",

  // ---- Disclaimer
  "General disclaimer": "सामान्य अस्वीकरण",
  "AI-generated guidance": "एआई से बनी सलाह",
  "No guarantees": "कोई गारंटी नहीं",
  "Accuracy and currency of information": "जानकारी की सटीकता और ताज़गी",
  "External links and third-party services": "बाहरी लिंक और थर्ड-पार्टी सेवाएँ",
  "Not professional advice": "पेशेवर सलाह नहीं",
  "Parental guidance": "माता-पिता की भागीदारी",
  "This is a prototype that talks to children about their future. It is written by one person, it has not had legal review, and the answers it gives come from a machine that is good at sounding sure. Read this page before treating any of it as guidance.":
    "यह एक प्रोटोटाइप है जो बच्चों से उनके भविष्य के बारे में बात करता है। इसे एक व्यक्ति ने लिखा है, इसकी क़ानूनी जाँच नहीं हुई, और इसके जवाब एक ऐसी मशीन से आते हैं जो पूरे भरोसे की आवाज़ निकालने में माहिर है। इसमें किसी बात को सलाह मानने से पहले यह पेज पढ़ लीजिए।",
  "CareerGuide AI is provided as it is, for exploration. Everything on it — the conversation, the career suggestions, the stream advice, the exam lists, the schedules, the reports, the numbers in the catalogue — is offered for information and discussion, not as professional guidance of any kind.":
    "CareerGuide AI जैसा है वैसा ही दिया जाता है, खोज के लिए। इस पर सब कुछ — बातचीत, करियर सुझाव, स्ट्रीम की सलाह, परीक्षाओं की सूची, शेड्यूल, रिपोर्ट, कैटलॉग की संख्याएँ — सूचना और चर्चा के लिए है, किसी भी तरह के पेशेवर मार्गदर्शन के तौर पर नहीं।",
  "The app can be wrong, incomplete, out of date, or confidently mistaken. It has no way to know the student in front of it beyond what they choose to type or say, and it does not check its own answers against a human before sending them.":
    "ऐप ग़लत हो सकता है, अधूरा, पुराना, या पूरे आत्मविश्वास के साथ ग़लत। उसके सामने बैठा स्टूडेंट कौन है, यह वह उसी तक जानता है जो वह टाइप करना या बोलना चाहे, और जवाब भेजने से पहले उन्हें किसी इंसान से मिलाकर जाँचता नहीं है।",
  "This build has not had qualified legal review. It is not presented as compliant with the DPDP Act, GDPR, COPPA, or any other law; it describes its own behaviour instead of claiming a status.":
    "इस बिल्ड की किसी योग्य क़ानूनविद से जाँच नहीं हुई है। यह DPDP एक्ट, GDPR, COPPA या किसी और क़ानून का पालन करने वाली बताई नहीं जाती; यह अपने बर्ताव का वर्णन करती है, किसी दर्जे का दावा नहीं करती।",
  "Replies are generated by a language model, called through an API, from what the student just said. It is text produced by pattern-matching over an enormous amount of writing. It is not knowledge held by a person, and it is not research.":
    "जवाब स्टूडेंट ने अभी जो कहा, उससे एक भाषा मॉडल बनाता है जिसे API से बुलाया जाता है। यह विशाल मात्रा में लिखी गई टेक्स्ट में पैटर्न मिलाकर बनाई गई लिखाई है। यह किसी इंसान का ज्ञान नहीं है, और न यह कोई शोध है।",
  "A model can state something false in a well-written sentence, and the fluent part is what makes the false part convincing.":
    "एक मॉडल सुंदर लिखे वाक्य में झूठ कह सकता है, और वाक्य की चिकनी बुनाई ही उस झूठ को यक़ीनी बना देती है।",
  "Two students asking the same question can get different answers, because the reply depends on the conversation leading up to it.":
    "एक ही सवाल पूछने पर दो स्टूडेंट को अलग-अलग जवाब मिल सकते हैं, क्योंकि जवाब उससे पहले हुई बातचीत पर निर्भर करता है।",
  "A practice interview’s score and its notes are one model’s opinion about five answers in one sitting. They are not a mark, they are not a prediction of any real interview, and this app keeps nothing of them afterwards.":
    "प्रैक्टिस इंटरव्यू के अंक और उसकी टिप्पणियाँ एक मॉडल की राय हैं, एक ही बैठक के पाँच जवाबों के बारे में। वे नंबर नहीं हैं, किसी असली इंटरव्यू की भविष्यवाणी नहीं हैं, और इसके बाद इस ऐप में इनका कुछ भी सहेजा नहीं जाता।",
  "It does not diagnose anything, and nothing about a child’s ability is inferred from their voice, accent or speaking speed.":
    "यह किसी चीज़ का निदान नहीं करता, और बच्चे की क्षमता के बारे में कुछ भी उसकी आवाज़, उच्चारण या बोलने की गति से नहीं जोड़ा जाता।",
  "Nothing it says has been checked by a human before it reaches you.":
    "यह जो भी कहता है, आपको पहुँचने से पहले वह किसी इंसान ने जाँचा नहीं है।",
  "The app is not a crisis line, a counsellor, a teacher, a doctor or an adviser. If a conversation mentions danger, the app replies with a fixed safety message pointing to a trusted adult or a local helpline — that message is chosen by a person, and nobody watches the app in real time.":
    "ऐप न क्राइसिस लाइन है, न काउंसलर, न शिक्षक, न डॉक्टर और न सलाहकार। अगर बातचीत में ख़तरे का ज़िक्र आए तो ऐप एक तय सुरक्षा-संदेश भेजता है जो किसी भरोसेमंद बड़े या स्थानीय हेल्पलाइन की ओर ले जाता है — वह संदेश एक इंसान ने चुना है, और ऐप को कोई असली समय में देख नहीं रहा।",
  "Nothing here guarantees:": "यहाँ कुछ भी गारंटी नहीं देता:",
  "Admission to any school, college, university or programme.":
    "किसी स्कूल, कॉलेज, विश्वविद्यालय या प्रोग्राम में प्रवेश।",
  "A result in any exam, board or entrance test.": "किसी परीक्षा, बोर्ड या प्रवेश परीक्षा का नतीजा।",
  "A job, an internship, or a placement.": "नौकरी, इंटर्नशिप या प्लेसमेंट।",
  "A salary, or an income growing at any particular rate.": "वेतन, या किसी ख़ास रफ़्तार से बढ़ने वाली आय।",
  "That a career suggested here suits the student who was suggested it.":
    "कि यहाँ दिया करियर का सुझाव उस स्टूडेंट के सच में सही बैठेगा जिसे दिया गया।",
  "That a scholarship, scheme or institution listed here is still open, funded, or accepting applications this year.":
    "कि यहाँ लिखा कोई स्कॉलरशिप, योजना या संस्थान इस साल भी खुला है, उसे फंड मिला है, या आवेदन ले रहा है।",
  "A career suggestion is not a prediction. It is a starting point built from what the student reported, and the reasoning behind it is shown so the family can argue with it. The app never says a career is impossible for a child because of marks, income, gender, region or disability — that is a limit built into the guide, not a guarantee about outcomes.":
    "करियर का सुझाव भविष्यवाणी नहीं है। यह स्टूडेंट ने जो बताया, उससे बनी एक शुरुआत है, और उसके पीछे की सोच भी दिखाई जाती है ताकि परिवार उस पर बहस कर सके। ऐप कभी नहीं कहता कि किसी बच्चे के लिए कोई करियर असंभव है — न अंक की वजह से, न आय, लिंग, क्षेत्र या दिव्यांगता की वजह से; यह गाइड के अंदर बनाई गई हद है, नतीजों की गारंटी नहीं।",
  "Careers, exams, learning resources, scholarships and institutions in this build are sample data used to show the product working. Fees, deadlines, seat counts, syllabi, eligibility rules and placement figures change every year, and this app does not verify any of them against an official source before displaying them.":
    "इस बिल्ड में करियर, परीक्षाएँ, अध्ययन संसाधन, स्कॉलरशिप और संस्थान नमूना डेटा हैं, जो प्रोडक्ट चलता हुआ दिखाने के लिए रखे गए हैं। फीस, समय-सीमाएँ, सीटें, पाठ्यक्रम, पात्रता के नियम और प्लेसमेंट के आँकड़े हर साल बदलते हैं, और दिखाने से पहले यह ऐप इन्हें किसी आधिकारिक स्रोत से मिलाकर जाँचता नहीं है।",
  "Nothing here should be relied on for an application without checking the body that runs it. Where the app shows a scheme or an institution, it is describing what is stored in a demo table, and it never represents that data as live verified results.":
    "किसी आवेदन के लिए यहाँ की किसी बात पर भरोसा करने से पहले उसे चलाने वाली संस्था से जाँच लें। जहाँ ऐप कोई योजना या संस्थान दिखाता है, वह एक डेमो टेबल में सहेजी गई बात बयान कर रहा होता है, और उसे कभी ज़िंदा जाँचे हुए नतीजे नहीं बताता।",
  "Some cards carry a date. It means a person opened the official page named on that card and read the row against it on that day; the page is stored with the date and linked from the card, so the claim can be checked rather than trusted. A date covers what that reading actually compared — for an institution, usually its name, its city and its own web address. It says nothing about a fee, a deadline or an eligibility rule unless the row names a source for those, and a card with no date is the app’s own note.":
    "कुछ कार्डों पर एक तारीख होती है। इसका मतलब है कि उस दिन किसी इंसान ने कार्ड पर लिखे आधिकारिक पृष्ठ को खोला और उससे मिलाकर इस जानकारी को पढ़ा। वह पृष्ठ तारीख के साथ सहेजा जाता है और कार्ड से उसका लिंक रहता है, ताकि इस दावे पर भरोसा करने के बजाय उसे जाँचा जा सके। एक तारीख उतना ही ढकती है जितना उस पढ़ाई में सच में मिलाया गया था — एक संस्थान के लिए आमतौर पर उसका नाम, उसका शहर और उसका अपना वेब पता। जब तक उस क़तार में इनका स्रोत न लिखा हो, तारीख फीस, समय-सीमा या पात्रता के नियम के बारे में कुछ नहीं कहती। और जिस कार्ड पर तारीख नहीं है, वह ऐप की अपनी टिप्पणी है।",
  "The model’s own knowledge has a cutoff date and this project does not control which date that is. A course, a college or an exam pattern that changed recently may be described as it used to be.":
    "मॉडल के अपने ज्ञान की एक कटऑफ़ तारीख होती है और यह प्रोजेक्ट उसे नियंत्रित नहीं करता कि वह कौन सी तारीख है। हाल ही में बदला कोई कोर्स, कॉलेज या परीक्षा पैटर्न उसके पुराने रूप में वर्णित हो सकता है।",
  "Links out of this app — to a board, a university, a scholarship portal or the project’s own repository — leave this build. The pages reached are not written, operated, reviewed or audited by this project, and a link is not an endorsement.":
    "इस ऐप से बाहर जाने वाले लिंक — किसी बोर्ड, विश्वविद्यालय, स्कॉलरशिप पोर्टल या परियोजना की अपनी रिपॉज़िटरी तक — इस बिल्ड से बाहर ले जाते हैं। जहाँ पेज पहुँचते हैं उन्हें इस प्रोजेक्ट ने नहीं लिखा, नहीं चलाया, नहीं जाँचा और न ही कोई उसका ऑडिट किया है, और एक लिंक समर्थन नहीं है।",
  "The app also depends on services that are not this project’s: the language model provider, the text-to-speech provider, the browser’s own speech recognition, and the hosting and database platform. Each has its own terms and privacy policy, and a student’s text passes through them. Their data-retention behaviour has not been verified by this project; the privacy page lists what each one receives.":
    "ऐप ऐसी सेवाओं पर भी टिकी है जो इस प्रोजेक्ट की नहीं हैं: भाषा मॉडल प्रदाता, टेक्स्ट-टू-स्पीच प्रदाता, ब्राउज़र की अपनी स्पीच पहचान, और होस्टिंग व डेटाबेस प्लेटफ़ॉर्म। हर एक की अपनी शर्तें और अपनी गोपनीयता नीति है, और स्टूडेंट का टेक्स्ट उनके ऊपर से गुज़रता है। वे डेटा कितने दिन रखती हैं, इसकी जाँच इस प्रोजेक्ट ने नहीं की है; गोपनीयता पेज लिखता है कि हर एक को क्या मिलता है।",
  "If a page reached from here stops existing or changes, that is not something this prototype can fix or promise anything about.":
    "यहाँ से पहुँचने वाला कोई पेज बंद हो जाए या बदल जाए, तो यह इस प्रोटोटाइप के बस की बात नहीं और न इस पर कुछ वादा किया जा सकता है।",
  "Nobody behind this prototype is acting as a career counsellor, an education consultant, a doctor or a lawyer for the person using it, and there is no professional relationship between this app and a student.":
    "इस प्रोटोटाइप के पीछे का कोई भी व्यक्ति इस्तेमाल करने वाले का करियर काउंसलर, शिक्षा सलाहकार, डॉक्टर या वकील बनकर काम नहीं कर रहा, और इस ऐप तथा स्टूडेंट के बीच कोई पेशेवर संबंध नहीं है।",
  "Take these decisions to someone who can look at the actual child:":
    "ये फ़ैसले किसी ऐसे इंसान के सामने रखिए जो असली बच्चे को देख सके:",
  "A career counsellor or a guidance professional": "करियर काउंसलर या मार्गदर्शन पेशेवर",
  "for a decision that narrows a student’s future — a stream choice after class 10, a branch, a change of direction. Bring what the app produced as a starting point, not as an answer.":
    "उन फ़ैसलों के लिए जो स्टूडेंट का भविष्य सँकोड़ते हैं — कक्षा 10 के बाद स्ट्रीम चुनना, ब्रਾਂच, या दिशा बदलना। ऐप ने जो दिया उसे शुरुआत मानकर ले जाएँ, जवाब मानकर नहीं।",
  "A teacher or a school": "शिक्षक या स्कूल",
  "for what a particular student can actually manage at a particular school, and for the subjects a board really offers this year.":
    "यह जानने के लिए कि कौन सा स्टूडेंट किस स्कूल में असल में क्या कर सकता है, और यह कि इस साल कोई बोर्ड सच में कौन से विषय दे रहा है।",
  "A doctor or a psychiatrist": "डॉक्टर या मनोचिकित्सक",
  "for anything about a child’s health, learning, attention or mood. This app does not diagnose, and it is not a substitute for someone who can examine the child.":
    "बच्चे के स्वास्थ्य, पढ़ाई, ध्यान या मूड से जुड़ी किसी बात के लिए। यह ऐप निदान नहीं करता, और जो इंसान बच्चे की जाँच कर सकता है उसका बदल भी नहीं है।",
  "A lawyer, a CA, or the official body": "वकील, CA, या आधिकारिक संस्था",
  "for the rules of a profession, the eligibility of a course, or the terms of a scheme. The catalogue describes these things loosely; the bodies that run them state them exactly.":
    "किसी पेशे के नियमों, किसी कोर्स की पात्रता, या किसी योजना की शर्तों के लिए। कैटलॉग इन बातों को ढीले ढंग से बयान करता है; उन्हें चलाने वाली संस्थाएँ ही इन्हें ठीक-ठीक बताती हैं।",
  "This app is written for students from class 6 to 12, and a grown-up should be part of the conversation, not handed a report at the end of it. The parent view is reached through a code the student shares on purpose — there is no hidden dashboard, and the app does not monitor a child in the background.":
    "यह ऐप कक्षा 6 से 12 के स्टूडेंट्स के लिए बना है, और कोई बड़ा बातचीत का हिस्सा होना चाहिए — अंत में थमाई गई एक रिपोर्ट का नहीं। पैरेंट व्यू उस कोड से खुलता है जो स्टूडेंट जानबूझकर देता है — यहाँ कोई छिपा डैशबोर्ड नहीं है, और ऐप बच्चे की पृष्ठभूमि में निगरानी नहीं करता।",
  "The first screen asks for consent for a user under 18. That is a statement of intent from whoever is holding the device, not identity proof: the app has no way to know who typed. A parent who wants to see exactly what was said can read the conversation on the same device; nothing here is designed to be hidden from them.":
    "पहली स्क्रीन 18 से कम उम्र के उपयोगकर्ता की सहमति माँगती है। वह डिवाइस पकड़कर रखने वाले का इरादा है, पहचान का प्रमाण नहीं: ऐप के लिए यह असंभव है कि वह जाने किसने टाइप किया। कोई माता-पिता जो ठीक-ठीक देखना चाहते हैं कि क्या कहा गया, वही बातचीत उसी डिवाइस पर पढ़ सकते हैं; यहाँ कुछ भी ऐसा बनाया नहीं गया जो उनसे छिपाया जाए।",
  "Voice needs the same oversight as text. A microphone left open in a shared room picks up more than the student intended, so the app listens only while a button is held down, keeps no raw recording by default, and says on the voice screen when it has had to fall back to the browser’s own speech instead of the server voice.":
    "आवाज़ को भी उतनी ही देखभाल चाहिए जितनी टेक्स्ट को। एक साझा कमरे में खुला छोड़ा माइक स्टूडेंट से ज़्यादा पकड़ लेता है, इसलिए ऐप केवल तभी सुनता है जब बटन दबाया जा रहा हो, डिफ़ॉल्ट रूप में कोई रॉ रिकॉर्डिंग नहीं रखता, और वॉइस स्क्रीन पर खुद बता देता है जब उसे सर्वर आवाज़ की जगह ब्राउज़र की अपनी स्पीच पर जाना पड़े।",
  "Not a monitoring tool": "निगरानी का औज़ार नहीं",
  "No covert recording, no background listening.": "कोई छिपकर रिकॉर्डिंग नहीं, पृष्ठभूमि में सुनना नहीं।",
  "To the maximum extent the law allows, the people behind this prototype are not liable for loss or damage arising from its use — including a decision about a subject, a stream, an exam, a course, an institution or a career made on the strength of anything shown here.":
    "क़ानून जो तक इजाज़त देता है, उस तक इस प्रोटोटाइप के पीछे के लोग इसके इस्तेमाल से हुए नुक़सान या क्षति के लिए ज़िम्मेदार नहीं हैं — जिसमें यहाँ दिखी किसी बात के दम पर लिए गए विषय, स्ट्रीम, परीक्षा, कोर्स, संस्थान या करियर के फ़ैसले भी शामिल हैं।",
  "A prototype should not be the basis for a decision that shapes a student’s future. Use it to arrive at a question worth asking a human, and then ask it.":
    "इतने भारी फ़ैसले की बुनियाद प्रोटोटाइप नहीं होना चाहिए जो स्टूडेंट के भविष्य को आकार दें। इससे एक अच्छा सवाल तैयार करने में मदद लीजिए, और फिर वह सवाल किसी इंसान से पूछिए।",
  "If something on this site is wrong, misleading, or harmful to a child, say so. The contact form is the channel, and the repository’s issue tracker is the public one. There is no service-level response time and no support desk; the contact page names the inbox and the answer window it aims at, and says plainly whether those are live yet.":
    "अगर इस साइट पर कुछ ग़लत, भ्रमित करने वाला या किसी बच्चे के लिए नुक़सानदेह है तो बताइए। संपर्क फ़ॉर्म इसका रास्ता है, और रिपॉज़िटरी का issue tracker सार्वजनिक रास्ता। न कोई तय जवाब-समय है, न सपोर्ट डेस्क; संपर्क पेज वह इनबॉक्स और वह जवाब-समय बताता है जिसकी इसे तैनाती पर उम्मीद है, और साफ़-साफ़ लिखता है कि ये अभी चल रहे हैं या नहीं।",
  "Terms: the guide, and what it never does": "शर्तें: गाइड, और वह कभी क्या नहीं करता",

  // ---- About
  "About CareerGuide AI": "CareerGuide AI के बारे में",
  "AI career guidance for every Indian student": "हर भारतीय स्टूडेंट के लिए एआई करियर मार्गदर्शन",
  "Career advice in India usually costs money, needs a connection, or starts with a test. This project tries a fourth thing: a conversation a thirteen-year-old can have in the language they think in, on a phone, for nothing, without signing up.":
    "भारत में करियर की सलाह आमतौर पर महँगी होती है, सिफ़ारिश माँगती है, या किसी टेस्ट से शुरू होती है। यह प्रोजेक्ट चौथा रास्ता आज़माता है: एक बातचीत जो कोई तेरह साल का बच्चा अपनी सोच की भाषा में, फ़ोन पर, मुफ़्त और बिना साइन-अप किए कर सके।",
  "It is a prototype built by one person, not a company. It has no funding, no users to report on, and no career counsellor on staff. What it has is public code, a working app, and pages that describe the limits instead of hiding them.":
    "यह एक व्यक्ति द्वारा बनाया प्रोटोटाइप है, किसी कंपनी का नहीं। न इसकी फंडिंग है, न बताने को यूज़र्स, और न स्टाफ़ में कोई करियर काउंसलर। इसमें जो है वह सार्वजनिक कोड, चलता हुआ ऐप, और वह पेज हैं जो अपनी कमियाँ छिपाने की जगह लिख देते हैं।",
  Mission: "मिशन",
  "Help a student understand what they are drawn to, what the realistic routes look like and what they cost — then hand that back to them and their family to decide with. Not to sort children into careers.":
    "स्टूडेंट को समझने में मदद करना कि उसे क्या पसंद है, असली रास्ते कैसे दिखते हैं और उनका खर्च क्या है — फिर वह सब उसके और उसके परिवार के हाथ में दे आना ताकि वे मिलकर तय करें। बच्चों को करियर में बाँटना इसका मकसद नहीं।",
  "The measure is whether a conversation here leaves a family better able to ask a real teacher, a counsellor or an official website a sharper question. A suggestion from this app is the beginning of that, never the end of it.":
    "पैमाना यह है कि यहाँ की बातचीत के बाद परिवार किसी असली शिक्षक, काउंसलर या आधिकारिक वेबसाइट से बेहतर सवाल पूछ पाने में सक्षम होता है या नहीं। इस ऐप का सुझाव उसकी शुरुआत है, अंत कभी नहीं।",
  "Three things happen in a normal visit, in this order.": "एक सामान्य विज़िट में तीन चीज़ें होती हैं, इसी क्रम में।",
  "It starts with a question, not a form": "यह फ़ॉर्म से नहीं, एक सवाल से शुरू होती है",
  "The first screen asks one thing — are you a student or a parent. Everything else, from class to interests, comes out in conversation, in Hindi, English or Hinglish. There is no aptitude test to prepare for and no personal details to fill in.":
    "पहली स्क्रीन एक ही चीज़ पूछती है — आप स्टूडेंट हैं या पैरेंट। बाक़ी सब, कक्षा से रुचि तक, बातचीत से निकलता है — हिन्दी, अंग्रेज़ी या हिंग्लिश में। इसके लिए कोई एप्टिट्यूड टेस्ट देने की तैयारी नहीं है, और न कोई निजी जानकारी भरनी है।",
  "The guide suggests, and shows its work": "गाइड सुझाव देता है, और अपना काम भी दिखाता है",
  "Careers are matched to themes the student actually mentioned. The evidence behind a suggestion is on screen beside it, so a family can disagree with it instead of taking it on faith.":
    "करियर उन थीमों से मिलाए जाते हैं जो स्टूडेंट ने सच में बताईं। सुझाव के पीछे का सबूत स्क्रीन पर उसके बग़ल में दिखता है, ताकि परिवार उसे आँख बंद कर मानने की जगह उस पर असहमत हो सके।",
  "Exploration turns into a small next step": "खोज एक छोटे से अगले कदम में बदलती है",
  "A free video, a book, a project, a conversation with someone who does the work — plus what a route costs, what to verify on an official site, and which exams or stream choices sit on the way.":
    "एक मुफ़्त वीडियो, एक किताब, एक प्रोजेक्ट, उस काम को करने वाले किसी से बात — साथ में यह कि कोई रास्ता कितना खर्च करता है, आधिकारिक साइट पर क्या जाँचना है, और रास्ते में कौन सी परीक्षाएँ या स्ट्रीम के विकल्प पड़े हैं।",
  Step: "चरण",
  "Under the surface: a Next.js app talks to a FastAPI service, which calls a language model for the replies and a speech model for the voice. Career, exam and institution records come from a Postgres database.":
    "अंदर की बात: एक Next.js ऐप FastAPI सेवा से बात करता है, जो जवाबों के लिए एक भाषा मॉडल और आवाज़ के लिए एक स्पीच मॉडल को बुलाती है। करियर, परीक्षा और संस्थान के रिकॉर्ड एक Postgres डेटाबेस से आते हैं।",
  "Which outside services see your text": "बाहर की कौन सी सेवाएँ आपका टेक्स्ट देखती हैं",
  "What this project holds to": "यह प्रोजेक्ट किन बातों पर कायम है",
  "Privacy first, and provably small": "गोपनीयता पहले — और जाँचे जा सकने लायक कम डेटा",
  "No account, no phone number, no school, no address. The app is free because it holds nothing worth selling. Raw microphone audio is not stored, there is no background listening, and the code is public so anyone can check that this is true rather than take it on trust.":
    "न अकाउंट, न फ़ोन नंबर, न स्कूल, न पता। यह ऐप मुफ़्त है क्योंकि इसमें बेचने लायक कुछ है ही नहीं। माइक का रॉ ऑडियो नहीं सहेजा जाता, पृष्ठभूमि में सुना नहीं जाता, और कोड सार्वजनिक है ताकि कोई भी इसे ख़ुद जाँच सके, केवल भरोसा करके न माने।",
  "The build has not had legal review, so it should not hold a real child’s data yet.":
    "इस बिल्ड की क़ानूनी जाँच नहीं हुई है, इसलिए इसमें अभी किसी असली बच्चे का डेटा नहीं होना चाहिए।",
  "Cost said out loud": "खर्च खुले शब्दों में बताया जाता है",
  "Every expensive path is shown next to a lower-cost one, with the fees labelled as figures to verify rather than facts. No paid course, coaching institute or college is pushed at a family, and an institution that ever pays for a listing will be badged as sponsored.":
    "हर महँगे रास्ते के बग़ल में एक सस्ता रास्ता दिखता है, और फीस को तथ्य नहीं बल्कि जाँचने योग्य संख्या बताकर लिखा जाता है। किसी परिवार को कोई पेड कोर्स, कोचिंग संस्थान या कॉलेज थोपा नहीं जाता, और जो संस्थान कभी लिस्टिंग के लिए पैसे देगा, उसे प्रायोजित लेबल के साथ दिखाया जाएगा।",
  "Nothing is for sale today: no checkout, no subscription, no payment provider is connected.":
    "आज बिक्री के लिए कुछ नहीं है: न चेकआउट, न सब्सक्रिप्शन, और न कोई भुगतान प्रदाता जुड़ा है।",
  // The honest half of that sentence: the code is there, the keys are not.
  "A checkout exists in the code and has been tested against a stubbed provider, but no payment keys are set on this deployment, so nothing has been charged and there is no refund action inside the app.":
    "कोड में चेकआउट मौजूद है और एक नकली (stubbed) प्रदाता के साथ उसकी जाँच भी हुई है, पर इस तैनाती पर भुगतान की कोई key नहीं लगी है — इसलिए एक भी पैसा नहीं लिया गया, और ऐप में रिफ़ंड का कोई रास्ता भी नहीं है।",
  "Parents in, never watching": "माता-पिता साथ में, कभी निगरानी में नहीं",
  "A student chooses what to share and reaches a grown-up with a code they pass on purpose. The parent view shows interests, evidence and next steps — not a hidden score, not a diagnosis, not a transcript the child did not offer.":
    "स्टूडेंट ख़ुद चुनता है क्या साझा करना है, और वह कोड जानबूझकर किसी बड़े को देता है। पैरेंट व्यू रुचियाँ, सबूत और अगले कदम दिखाता है — कोई छिपा स्कोर नहीं, कोई निदान नहीं, और न ही बच्चे की बिना दिए गई बातचीत।",
  "There is no real account system yet, so sharing depends on a device this app cannot protect from a lost browser.":
    "अभी कोई असली अकाउंट सिस्टम नहीं है, इसलिए शेयरिंग एक ऐसे डिवाइस पर टिकी है जिसे यह ऐप खोए हुए ब्राउज़र से बचा नहीं सकता।",
  "A child is not a data point": "बच्चा कोई डेटा-बिंदु नहीं है",
  "Nothing about ability, personality or intelligence is inferred from a voice, an accent or a speaking speed. The guide will never tell a student a career is closed to them because of marks, income, gender, region or disability.":
    "क्षमता, व्यक्तित्व या बुद्धि के बारे में कुछ भी आवाज़, उच्चारण या बोलने की गति से नहीं जोड़ा जाता। गाइड कभी नहीं कहेगा कि किसी स्टूडेंट के लिए कोई करियर बंद है — अंक, आय, लिंग, क्षेत्र या दिव्यांगता की वजह से नहीं।",
  "It is a language model, not a counsellor. It can be confident and wrong in the same sentence.":
    "यह एक भाषा मॉडल है, काउंसलर नहीं। एक ही वाक्य में यह पूरे भरोसे के साथ ग़लत हो सकता है।",
  "The team": "टीम",
  "There is no team to list. This is one person’s prototype project, published in a public repository, with no staff to name and no investors to thank.":
    "बताने को कोई टीम नहीं है। यह एक व्यक्ति का प्रोटोटाइप प्रोजेक्ट है, एक सार्वजनिक रिपॉज़िटरी में प्रकाशित — न बताई जाने वाला कोई स्टाफ़, न शुक्रिया अदा करने योग्य कोई निवेशक।",
  "A normal About page would put a card here for each founder, an advisory board, and a sentence about investors. None of those exist, so this section names the operator instead of inventing people to fill it.":
    "एक आम About पेज यहाँ हर संस्थापक का कार्ड, एक सलाहकार बोर्ड और निवेशकों के बारे में एक पंक्ति डालता है। इनमें से कुछ भी मौजूद नहीं है, इसलिए यह हिस्सा गढ़े हुए लोगों की जगह उस संस्थाचालक का नाम बताता है जो यह चलाता है।",
  "No career counsellor, psychologist or education researcher has reviewed the questions the guide asks or the answers it gives. That review is on the list of things this project still needs, and it is the reason the safety and disclaimer pages say what they say.":
    "न किसी करियर काउंसलर, न मनोवैज्ञानिक और न शिक्षा शोधकर्ता ने गाइड के पूछे सवालों या दिए जवाबों की जाँच की है। वह समीक्षा इस प्रोजेक्ट की बाक़ी ज़रूरतों की सूची में है, और इसीलिए सुरक्षा और अस्वीकरण पेज जो कहते हैं वह सच कहते हैं।",
  "Read before a child uses it": "बच्चे को देने से पहले पढ़ें",
  "Progress lives in one browser. Clearing this site’s data, a private window or another device starts a new student, and nothing can be recovered.":
    "प्रगति एक ही ब्राउज़र में रहती है। साइट का डेटा हटाना, निजी विंडो खोलना या दूसरा डिवाइस इस्तेमाल करना नया स्टूडेंट बना देता है, और कुछ भी वापस नहीं मिल सकता।",
  "Replies come from a language model and are not checked by a human before they reach the screen. The catalogue of careers, exams and scholarships is sample data.":
    "जवाब एक भाषा मॉडल से आते हैं और स्क्रीन पर पहुँचने से पहले इन्हें कोई इंसान जाँचता नहीं। करियर, परीक्षाओं और स्कॉलरशिप का कैटलॉग नमूना डेटा है।",
  "The app is not an emergency service and nobody watches it in real time. If a child is in danger, contact real services and a trusted adult directly.":
    "ऐप कोई आपातकालीन सेवा नहीं है और इसे कोई असली समय में देख नहीं रहा। अगर कोई बच्चा ख़तरे में है तो सीधे असली सेवाओं और किसी भरोसेमंद बड़े से संपर्क करें।",
  "Begin with one conversation": "एक बातचीत से शुरू करें",
  "No sign-up, no test, no personal details to hand over. Answer one question and start talking.":
    "न साइन-अप, न कोई टेस्ट, न सौंपी जाने वाली निजी जानकारी। बस एक सवाल का जवाब दीजिए और बात शुरू कीजिए।",
  "Start exploring": "खोजना शुरू करें",
  "Get started": "शुरू करें",

  // ---- Contact
  "Send a message": "एक संदेश भेजें",
  "What happens to what you write": "आप जो लिखते हैं उसका क्या होता है",
  "Business contact": "व्यावसायिक संपर्क",
  "How long an answer takes": "जवाब में कितना समय लगता है",
  "The channel that always works": "वह रास्ता जो हमेशा काम करता है",
  "How to reach this project, what happens to a message you send, and what to do if a child is in danger right now.":
    "इस प्रोजेक्ट तक कैसे पहुँचें, भेजे गए संदेश का क्या होता है, और अगर कोई बच्चा अभी ख़तरे में है तो क्या करें।",
  "This form posts to one address that a person reads. It is not a support desk, and it is not watched in real time.":
    "यह फ़ॉर्म एक ही पते पर भेजता है जिसे कोई इंसान पढ़ता है। यह सपोर्ट डेस्क नहीं है, और इसे असली समय में कोई देख नहीं रहा।",
  "Sent. The message went to the address this deployment reads. There is no promised reply time.":
    "भेज दिया गया। संदेश उस पते पर पहुँचा जिसे यह डिप्लॉयमेंट पढ़ता है। जवाब देने का कोई तय समय वादा नहीं है।",
  "This deployment has no mail transport, so nothing was sent.":
    "इस डिप्लॉयमेंट में मेल भेजने का कोई ज़रिया नहीं है, इसलिए कुछ भी भेजा नहीं गया।",
  "Missing on the server:": "सर्वर पर यह ग़ायब है:",
  unknown: "अज्ञात",
  "Until those environment variables are set, use the GitHub repository below — that is a channel that works today.":
    "जब तक वे एनवायरनमेंट वेरिएबल सेट नहीं होते, नीचे दी GitHub रिपॉज़िटरी इस्तेमाल करें — वह रास्ता आज काम करता है।",
  "The message could not be delivered. Try again, or use the GitHub repository below.":
    "संदेश पहुँचाया नहीं जा सका। दोबारा कोशिश करें, या नीचे दी GitHub रिपॉज़िटरी इस्तेमाल करें।",
  Name: "नाम",
  "How should we address you?": "आपको किस नाम से बुलाएँ?",
  "Used only to reply to this message. It is not stored in the app's database.":
    "केवल इसी संदेश का जवाब देने के लिए इस्तेमाल होगा। यह ऐप के डेटाबेस में सहेजा नहीं जाता।",
  Subject: "विषय",
  "Choose a subject": "विषय चुनें",
  General: "सामान्य",
  Grievance: "शिकायत",
  Technical: "तकनीकी",
  Message: "संदेश",
  "What would you like to tell us?": "आप हमें क्या बताना चाहेंगे?",
  "Please do not write a child’s conversation, nickname or device id into this form. If the problem is a leak of a child’s data, describe it without quoting it.":
    "इस फ़ॉर्म में किसी बच्चे की बातचीत, उपनाम या डिवाइस आईडी न लिखें। अगर समस्या बच्चे के डेटा का रिसाव है, तो उसे बिना उद्धृत किए बताइए।",
  "Send message": "संदेश भेजें",
  "The form posts to this site's own endpoint, which hands the text to an email service (Resend) for delivery to one mailbox. Nothing is written into the application database, no conversation is attached, and the message body is not written to the server logs.":
    "यह फ़ॉर्म इसी साइट के अपने एंडपॉइंट पर भेजता है, जो टेक्स्ट एक ईमेल सेवा (Resend) को दे देता है ताकि वह एक ही मेलबॉक्स तक पहुँचे। एप्लिकेशन डेटाबेस में कुछ नहीं लिखा जाता, कोई बातचीत संलग्न नहीं होती, और संदेश का पूरा टेक्स्ट सर्वर लॉग में भी नहीं जाता।",
  "The reply address is the email you type, so whoever answers can reply to you. If the mail service is not configured on this deployment, the form says so on screen and sends nothing — it will not show you a success message that no mailbox received.":
    "जवाब का पता वही ईमेल है जो आप लिखते हैं, इसलिए जवाब देने वाला आपको सीधे जवाब लिख सकता है। अगर यह डिप्लॉयमेंट मेल सेवा के साथ सेट नहीं है तो फ़ॉर्म स्क्रीन पर यही कहेगा और कुछ भेजेगा नहीं — वह आपको कोई सफलता-संदेश नहीं दिखाएगा जो किसी मेलबॉक्स तक पहुँचा ही नहीं।",
  "A service for users in India names a grievance officer who answers within a stated period. Those details are kept in one place in this project's code and every legal page reads them from there, so this list and the one on the privacy policy cannot drift apart.":
    "भारत में इस्तेमाल होने वाली सेवा एक शिकायत अधिकारी का नाम बताती है जो तय समय में जवाब दे। वे मान इस प्रोजेक्ट के कोड की एक ही जगह रखे हैं, और हर क़ानूनी पेज उन्हें वहीं से पढ़ता है — इसलिए यह सूची और गोपनीयता नीति वाली सूची एक-दूसरे से अलग नहीं हो सकतीं।",
  "Response time": "जवाब का समय",
  "The period named above is the one a configured deployment answers within. Where the note on these cards says the details are still samples, there is no queue yet and nobody reading one, so the honest version of that promise is: write it down, expect silence, and use the repository if the question is about something broken.":
    "ऊपर लिखा समय वह अंतराल है जिसमें एक सेट-अप हो चुकी तैनाती जवाब देती है। जहाँ इन कार्डों का नोट कहता है कि ये मान अभी नमूने हैं, वहाँ कोई क़तार भी नहीं है और पढ़ने वाला भी कोई नहीं — इसलिए उस वादे का ईमानदार रूप यही है: बात लिख दीजिए, चुप्पी की उम्मीद रखिए, और अगर सवाल किसी ख़राब चीज़ के बारे में है तो रिपॉज़िटरी इस्तेमाल कीजिए।",
  "The same details, written out for anyone who wants to know who runs the site rather than who answers a complaint.":
    "वही मान, एक बार और लिखे गए — उन लोगों के लिए जो यह जानना चाहते हैं कि साइट कौन चलाता है, शिकायत का जवाब कौन देता है यह नहीं।",
  "Registered address": "पंजीकृत पता",
  Phone: "फ़ोन",
  "What can be said either way: a privacy or grievance message is the one kind that should be answered first, and the GitHub issue is visible to everyone, which usually makes it the fastest of the two.":
    "दोनों सूरतों में इतना कहा जा सकता है: गोपनीयता या शिकायत वाला संदेश सबसे पहले जवाब माँगता है, और GitHub issue सबको दिखता है, जिससे वह अक्सर दोनों में तेज़ हो जाता है।",
  "The only place a message is certain to be seen is the project’s public GitHub repository — bug reports, wrong career information and privacy concerns included.":
    "एक ही जगह है जहाँ संदेश पढ़ा जाना पक्का है — प्रोजेक्ट की सार्वजनिक GitHub रिपॉज़िटरी, चाहे बात बग की हो, ग़लत करियर जानकारी की या गोपनीयता की चिंता की।",
  "It is a public repository. Nothing private about a child belongs in it.":
    "यह एक सार्वजनिक रिपॉज़िटरी है। किसी बच्चे की निजी बात इसमें नहीं डाली जानी चाहिए।",
  "Please fill this in.": "कृपया यह भरिए।",
  "That does not look like an email address.": "यह ईमेल पता जैसा नहीं दिखता।",
  "A little more detail, please — at least ten characters.": "थोड़ा और विस्तार से कृपया — कम से कम दस अक्षर।",
  "That is longer than this form can send.": "यह इतना लंबा है कि यह फ़ॉर्म भेज नहीं सकता।",
  "Choose one of the listed options.": "दी गई विकल्पों में से एक चुनें।",

  // ---- Legal index
  "The five pages": "पाँच पेज",
  "Five pages, written for the app that actually exists rather than from a template: what happens to your data, the terms of use, refunds, the limits of the advice, and how to reach this project.":
    "पाँच पेज, किसी टेम्पलेट से नहीं बल्कि उस ऐप के बारे में जो सच में मौजूद है: आपके डेटा का क्या होता है, उपयोग की शर्तें, रिफ़ंड, सलाह की हदें, और इस प्रोजेक्ट तक पहुँचने का रास्ता।",
  "Nothing is for sale today, so nothing can be refunded. The rules written before the first price exists.":
    "आज बिक्री के लिए कुछ नहीं है, इसलिए रिफ़ंड भी कुछ नहीं हो सकता। पहली कीमत होने से पहले लिखे गए नियम।",
  "The limits of what this software knows: a language model, sample data, and no professional relationship.":
    "यह सॉफ़्टवेयर क्या जानता है, उसकी हद: एक भाषा मॉडल, नमूना डेटा, और कोई पेशेवर संबंध नहीं।",
};
