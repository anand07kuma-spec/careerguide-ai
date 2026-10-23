/**
 * Hindi for the AI voice-call screen: the state captions, the control labels,
 * the microphone and safety notices, and the honest notes about what the
 * microphone and the speech service actually do.
 *
 * Keys are the English source text so a missing entry falls back to English
 * instead of blanking out a label. Technical loanwords the app already uses,
 * such as AI, कॉल, माइक and ब्राउज़र, are kept as-is.
 */
export const HI: Record<string, string> = {
  // State captions: the words shown under the avatar
  "Ready to call": "कॉल के लिए तैयार",
  "The microphone stays off until you press the button.":
    "आप बटन न दबाएँ, तब तक माइक बंद रहेगा।",
  "Connecting…": "जुड़ रहा है…",
  "Opening your conversation and waking the guide.":
    "आपकी बातचीत खुल रही है और गाइड जाग रहा है।",
  "Guide is talking": "गाइड बोल रहा है",
  "Press Interrupt any time you want to answer.":
    "जब भी आप जवाब देना चाहें, गाइड को बीच में रोक सकते हैं।",
  "Listening — speak now": "सुन रहा है — अब बोलिए",
  "Nothing is sent until you finish your sentence.":
    "जब तक आप अपना वाक्य पूरा नहीं करते, कुछ भी नहीं भेजा जाता।",
  "Thinking…": "सोच रहा है…",
  "Sending your words to the guide.": "आपके शब्द गाइड तक भेजे जा रहे हैं।",
  "Guide is answering": "गाइड जवाब दे रहा है",
  "Interrupt to speak over the guide whenever you like.":
    "जब मन चाहे गाइड को रोककर उसके ऊपर बोल सकते हैं।",
  "Voice paused": "आवाज़ रुकी हुई है",
  "Press Play to hear the rest, or Talk to answer now.":
    "बाकी बात सुनने के लिए आगे बढ़ाएँ, या अभी जवाब देने के लिए बोलिए।",
  "Didn't catch that": "यह सुनाई नहीं दिया",
  "Tap Talk and say it again — or type your answer.":
    "बोलने का बटन दबाकर दोबारा कहें — या अपना जवाब टाइप करें।",
  "Microphone not available": "माइक उपलब्ध नहीं है",
  "You can still use this guide by typing.":
    "आप टाइप करके इस गाइड का इस्तेमाल फिर भी कर सकते हैं।",
  "Call ended": "कॉल खत्म हुई",
  "Everything you said is on your Journey page.":
    "आपने जो कुछ कहा, वह आपकी Journey पेज पर है।",

  // The big button in the middle
  "Call again": "फिर से कॉल करें",
  "Start the call": "कॉल शुरू करें",
  "Interrupt and talk": "रोकें और बोलिए",
  "Done talking": "बोलना पूरा हुआ",
  "Talk now": "अब बोलिए",
  "Try the microphone again": "माइक फिर से आज़माएँ",
  Talk: "बोलिए",

  // Header toggles
  "Voice off": "आवाज़ बंद",
  "Voice on": "आवाज़ चालू",
  Captions: "सबटाइटल",

  // Microphone permission and errors
  "Voice is switched off for this account": "इस खाते के लिए आवाज़ बंद कर दी गई है",
  "Calling needs your permission to use the microphone. Turn it on in Settings — you can turn it off again any time, and typing works everywhere.":
    "कॉल के लिए आपको माइक इस्तेमाल करने की अनुमति देनी होगी। इसे Settings में चालू करें — आप इसे कभी भी फिर से बंद कर सकते हैं, और टाइप करना हर जगह चलता है।",
  "Open Settings": "Settings खोलें",

  // Safety notice
  // "Your safety comes first" is translated once, in chat.ts — the two screens
  // raise the same card and must not carry two different captions for it.
  "Please tell a trusted adult right away — a parent, relative, teacher or school counsellor.":
    "कृपया तुरंत किसी भरोसेमंद बड़े को बताएँ — माता-पिता, रिश्तेदार, टीचर या स्कूल का काउंसलर।",
  "In India you can call a free helpline any time:":
    "भारत में आप किसी भी समय एक मुफ़्त हेल्पलाइन पर कॉल कर सकते हैं:",
  "I have read this": "मैंने यह पढ़ लिया है",

  // Server not reachable
  "The CareerGuide server at {api} is not reachable.":
    "CareerGuide सर्वर {api} पर नहीं मिल रहा।",
  "Start it with this command:": "इस कमांड से सर्वर शुरू करें:",
  "Then try again.": "फिर दोबारा कोशिश करें।",
  "The CareerGuide server is not reachable just now. Your call was not recorded. Try again in a moment, or switch to text.":
    "CareerGuide सर्वर अभी नहीं मिल रहा। आपकी कॉल रिकॉर्ड नहीं हुई। कुछ देर में फिर कोशिश करें, या टाइप करके बात करने वाले तरीके पर जाएँ।",

  // Caption list
  "Captions appear here as you speak, so you can always follow along in text.":
    "जैसे-जैसे आप बोलेंगे, सबटाइटल यहाँ दिखेंगे, ताकि आप सब कुछ टेक्स्ट में भी पढ़ सकें।",
  "Demo guide": "डेमो गाइड",

  // Playback and call controls
  "Resume the voice": "आवाज़ फिर से चालू करें",
  "Pause the voice": "आवाज़ रोकें",
  "End the call": "कॉल खत्म करें",
  "Say that again": "वह दोबारा बोलें",
  "Stop voice": "आवाज़ बंद करें",
  "Chat by typing instead": "बजाय इसके, टाइप करके चैट करें",

  // Typed answer box
  "Or type your answer here…": "या अपना जवाब यहाँ टाइप करें…",
  "Type your answer": "अपना जवाब टाइप करें",
  "Send your message": "अपना संदेश भेजें",

  // Notices the guide shows after a failed turn
  "The guide's voice service did not answer.": "गाइड की आवाज़ वाली सर्विस ने जवाब नहीं दिया।",
  "Your browser's own voice is reading this one.":
    "यह जवाब आपके ब्राउज़र की अपनी आवाज़ में सुनाया जा रहा है।",
  "Spoken replies are off right now; captions still work.":
    "अभी बोले जाने वाले जवाब बंद हैं; सबटाइटल चलते रहेंगे।",
  "Using your browser's voice instead.": "इसके बजाय आपके ब्राउज़र की आवाज़ इस्तेमाल की जा रही है।",
  "The guide could not hear that. Try again, or type your answer.":
    "गाइड वह सुन नहीं पाया। फिर कोशिश करें, या अपना जवाब टाइप करें।",
  "The call could not start.": "कॉल शुरू नहीं हो सकी।",

  // Honest note about what the microphone and speech service do
  "The microphone only records while the call screen is listening — never in the background, and raw audio is not stored. Speech recognition is your browser's, spoken replies come from the server's speech service over the internet (Settings names which one), and this is not full-duplex streaming: one voice speaks at a time.":
    "माइक तभी रिकॉर्ड करता है जब कॉल वाली स्क्रीन सुन रही हो — कभी बैकग्राउंड में नहीं, और कच्चा ऑडियो स्टोर नहीं किया जाता। आवाज़ पहचानना आपके ब्राउज़र का काम है, और बोले जाने वाले जवाब इंटरनेट के ज़रिए सर्वर की स्पीच सर्विस से आते हैं (कौन सी सर्विस है, यह Settings में बताया है), और यह एक साथ दोनों तरह बहने वाली स्ट्रीमिंग नहीं है — एक वक़्त में एक ही आवाज़ बोलती है।",
};
