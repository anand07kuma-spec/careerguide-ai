/** Hindi for the public career and blog pages and their shared frame.
 *
 * These screens are server components, so the lookup happens before the HTML is
 * sent — see `lib/request-lang.ts` and `lib/public-i18n.ts`. What is translated
 * here is the page's own words: navigation, headings, filter chrome, failure
 * states and disclaimers. The career text comes from the backend catalogue and
 * the guide text from markdown on disk, both English, and each Hindi page says
 * so on itself rather than leaving the reader to find out by scrolling.
 *
 * Two deliberate English leftovers:
 * - the search placeholder on `/careers` still lists `nurse, lawyer, data,
 *   pilot`, because the catalogue is stored in English and a placeholder that
 *   suggests Hindi words would send a reader to a guaranteed empty result;
 * - `metadata` titles and descriptions stay English, so a crawler and a
 *   Hindi reader are not handed two different accounts of the same page.
 */
export const HI: Record<string, string> = {
  // Shared public frame
  "Public pages": "साइट के पेज",
  "Study abroad": "विदेश में पढ़ाई",
  "Open your dashboard": "अपना डैशबोर्ड खोलें",
  Guides: "मार्गदर्शिकाएँ",
  // "Pricing" and "Career profiles" already have entries in `trust.ts` and are
  // left to them — re-adding them here would silently change the label on the
  // pricing screen, because the merge in `index.ts` lets the last file win.
  "Interface language": "इंटरफ़ेस की भाषा",
  "Light or dark theme": "लाइट या डार्क थीम",
  Breadcrumb: "ब्रेडक्रम्ब",
  "The headings and buttons on this page are in Hindi. The {what} are written in English and are not translated yet.":
    "इस पेज के हेडिंग और बटन हिन्दी में हैं। {what} अंग्रेज़ी में लिखे हैं और अभी अनुवादित नहीं हैं।",
  "career descriptions": "करियर के विवरण",
  "career description on this page": "इस पेज पर करियर का विवरण",
  "guide articles": "मार्गदर्शिका के लेख",
  "guide article below": "नीचे दिया गया लेख",

  // Catalogue could not be reached
  "The career list could not be loaded": "करियर की लिस्ट लोड नहीं हो सकी",
  "This page asked the catalogue API for {what} and got no usable answer. The careers themselves are stored in the backend database, so nothing here can be listed until that service is reachable again.":
    "इस पेज ने कैटलॉग API से {what} माँगा और कोई काम का जवाब नहीं मिला। करियर की जानकारी बैकएंड डेटाबेस में है, इसलिए जब तक वह सेवा फिर से उपलब्ध न हो, यहाँ कुछ भी दिख नहीं सकता।",
  "This is not the app saying there are no careers to show — it is the app saying it does not know. Nothing has been filled in from a cached or invented list.":
    "यह ऐप यह नहीं कह रहा कि दिखाने को कोई करियर नहीं है — यह ऐप यह कह रहा है कि उसे पता नहीं है। यहाँ कोई कैश की गई या गढ़ी हुई लिस्ट भरकर नहीं दिखाई गई है।",
  "Talk to the guide instead": "बजाय इसके, गाइड से बात करें",
  "The catalogue service could not be reached.": "कैटलॉग सेवा से जुड़ा नहीं जा सका।",
  "The catalogue replied {status} to this filter.": "कैटलॉग ने इस फ़िल्टर पर {status} जवाब भेजा।",
  "the list of career profiles": "करियर प्रोफ़ाइलों की लिस्ट",

  // A slug that is not in the catalogue
  "No career is listed under that name": "इस नाम से कोई करियर लिस्ट में नहीं है",
  "The career “{slug}” is not in the catalogue this deployment has seeded. It may have been renamed, or the link may have come from a different build.":
    "“{slug}” नाम से कोई करियर इस इंस्टॉलेशन के कैटलॉग में नहीं है। हो सकता है इसका नाम बदल गया हो, या लिंक किसी दूसरे बिल्ड से आया हो।",
  "Browse the careers that are listed": "जो करियर लिस्ट में हैं उन्हें देखें",

  // /careers — index
  "What the work is actually like": "काम असल में कैसा है",
  "Each profile says what someone in the job does on an ordinary day, which school subjects and class levels lead toward it, what the route costs, and what still has to be checked on an official site before a family plans around it.":
    "हर प्रोफ़ाइल बताती है कि उस काम में कोई व्यक्ति आम दिन क्या-क्या करता है, स्कूल के कौन-से विषय और कौन-सी कक्षाएँ उस रास्ते पर ले जाती हैं, वह रास्ता कितना पड़ता है, और परिवार को उसके आधार पर फ़ैसला लेने से पहले आधिकारिक साइट पर क्या जाँचना बाकी है।",
  "These are written to a starter catalogue curated for this project. They are not a survey of the Indian job market, they carry no salary or placement figures, and a profile that needs a fact checked says so on the page.":
    "ये इस प्रोजेक्ट के लिए तैयार किए गए एक स्टार्टर कैटलॉग के हिसाब से लिखी गई हैं। ये भारतीय जॉब मार्केट का सर्वे नहीं हैं, इनमें तनख्वाह या प्लेसमेंट का कोई आँकड़ा नहीं है, और जिस प्रोफ़ाइल में किसी तथ्य की जाँच बाकी है, वह पेज पर खुद कहती है।",
  "nurse, lawyer, data, pilot": "nurse, lawyer, data, pilot",
  "Career categories": "करियर के समूह",
  "{n} career matches": "{n} करियर मेल खाता है",
  "{n} careers match": "{n} करियर मेल खाते हैं",
  " for “{q}”": " “{q}” के लिए",
  " in {c}": ", {c} में",
  "Nothing matched": "कोई मेल नहीं खाया",
  "No profile in this catalogue fits that filter. The list above is what exists here right now — an empty result means the search term is not in it, not that the career does not exist.":
    "इस कैटलॉग में कोई प्रोफ़ाइल उस फ़िल्टर से मेल नहीं खाती। ऊपर जो लिस्ट है, अभी यही मौजूद है — ख़ाली नतीजे का मतलब यह नहीं कि वह करियर होता ही नहीं, बल्कि यह कि वह शब्द इस लिस्ट में नहीं है। करियर के नाम और विवरण अंग्रेज़ी में लिखे हैं, इसलिए अंग्रेज़ी का शब्द खोजें।",
  "Interests:": "रुचियाँ:",
  "Open from class {n}": "कक्षा {n} से शुरू कर सकते हैं",

  // /careers/[slug] — one profile
  "From class {n}": "कक्षा {n} से",
  "Figures to verify": "आँकड़े जाँचने बाकी",
  "This record was written from general knowledge rather than read off a live official source. Treat the fees, exam names and route steps below as things to confirm with a recognising body or college before a family plans around them.":
    "यह रिकॉर्ड आम जानकारी से लिखा गया है, किसी लाइव आधिकारिक स्रोत से पढ़कर नहीं। नीचे दी फ़ीस, एग्ज़ाम के नाम और रास्ते के चरणों को किसी मान्यता प्राप्त बॉडी या कॉलेज से तय कर लें, इससे पहले कि परिवार इनके आधार पर योजना बनाए।",
  "What the work involves": "काम में क्या-क्या शामिल है",
  "School subjects behind it": "इससे जुड़े स्कूल के विषय",
  "How people reach it": "लोग इस तक कैसे पहुँचते हैं",
  "What you need to get in": "दाखिले के लिए क्या ज़रूरी है",
  "Stages along the way": "रास्ते के चरण",
  "An ordinary day": "एक आम दिन",
  "Cost, and cheaper routes": "खर्चा, और सस्ते रास्ते",
  "What people like": "लोग इसमें क्या पसंद करते हैं",
  "What is hard": "इसमें क्या मुश्किल है",
  "Try it before choosing it": "चुनने से पहले इसे आज़माएँ",
  "Check the official source": "आधिकारिक स्रोत से जाँचें",
  "Ask {site} about this career": "इस करियर के बारे में {site} से पूछें",
  "A conversation can go further than a profile: what to do in this class, in this language, with the subjects actually on your timetable.":
    "बातचीत प्रोफ़ाइल से आगे जा सकती है: इस कक्षा में क्या करें, इस भाषा में, और आपकी टाइमटेबल पर जो विषय सच में हैं उनके साथ।",
  "Nothing on this page is a promise about admission, marks, income or jobs. It describes a route people have taken, and it is sample data curated for this project rather than a verified survey.":
    "इस पेज पर कुछ भी दाखिले, नंबर, कमाई या नौकरी का वादा नहीं है। यह वह रास्ता बताता है जो लोग अपनाते आए हैं, और यह इस प्रोजेक्ट के लिए तैयार किया गया सैंपल डेटा है — किसी जाँच-पड़ताल का नतीजा नहीं।",

  // /blog — guide index
  "Things worth reading slowly": "धीरे पढ़ने लायक बातें",
  "The conversation in this app answers a question in a few sentences. These pages are for the questions that need a parent and a student to sit with the same document — how a stream choice works, what an interest test really measures, how to read an exam bulletin.":
    "इस ऐप की बातचीत एक सवाल का जवाब कुछ वाक्यों में दे देती है। ये पेज उन सवालों के लिए हैं जहाँ अभिभावक और विद्यार्थी को एक ही दस्तावेज़ पर साथ बैठना पड़ता है — स्ट्रीम का चुनाव कैसे काम करता है, इंटरेस्ट टेस्ट असल में क्या नापता है, और एग्ज़ाम का नोटिफ़िकेशन कैसे पढ़ें।",
  "Written by this project, not by a career counsellor. There is no expert on staff who has reviewed them, and nothing here states a fee, a cutoff, a deadline or a salary — those change every year and belong in an official document.":
    "ये इस प्रोजेक्ट ने लिखी हैं, किसी करियर काउंसलर ने नहीं। यहाँ कोई एक्सपर्ट नहीं है जिन्होंने इन्हें जाँचा हो, और न ही यहाँ कोई फ़ीस, कटऑफ, डेडलाइन या तनख्वाह बताई गई है — ये हर साल बदलते हैं और इन्हें आधिकारिक दस्तावेज़ में देखा जाना चाहिए।",
  "No guides published yet": "अभी कोई मार्गदर्शिका प्रकाशित नहीं हुई",
  "This page lists the guide files that exist in this deployment. There are none, so there is nothing to link to — the conversation is still available.":
    "इस पेज में इस इंस्टॉलेशन में मौजूद मार्गदर्शिका फ़ाइलों की लिस्ट होती है। यहाँ कोई फ़ाइल नहीं है, इसलिए लिंक करने को कुछ नहीं — बातचीत फिर भी उपलब्ध है।",
  "about {n} min read": "पढ़ने में लगभग {n} मिनट",
  "Have a question these pages do not cover": "कोई सवाल है जिसका जवाब इन पेजों में नहीं है",
  "The guide answers in Hindi, English or Hinglish, and does not need a name, a phone number or a school.":
    "गाइड हिन्दी, अंग्रेज़ी या हिंग्लिश में जवाब देता है, और उसके लिए नाम, फ़ोन नंबर या स्कूल बताने की ज़रूरत नहीं।",

  // /blog/[slug] — one guide
  "Updated {date}": "{date} को अपडेट हुई",
  "Published {date}": "{date} को प्रकाशित हुई",
  "Published by {site}": "{site} द्वारा प्रकाशित",
  "This is written guidance, not a verified source": "यह लिखा हुआ मार्गदर्शन है, जाँचा हुआ स्रोत नहीं",
  "Nothing here was checked by a career counsellor, and no fee, cutoff, seat count or deadline in this project should be trusted from a page like this one. For anything that costs money or decides a seat, open the document published by the body that conducts the exam or runs the course.":
    "यहाँ की किसी बात की जाँच करियर काउंसलर ने नहीं की है, और इस प्रोजेक्ट में कोई फ़ीस, कटऑफ, सीट की संख्या या डेडलाइन इस तरह के पेज पर भरोसा करके नहीं अपनानी चाहिए। जो चीज़ पैसे से या सीट से जुड़ी हो, उसके लिए वह दस्तावेज़ खोलें जो एग्ज़ाम कराने वाली या कोर्स चलाने वाली संस्था ने जारी किया हो।",
  "Ask the guide": "गाइड से पूछें",
  "Browse career profiles": "करियर प्रोफ़ाइलें देखें",
  "Read the disclaimer": "अस्वीकरण पढ़ें",
};
