/**
 * Hindi for the entry screen — the single question a device answers before it
 * gets a profile, the two consent boxes, and the plain-words list of what the
 * app keeps.
 *
 * Keys are the English source text, so a string with no entry here still renders
 * in English instead of blanking out. Sentences that name what is stored, what
 * is never stored, and what the guide does not promise are translated with every
 * qualifier kept: a shortened hedge here would be a claim the app cannot support.
 */
export const HI: Record<string, string> = {
  // The one question
  "One question before we start": "शुरू करने से पहले एक सवाल",
  "Who is using CareerGuide AI?": "CareerGuide AI कौन इस्तेमाल कर रहा है?",
  "Nothing else is asked here. No email, no password, nothing to verify. Your class, your interests and your family situation come out naturally while you talk with the guide, one at a time.":
    "यहाँ और कुछ नहीं पूछा जाता। न ईमेल, न पासवर्ड, कुछ जाँचने की ज़रूरत नहीं। आपकी कक्षा, आपकी रुचियाँ और आपके परिवार की बातें गाइड से बात करते-करते अपने आप सामने आ जाएँगी — एक-एक करके।",
  "I am a student": "मैं विद्यार्थी हूँ",
  "Talk to the guide, explore careers, and keep track of your own progress.":
    "गाइड से बात करें, करियर के बारे में जानें, और अपनी प्रगति ख़ुद देखते रहें।",
  "I am a parent or guardian": "मैं अभिभावक हूँ",
  "See what a child is exploring and get practical guidance for the family.":
    "देखें कि बच्चा क्या-क्या जान रहा है, और परिवार के लिए काम की सलाह पाएँ।",
  "A parent account sees only what a child has agreed to share. To link your own child, ask them for the":
    "अभिभावक का खाता केवल वही देखता है जो बच्चा साझा करने के लिए राज़ी हुआ हो। अपने बच्चे से जोड़ने के लिए उनसे",
  "sharing code": "साझाकरण कोड",
  "shown on their Settings page.": "माँगें, जो उनकी सेटिंग्स पेज पर दिखता है।",

  // Name field and the validation the screen can show
  "What should we call you? (optional)": "आपको क्या कहकर बुलाएँ? (ज़रूरी नहीं)",
  "A first name or nickname is enough. Leave it blank and we will simply say Student or Parent. Please don't use a surname, school or city.":
    "पहला नाम या डাক नाम काफ़ी है। खाली छोड़ दें तो हम बस विद्यार्थी या अभिभावक कहेंगे। कृपया उपनाम, स्कूल या शहर का नाम न लिखें।",
  "Please choose who is using the app.": "बताइए कि ऐप कौन इस्तेमाल कर रहा है।",
  "Both confirmations are needed before we can store a profile.":
    "प्रोफ़ाइल सहेजने से पहले दोनों मंज़ूरियाँ ज़रूरी हैं।",
  "Something went wrong while saving. Please try again.":
    "सहेजते समय कुछ गड़बड़ हो गई। कृपया फिर कोशिश करें।",

  // What the app keeps
  "What we store, in plain words": "सादे शब्दों में, हम क्या सहेजते हैं",
  "Your nickname and whether you are a student or a parent.":
    "आपका डাক नाम, और यह कि आप विद्यार्थी हैं या अभिभावक।",
  "What you write in the conversation, so the guide can continue where you left off.":
    "आप बातचीत में जो लिखते हैं, ताकि गाइड वहीं से जारी रख सके जहाँ आपने छोड़ा था।",
  "When the guide learns something like your class, it stores a short fixed note ({example}), not your exact sentence.":
    "जब गाइड आपकी कक्षा जैसी कोई बात जानता है, तो वह ({example}) जैसा छोटा तय नोट लिखता है — आपका पूरा वाक्य नहीं।",
  "Studies at a government school": "सरकारी स्कूल में पढ़ता है",
  "Nothing else. No email, phone number, photo, address, school name, or documents.":
    "इसके सिवा कुछ नहीं। न ईमेल, न फ़ोन नंबर, न फ़ोटो, न पता, न स्कूल का नाम, न कोई दस्तावेज़।",
  "Raw microphone audio is never saved. Speech-to-text happens in your browser.":
    "माइक का कच्चा ऑडियो कभी सहेजा नहीं जाता। बोली को टेक्स्ट बनाने का काम आपके ब्राउज़र में ही होता है।",
  "Voice is off to start with. Turn it on in Settings if you want calls.":
    "शुरू में आवाज़ बंद रहती है। कॉल चाहिए तो सेटिंग्स में जाकर चालू करें।",
  "You can switch history off, delete conversations, and leave at any time.":
    "आप कभी भी इतिहास बंद कर सकते हैं, बातचीत मिटा सकते हैं और चलते बन सकते हैं।",
  "We do not sell personal data, and no institution can pay to change a recommendation.":
    "हम निजी जानकारी बिकवाते नहीं, और कोई संस्थान पैसे देकर सलाह नहीं बदलवा सकता।",

  // The two confirmations
  "I allow this app to store this profile and what I tell it":
    "मुझे मंज़ूर है कि यह ऐप मेरी यह प्रोफ़ाइल और मैं इससे जो कहता हूँ, उसे सहेजे",
  "Required. Without it there is no progress to keep, and the guide cannot remember the conversation.":
    "ज़रूरी। इसके बिना प्रगति सहेजी नहीं जा सकती, और गाइड बातचीत याद नहीं रख पाएगा।",
  "A parent or guardian agrees for a user under 18": "18 साल से कम के उपयोगकर्ता के लिए अभिभावक की मंज़ूरी",
  "If the student is a minor, a grown-up who cares for them should be the one agreeing here.":
    "अगर विद्यार्थी नाबालिग है, तो यहाँ उसकी देखभाल करने वाला बड़ा व्यक्ति ही मंज़ूरी दे।",
  "The browser will ask for microphone permission only if you turn voice on and press the talk button.":
    "ब्राउज़र माइक की इजाज़त केवल तभी माँगता है, जब आप आवाज़ चालू करके बोलने का बटन दबाएँ।",

  // The honest note, and the two ways out of the screen
  "One honest thing before you begin": "शुरू करने से पहले एक सच्ची बात",
  "This guide explores careers with you. It does not predict results, does not guarantee admission, jobs or salary, and never says a child is suited or unsuited to a profession. Career information here is sample data until it has been checked against official sources, so always verify fees, exams and dates yourself.":
    "यह गाइड आपके साथ करियर जानने में मदद करता है। यह परिणाम का अनुमान नहीं लगाता, न दाखिले, नौकरी या तनख़्वाह का वादा करता है, और कभी नहीं कहता कि कोई बच्चा किसी पेशे के लिए बना है या नहीं। यहाँ की करियर जानकारी आधिकारिक स्रोतों से जाँचे जाने तक नमूना मात्र है, इसलिए फ़ीस, एग्ज़ाम और तारीख़ें ख़ुद ज़रूर जाँच लें।",
  "This is a prototype, so there is no login. Your progress is tied to this browser by a random id it keeps for itself. Coming back on the same phone or laptop resumes the same conversation. Clearing this site's data, using a private window, or switching device starts a fresh student — there is nothing to recover it with. Don't use a shared or public computer, and use Settings to start over when you are done.":
    "यह एक प्रोटोटाइप है, इसलिए इसमें लॉगिन नहीं है। आपकी प्रगति इसी ब्राउज़र से एक यादृच्छिक आईडी के ज़रिए जुड़ी है, जिसे ब्राउज़र ख़ुद सहेजता है। उसी फ़ोन या लैपटॉप पर लौटने पर वही बातचीत फिर मिलती है। इस साइट का डेटा मिटाने पर, निवी खिड़की खोलने पर या दूसरा डिवाइस इस्तेमाल करने पर एक नया विद्यार्थी शुरू होगा — उसे वापस लाने का कोई तरीक़ा नहीं है। साझा या सार्वजनिक कंप्यूटर पर यह ऐप इस्तेमाल न करें, और काम ख़त्म होने पर सेटिंग्स से दोबारा शुरू करें।",
  "No email, no password": "कोई ईमेल नहीं, कोई पासवर्ड नहीं",
  "Open the parent dashboard": "अभिभावक डैशबोर्ड खोलें",
  "Start talking with the guide": "गाइड से बात शुरू करें",
  Prototype: "प्रोटोटाइप",
};
