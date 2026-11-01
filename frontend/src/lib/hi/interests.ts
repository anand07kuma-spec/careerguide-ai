/**
 * Hindi for the interests screen: gentle questions, early signals, and the
 * student's own interest chips. Server-written prompts, blurbs and evidence
 * stay in the language the backend chose.
 */

export const HI: Record<string, string> = {
  // Screen + badge
  "Let's find out what you enjoy. No marks. No labels. Just questions.": "चलो जानते हैं आपको क्या अच्छा लगता है। न नंबर, न लेबल — बस सवाल।",
  "Gentle questions about what you enjoy. Answers become small, early signals — never a fixed profile or a verdict.": "आपको क्या पसंद है, इस बारे में हल्के-फुल्के सवाल। जवाब छोटे शुरुआती संकेत बनते हैं — कोई पक्की प्रोफ़ाइल या फैसला नहीं।",
  "Early signals, not labels": "शुरुआती संकेत, लेबल नहीं",

  // Answer a question
  "Answer a question": "एक सवाल का जवाब दें",
  "Getting questions ready…": "सवाल तैयार हो रहे हैं…",
  "Reload questions": "सवाल फिर से लाएँ",
  "No questions available right now": "अभी कोई सवाल उपलब्ध नहीं है",
  "Check the backend is running, then reload this page.": "देख लें कि सर्वर चल रहा है, फिर यह पेज दोबारा खोलें।",
  "Q{n}": "सवाल {n}",
  "That tells us you might enjoy…": "इससे लगता है कि आपको ये चीज़ें अच्छी लग सकती हैं…",
  "That tells us you might enjoy areas like these — it is a possibility, not a prediction:": "इससे लगता है कि आपको इन क्षेत्रों में मज़ा आ सकता है — यह एक संभावना है, भविष्यवाणी नहीं:",
  "Next question": "अगला सवाल",
  "Back to the start": "शुरुआत पर वापस",
  "Change my answer": "जवाब बदलें",
  "Your answer": "आपका जवाब",
  "Type here. English, Hindi or Hinglish — anything you like.": "यहाँ लिखें। अंग्रेज़ी, हिंदी या हिंग्लिश — जो मन करे।",
  "Answer in English, Hindi or Hinglish — whatever feels natural. There is no right or wrong answer.": "अंग्रेज़ी, हिंदी या हिंग्लिश में जवाब दें — जो सहज लगे। कोई सही या गलत जवाब नहीं है।",
  "Also save to my last conversation": "मेरी पिछली बातचीत में भी सेव करें",
  "Adds this answer to conversation #{id} so your guide can use it.": "यह जवाब बातचीत #{id} में जोड़ देता है, ताकि आपका गाइड इसका इस्तेमाल कर सके।",
  "Save my answer": "जवाब सेव करें",
  "Skip this one": "यह छोड़ दें",

  // What we've noticed
  "What we've noticed so far": "अब तक हमने क्या देखा",
  "Small signals from your chats. They are not a fixed profile. You can always change your mind.": "आपकी बातचीत से छोटे संकेत। ये कोई पक्की प्रोफ़ाइल नहीं हैं। आप कभी भी मन बदल सकते हैं।",
  "These are small, early observations pulled from things you chose to share. They are not a fixed profile, a personality type, or an ability judgement — interests move around a lot.": "ये छोटे शुरुआती अवलोकन हैं, जो आपने खुद साझा की बातों से लिए गए हैं। ये कोई पक्की प्रोफ़ाइल, स्वभाव का प्रकार या काबिलियत का फैसला नहीं हैं — रुचियाँ बदलती रहती हैं।",
  "Looking through your signals…": "आपके संकेत देखे जा रहे हैं…",
  "We couldn't load your observations": "आपके अवलोकन नहीं लाए जा सके",
  "No signals yet": "अभी कोई संकेत नहीं",
  "Answer one of the questions above, or have a chat with your guide, and small observations will start appearing here.": "ऊपर दिए किसी सवाल का जवाब दें, या अपने गाइड से बात करें — छोटे अवलोकन यहाँ दिखने लगेंगे।",
  "Noticed through {source}": "{source} से देखा गया",
  "a chat with your guide": "गाइड के साथ बातचीत",
  "an interest question you answered": "रुचि का एक सवाल, जिसका आपने जवाब दिया",

  // Interest summary
  "Interest summary": "रुचियों का सार",
  "We couldn't load your summary": "आपका सार नहीं लाया जा सका",
  "Nothing to summarise yet": "अभी सार बनाने के लिए कुछ नहीं",
  "That's okay! Answer a question or two above and themes will show up here.": "कोई बात नहीं! ऊपर एक-दो सवालों के जवाब दें, यहाँ थीम दिखने लगेंगी।",
  "That is a perfectly fine place to start. Answer a few prompts above or have one conversation, and themes will appear here as possibilities to explore.": "शुरुआत के लिए यह बिल्कुल ठीक है। ऊपर कुछ सवालों के जवाब दें या एक बातचीत करें — थीम यहाँ संभावनाओं के रूप में दिखेंगी, जिन्हें आप आज़मा सकते हैं।",

  // Your own interests
  "Your own interests": "आपकी अपनी रुचियाँ",
  "Tap what you like. Change your mind any time.": "जो पसंद हो उसे चुनें। मन कभी भी बदल सकते हैं।",
  "Pick anything that feels like you. This list is yours — add or remove items any time, nothing here is permanent.": "जो आपका सा लगे वह चुनें। यह सूची आपकी है — कभी भी कुछ जोड़ें या हटाएँ, यहाँ कुछ भी पक्का नहीं है।",
  "Saving…": "सेव हो रहा है…",
  "{n} selected": "{n} चुने गए",

  // Interest chips not yet covered by other dictionaries
  "Designing how things look": "चीज़ों का लुक डिज़ाइन करना",
  "Maps, travel and places": "नक्शे, यात्रा और जगहें",
  "Cooking and food": "खाना बनाना और खाने की चीज़ें",
  "Machines and vehicles": "मशीनें और गाड़ियाँ",
  "History and society": "इतिहास और समाज",
  "New technologies": "नई तकनीकें",
};