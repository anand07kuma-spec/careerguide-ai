/**
 * Hindi for the four student browse screens: the interest questionnaire
 * (interests), the institutes directory, the scholarships & financial-guidance
 * list, and the free resources library — their titles, filters and states.
 *
 * Keys are the English source text, so an untranslated string still renders — in
 * English — instead of vanishing from a child's screen.
 */

export const HI: Record<string, string> = {
  // Institutes & Courses — the sample directory and its sponsored-listing honesty.
  "A sample directory of places to look into. Listings are not verified or ranked, and some are sponsored partnerships — compare every institute yourself.":
    "देखने लायक संस्थानों की एक नमूना डायरेक्टरी। इन लिस्टिंग्स की जाँच या रैंकिंग नहीं की गई है, और कुछ प्रायोजित साझेदारियाँ हैं — हर संस्थान की तुलना ख़ुद करें।",
  "About these listings": "इन लिस्टिंग्स के बारे में",
  "Some entries below are sponsored partnerships. A sponsored badge is always shown, and the order here is not a ranking.":
    "नीचे कुछ एंट्रीज़ प्रायोजित साझेदारियाँ हैं। प्रायोजित होने का बैज हमेशा दिखाई देता है, और यहाँ का क्रम कोई रैंकिंग नहीं है।",
  "Search institutes": "संस्थान खोजें",
  "Filter by career area": "करियर क्षेत्र से चुनें",
  "Try a different state, career area or type, or clear the filters to see the sample list.":
    "दूसरा राज्य, करियर क्षेत्र या टाइप चुनें, या फ़िल्टर हटाकर नमूना लिस्ट देखें।",
  "The institute directory is empty right now. Please check back soon.":
    "संस्थानों की डायरेक्टरी अभी ख़ाली है। कुछ देर बाद फिर देखें।",
  // `PillGroup` and `Select` run every option label through `t`, so the mode chips need keys.
  // The code value is `offline`, but the screen deliberately says "In person" — same word here.
  "In person": "आमने-सामने",
  "Questions to ask any institute before you join": "जॉइन करने से पहले हर संस्थान से पूछने वाले सवाल",
  "Take these to the admission office or a current student. The answers matter more than any brochure.":
    "ये सवाल एडमिशन ऑफ़िस या वहाँ पढ़ रहे किसी छात्र से पूछें। इनके जवाब किसी भी ब्रोशर से ज़्यादा मायने रखते हैं।",

  // Discover My Interests — friendly questions; answers become small signals, never a profile or a score.
  "Gentle questions about what you enjoy. Answers become small, early signals — never a fixed profile or a verdict.":
    "आपको क्या पसंद है, इस पर आसान सवाल। इनके जवाब छोटे-छोटे शुरुआती संकेत बनते हैं — कोई पक्की प्रोफ़ाइल या फ़ैसला कभी नहीं।",
  "Answer a question": "एक सवाल का जवाब दें",
  "Getting questions ready…": "सवाल तैयार हो रहे हैं…",
  "Reload questions": "सवाल फिर से लोड करें",
  "No questions available right now": "अभी कोई सवाल उपलब्ध नहीं है",
  "Check the backend is running, then reload this page.": "पहले देखें कि बैकएंड चल रहा है, फिर यह पेज दोबारा लोड करें।",
  "Your answer": "आपका जवाब",
  // `Textarea` translates a string `placeholder` itself; the older screen gets this sentence.
  "Answer in English, Hindi or Hinglish — whatever feels natural. There is no right or wrong answer.":
    "जवाब अंग्रेज़ी, हिन्दी या हिंग्लिश में दें — जैसे आपको सहज लगे। कोई जवाब सही या ग़लत नहीं होता।",
  "Also save to my last conversation": "मेरी आख़िरी बातचीत में भी सेव करें",
  "What we've noticed so far": "अब तक हमने जो देखा",
  // The class 6-8 screen and the older one describe the same panel in two strengths; both
  // say "not a fixed profile", so neither Hindi version says anything more.
  "Small signals from your chats. They are not a fixed profile. You can always change your mind.":
    "आपकी बातचीत के छोटे-छोटे संकेत। यह पक्की प्रोफ़ाइल नहीं है। आप अपना मन कभी भी बदल सकते हैं।",
  "These are small, early observations pulled from things you chose to share. They are not a fixed profile, a personality type, or an ability judgement — interests move around a lot.":
    "ये छोटी-छोटी देखी गई बातें उन चीज़ों से ली गईं जो आपने बताना चुना। यह पक्की प्रोफ़ाइल नहीं, कोई पर्सनालिटी टाइप नहीं, और न ही इस बात का फ़ैसला कि आप कितने होशियार हैं — रुचियाँ बहुत घूमती-फिरती रहती हैं।",
  "Looking through your signals…": "आपके संकेत देखे जा रहे हैं…",
  "We couldn't load your observations": "आपकी देखी गई बातें नहीं खुल सकीं",
  "No signals yet": "अभी कोई संकेत नहीं",
  "Answer one of the questions above, or have a chat with your guide, and small observations will start appearing here.":
    "ऊपर दिए किसी एक सवाल का जवाब दें, या अपने गाइड से बात करें — यहाँ छोटी-छोटी देखी गई बातें आने लगेंगी।",
  "Interest summary": "रुचि का सारांश",
  "We couldn't load your summary": "आपका सारांश नहीं खुल सका",
  "Nothing to summarise yet": "अभी सारांश के लिए कुछ नहीं है",
  "That's okay! Answer a question or two above and themes will show up here.":
    "कोई बात नहीं! ऊपर एक-दो सवालों के जवाब दें, विषय यहाँ दिखने लगेंगे।",
  "That is a perfectly fine place to start. Answer a few prompts above or have one conversation, and themes will appear here as possibilities to explore.":
    "यह शुरू करने के लिए बिल्कुल ठीक जगह है। ऊपर कुछ सवालों के जवाब दें या एक बार बातचीत करें, और यहाँ विषय देखने लायक संभावनाओं की तरह दिखने लगेंगे।",
  "Your own interests": "आपकी ख़ुद की रुचियाँ",
  "Tap what you like. Change your mind any time.": "जो पसंद आए उसे चुनें। मन कभी भी बदल सकते हैं।",
  "Pick anything that feels like you. This list is yours — add or remove items any time, nothing here is permanent.":
    "जो कुछ आपके जैसा लगे वह चुनें। यह लिस्ट आपकी है — कभी भी कुछ जोड़ या हटा सकते हैं, यहाँ कुछ भी पक्का नहीं है।",

  // Free Learning Resources — starting points to explore, not a ranked or complete list.
  // The younger reader's sentence and the older one both keep "not homework or a test" /
  // "not a ranked or complete list" — the hedge is the point of the line.
  "Hand-picked free things to try — videos, activities and sites. They are starting points for exploring, not homework or a test.":
    "सोच-समझकर चुनी हुई मुफ़्त चीज़ें आज़माने के लिए — वीडियो, एक्टिविटी और साइट्स। ये देखने की शुरुआत हैं, होमवर्क या टेस्ट नहीं।",
  "Publicly available resources to explore careers and skills for free. These are starting points to look into, not a ranked or complete list.":
    "करियर और स्किल मुफ़्त में देखने के लिए सबको खुले संसाधन। ये देखने की शुरुआत हैं, न रैंक की गई हैं और न पूरी।",
  "Free Learning Resources": "मुफ़्त सीखने के संसाधन",
  "Search resources, e.g. coding, pilot, Hindi": "संसाधन खोजें, जैसे कोडिंग, पायलट, हिन्दी",
  "Search resources": "संसाधन खोजें",
  "All categories": "सभी श्रेणियाँ",
  "Filter by category": "श्रेणी से चुनें",
  "Any language": "कोई भी भाषा",
  "Filter by language": "भाषा से चुनें",
  // `Select` runs its `hint` through `t`, so this line needs a key like any label.
  "Most resources are in English; Hindi content is still limited.":
    "ज़्यादातर संसाधन अंग्रेज़ी में हैं; हिन्दी में सामग्री अभी कम है।",
  "Try a different search term, or clear the filters to see the full sample list.":
    "दूसरा शब्द लिखकर देखें, या फ़िल्टर हटाकर पूरी नमूना लिस्ट देखें।",
  "The resource library is empty right now. Please check back soon.":
    "संसाधनों की लाइब्रेरी अभी ख़ाली है। कुछ देर बाद फिर देखें।",

  // Scholarships & Financial Guidance — leads to confirm on the official portal, never a promise of money.
  "Scholarships & Financial Guidance": "स्कॉलरशिप और पैसों की सलाह",
  "A starting point for finding help with study costs. This is a sample list, not a complete or live one — every scheme must be confirmed on its official portal.":
    "पढ़ाई के खर्च में मदद ढूंढने की एक शुरुआती सूची। यह न पूरी है न लाइव — सिर्फ़ एक नमूना है, इसलिए हर योजना की पुष्टि उसके आधिकारिक पोर्टल से ज़रूर कर लें।",
  "How to check a scheme is real": "कैसे जांचें कि कोई योजना असली है",
  "Before trusting any scholarship, do these three things.": "किसी भी स्कॉलरशिप पर भरोसा करने से पहले ये तीन काम करें।",
  "Search schemes": "योजना खोजें",
  "Search scholarships": "स्कॉलरशिप खोजें",
  "Filter by class level": "कक्षा के स्तर से चुनें",
  "Filter by provider type": "प्रदाता के प्रकार से चुनें",
  "Try widening the class level, state or provider filters, or clear them to see the sample list.":
    "कक्षा के स्तर, राज्य या प्रदाता का फ़िल्टर थोड़ा चौड़ा करें, या फ़िल्टर हटाकर नमूना लिस्ट देखें।",
  "The scholarship list is empty right now. Please check back soon.":
    "स्कॉलरशिप की लिस्ट अभी ख़ाली है। कुछ देर बाद फिर देखें।",
  "Money shapes which route is possible. It never measures how much you are worth.":
    "पैसे तय करते हैं कि कौन-सा रास्ता मुमकिन है। पर वो कभी नहीं नापते कि आप कितने मायने रखते हैं।",

  // "Filter by state" heads both the institutes and scholarships screens; common.ts words
  // every "Filter by …" control as "… से चुनें", so this follows the same pattern.
  "Filter by state": "राज्य से चुनें",
};
