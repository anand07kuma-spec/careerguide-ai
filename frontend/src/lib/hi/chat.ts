/**
 * Hindi for the typed conversation: the chat screen, the microphone notices it
 * shows, and the speech errors reported by the browser's own recognition.
 *
 * Keys are the English source text. The three captions the conversation attaches
 * to a saved profile fact live here too, because the fact labels in the store
 * stay English and only the caption around them is interface text.
 */
export const HI: Record<string, string> = {
  // Screen headings and the empty thread
  "Chat with your guide": "अपने गाइड से चैट करें",
  "Type, speak, or do both. There is no wrong answer, and you can stop any time.":
    "टाइप करें, बोलें, या दोनों करें। यहाँ कोई जवाब ग़लत नहीं होता, और आप कभी भी रुक सकते हैं।",
  "Opening your conversation…": "आपकी बातचीत खुल रही है…",
  "No messages yet": "अभी कोई संदेश नहीं",
  "Ask anything — “What does an engineer actually do all day?”, “I like drawing but my family wants medicine”, or just tell the guide what you enjoy doing.":
    "कुछ भी पूछिए — “इंजीनियर दिनभर असल में क्या करता है?”, “मुझे ड्राइंग पसंद है पर मेरा परिवार मेडिसिन चाहता है”, या बस गाइड को बताइए कि आपको क्या करना पसंद है।",
  "Your guide is thinking…": "आपका गाइड सोच रहा है…",
  "Demo guide answer": "डेमो गाइड का जवाब",
  "Saved: {fact}": "सहेजा गया: {fact}",

  // What the guide says about its own progress
  "Guide is at step {step} of {total} — it simply asks a few friendly questions.":
    "गाइड {total} में से {step} वें चरण पर है — यह बस कुछ दोस्ताना सवाल पूछता है।",
  "Age group": "उम्र का समूह",
  "Where you study": "आप कहाँ पढ़ते हैं",
  "Cost preference": "पढ़ाई के खर्च की पसंद",

  // The chat could not open, or could not answer
  "The chat could not start": "चैट शुरू नहीं हो सकी",
  "Could not open the conversation.": "बातचीत नहीं खुल सकी।",
  "The guide could not answer just now.": "गाइड अभी जवाब नहीं दे सका।",
  "Could not start a new chat.": "नई चैट शुरू नहीं हो सकी।",
  "The previous chat may still be listed as open on the Journey page.":
    "हो सकता है पिछली चैट यात्रा पेज पर अभी खुली ही दिखे।",
  "Conversation closed. Your progress is on the Journey page.":
    "बातचीत बंद कर दी गई। आपकी प्रगति यात्रा पेज पर है।",
  "Could not close the conversation.": "बातचीत बंद नहीं हो सकी।",
  "Earlier messages were deleted from the server.": "पहले के संदेश सर्वर से मिटा दिए गए।",
  "Messages deleted.": "संदेश मिटा दिए गए।",
  "Could not delete the messages.": "संदेश मिटाए नहीं जा सके।",
  "The server at {api} is not answering.": "{api} पर सर्वर जवाब नहीं दे रहा।",
  "In the backend folder run": "backend फ़ोल्ड में यह चलाएँ",
  ", then press Try again.": ", और फिर कोशिश करें बटन दबाएँ।",
  "We are having trouble connecting to our servers. Please try again later.":
    "हमारे सर्वर्स से जुड़ने में दिक्कत आ रही है। कृपया कुछ देर बाद फिर कोशिश करें।",
  "New chat": "नई चैट",
  End: "बंद करें",
  "Delete these messages": "ये संदेश मिटाएँ",

  // The safety card the guide can raise
  "Your safety comes first": "आपकी सुरक्षा सबसे पहले है",
  "If someone is hurting you or you feel unsafe at home, please tell a trusted adult right away — a parent, relative, teacher or school counsellor.":
    "अगर कोई आपको नुक़सान पहुँचा रहा है या घर में आपको सुरक्षित नहीं लग रहा, तो तुरंत किसी भरोसेमंद बड़े को बताइए — माता-पिता, रिश्तेदार, टीचर या स्कूल के काउंसलर।",
  "In India you can also call": "भारत में आप यह भी कॉल कर सकते हैं",
  "Childline 1098": "चाइल्डलाइन 1098",
  ", free, any time, day or night. Career talk can wait.":
    " — मुफ़्त, दिन या रात कभी भी। करियर की बात रुक सकती है।",
  "I have read this": "मैंने यह पढ़ लिया है",

  // The composer. The shortcut is spelled below the box, not in its placeholder: in Hindi
  // the old one-line sentence is three lines tall and the box it sat in is one line.
  "Type your answer…": "अपना जवाब लिखें…",
  "Enter sends your message. Shift+Enter starts a new line.":
    "Enter दबाने से आपका संदेश भेजा जाता है। Shift+Enter से नई लाइन शुरू होती है।",
  "Enter sends your answer. Shift+Enter starts a new line.":
    "Enter दबाने से आपका जवाब भेजा जाता है। Shift+Enter से नई लाइन शुरू होती है।",
  "Message to your guide": "अपने गाइड के लिए संदेश",
  "Send your message": "अपना संदेश भेजें",
  "Send (Enter)": "भेजें (Enter)",

  // Reading replies aloud
  "Read replies aloud": "जवाब बोलकर सुनाएँ",
  "How does the voice work?": "आवाज़ कैसे काम करती है?",
  "Hide this": "यह छिपाएँ",
  "The server's speech service reads replies aloud over the internet, with your browser's own voice as a fallback. Settings names the exact service.":
    "सर्वर की स्पीच सेवा इंटरनेट पर जवाब बोलकर सुनाती है, और वह न चले तो आपका ब्राउज़र अपनी आवाज़ देता है। सेटिंग्स में सेवा का ठीक नाम बताया गया है।",
  "Pause voice": "आवाज़ रोकें",
  "Play voice": "आवाज़ चलाएँ",
  "Stop voice": "आवाज़ बंद करें",
  "{failed} Your browser's own voice is reading this reply.":
    "{failed} — यह जवाब आपके ब्राउज़र की अपनी आवाज़ में पढ़ा जा रहा है।",

  // Dictation with the microphone
  "Stop dictating": "बोलना रोकें",
  "Speak your answer": "जवाब बोलकर दें",
  "Stop listening": "सुनना बंद करें",
  "Speak instead of typing": "लिखने के बजाय बोलिए",
  "Speech input is not available in this browser": "इस ब्राउज़र में बोलकर इनपुट उपलब्ध नहीं है",
  "Still hearing: {words}": "अभी सुन रहे हैं: {words}",
  "Listening… your finished words appear in the box above.":
    "सुन रहा है… आपकी पूरी हुई बात ऊपर वाले बॉक्स में आ जाएगी।",

  // Why the microphone could not work, straight from the browser
  "This browser can't turn speech into text. You can still type your answer below, or open this page in Chrome or Edge.":
    "यह ब्राउज़र बोली को टेक्स्ट में नहीं बदल सकता। आप अपना जवाब नीचे टाइप कर सकते हैं, या यह पेज Chrome या Edge में खोलें।",
  "The microphone is blocked for this site. Allow it in your browser's address bar, then tap Try again — nothing is recorded until you do.":
    "इस साइट के लिए माइक ब्लॉक है। ब्राउज़र के एड्रैस बार में उसे अनुमति दें, फिर कोशिश करें पर टैप करें — देने तक कुछ रिकॉर्ड नहीं होता।",
  "No microphone was found. Plug one in or use another device, or keep going by typing.":
    "कोई माइक नहीं मिला। माइक लगाएँ या दूसरा डिवाइस इस्तेमाल करें, या टाइप करके जारी रखें।",
  "Speech recognition needs the internet and couldn't reach it. Type your answer instead, or try again in a moment.":
    "बोली पहचानने के लिए इंटरनेट चाहिए और वह मिला नहीं। आप अपना जवाब टाइप करें, या कुछ पल बाद फिर कोशिश करें।",
  "I couldn't hear anything. Tap Start talking and try once more.":
    "मुझे कुछ सुनाई नहीं दिया। बोलना शुरू करें दबाकर एक बार और कोशिश करें।",
  "Listening was stopped. Tap Start talking whenever you are ready.":
    "सुनना रोक दिया गया था। जब आप तैयार हों, बोलना शुरू करें दबाएँ।",
  "Something went wrong with the microphone. You can type your answer instead.":
    "माइक में कुछ गड़बड़ हो गई। आप उसके बजाय अपना जवाब टाइप कर सकते हैं।",
};
