/** Hindi for the practice interview. See ./index.ts for how these files merge.
 *
 * The keys below are not only this screen's own copy. `services/mock_interview.py` answers
 * in this app's own words whenever no model did — its five practice questions, its four
 * general tips, its closing line and its three "no AI answered" sentences — and a student
 * who is reading the interface in Hindi must not be handed English sentences and told an AI
 * wrote them. Those strings are keys here so they can be translated, and the screen looks
 * one of them up only when `demo_generated` says it came from this app rather than from a
 * model. A model's sentence is never sent through a dictionary.
 */
export const HI: Record<string, string> = {
  "Practice Interview": "इंटरव्यू की प्रैक्टिस",
  "Interview practice": "इंटरव्यू की प्रैक्टिस",
  "One friendly interviewer, five questions about you, and a few things to try next time. Pick a job and start when you are ready.":
    "एक दोस्ताना इंटरव्यूअर, आपके बारे में पाँच सवाल, और अगली बार आज़माने के लिए कुछ सुझाव। कोई जॉब चुनिए और तैयार होने पर शुरू कीजिए।",
  "Which job do you want to practise for?": "किस जॉब के लिए प्रैक्टिस करनी है?",
  "Choose a job…": "एक जॉब चुनिए…",
  "Something else — I will type it": "कुछ और — खुद लिखकर बताऊँगा",
  "The job, in your own words": "जॉब का नाम, जैसे आप कहेंगे",
  "Any job works — “cricket commentator”, “hotel manager”, “machine repair”.":
    "कोई भी जॉब चलेंगी — “क्रिकेट कमेंटेटर”, “होटल मैनेजर”, “मशीन रिपेयर”।",
  "What should the interviewer ask about?": "इंटरव्यूअर किस बारे में पूछे?",
  "Doctor": "डॉक्टर",
  Engineer: "इंजीनियर",
  Designer: "डिज़ाइनर",
  Teacher: "शिक्षक",
  Nurse: "नर्स",
  Lawyer: "वकील",
  Pilot: "पायलट",
  Chef: "शेफ",
  "Content creator": "कंटेंट क्रिएटर",
  "Data analyst": "डेटा एनालिस्ट",

  "Five questions, then a summary. You can stop any time by closing the tab.":
    "पाँच सवाल, फिर एक सारांश। टैब बंद करके आप कभी भी रुक सकते हैं।",
  "Nothing you say here is saved on our servers, or shown to a teacher or an employer.":
    "यहाँ आप जो कहते हैं वह हमारे सर्वर पर नहीं सहेजा जाता, और न ही किसी टीचर या नौकरी देने वाले को दिखाया जाता है।",
  "This is practice, not a test. No one is marking you.": "यह प्रैक्टिस है, परीक्षा नहीं। कोई आपको अंक नहीं दे रहा।",
  "Start Mock Interview": "मॉक इंटरव्यू शुरू करें",
  "Getting your first question…": "आपका पहला सवाल लाया जा रहा है…",
  "Type the job you want to practise for.": "जिस जॉब के लिए प्रैक्टिस करनी है, वह लिखिए।",
  "The interviewer could not answer.": "इंटरव्यूअर जवाब नहीं दे सका।",

  "Practising for {job}. Five questions, and nobody outside this tab reads the answers.":
    "{job} के लिए प्रैक्टिस हो रही है। पाँच सवाल, और इस टैब के बाहर कोई आपके जवाब नहीं पढ़ता।",
  "Closing…": "बंद हो रहा है…",
  "Interview complete": "इंटरव्यू पूरा हुआ",
  "Start over": "नए सिरे से शुरू करें",
  "This practice interview is closed, and nothing about these answers was scored.":
    "यह प्रैक्टिस इंटरव्यू यहीं बंद हुआ, और इन जवाबों पर कोई अंक नहीं लगाए गए।",
  Feedback: "सुझाव",
  "The interviewer is thinking…": "इंटरव्यूअर सोच रहा है…",
  "Your answer to the interviewer": "इंटरव्यूअर के लिए आपका जवाब",
  "Send your answer": "अपना जवाब भेजें",
  "Take your time. A short answer is fine — say what you would try first, and that counts.":
    "जल्दबाज़ी न कीजिए। छोटा जवाब भी चलेगा — कह दीजिए कि आप सबसे पहले क्या आज़माएँगे, यही भी काफ़ी है।",

  "out of 100": "सौ में से",
  "for these five answers only": "सिर्फ़ इन पाँच जवाबों के लिए",
  "No score this time": "इस बार कोई अंक नहीं",
  "Nobody read your answers, so there is no number and no judgement of them.":
    "आपके जवाब किसी ने पढ़े नहीं हैं, इसलिए कोई नंबर भी नहीं है और न ही इन पर कोई राय।",
  "The interviewer did not send a score for these answers, so nothing is shown.":
    "इंटरव्यूअर ने इन जवाबों के लिए कोई अंक भेजे नहीं, इसलिए कुछ भी दिखाया नहीं गया।",
  "This is one AI's opinion about five answers in one practice sitting. It is not a mark, it is not a measurement of you, and no college or employer ever sees it.":
    "यह एक AI की राय है — एक ही प्रैक्टिस बैठक में दिए पाँच जवाबों के बारे में। यह नंबर नहीं है, आपकी कोई नाप नहीं है, और कोई कॉलेज या नौकरी देने वाला इसे कभी नहीं देखता।",
  "General tips for any interview": "किसी भी इंटरव्यू के लिए सामान्य सुझाव",
  "Tips to improve": "सुधार के सुझाव",
  "These lines are the same for every student, because nobody read yours.":
    "यह बातें हर विद्यार्थी के लिए वही हैं, क्योंकि आपके जवाब किसी ने पढ़े नहीं।",
  "Do another one": "एक और लीजिए",
  "Back to the dashboard": "वापस डैशबोर्ड पर",

  // -------------------------------------------------- this app's own interview words
  "No AI provider is configured on this deployment, so this is a question list rather than an interview. Nobody is reading your answers, so there is no feedback and no score.":
    "यहाँ कोई AI सेटअप नहीं किया गया है, इसलिए यह इंटरव्यू नहीं, सिर्फ़ सवालों की सूची है। आपके जवाब कोई नहीं पढ़ रहा, इसलिए न सुझाव है न अंक।",
  "The AI provider could not be reached, so these are this app's own practice questions. Nobody has read your answers, so there is no feedback and no score.":
    "AI से बात नहीं हो सकी, इसलिए यह इस ऐप के अपने प्रैक्टिस सवाल हैं। आपके जवाब किसी ने पढ़े नहीं, इसलिए न सुझाव है न अंक।",
  "The AI provider did not return a usable reply, so these are this app's own practice questions. Nobody has read your answers, so there is no feedback and no score.":
    "AI ने ऐसा जवाब दिया जो इस्तेमाल लायक नहीं था, इसलिए यह इस ऐप के अपने प्रैक्टिस सवाल हैं। आपके जवाब किसी ने पढ़े नहीं, इसलिए न सुझाव है न अंक।",
  "That is five answers — enough for one sitting. Nothing above was judged, because no model read them.":
    "पाँच जवाब पूरे — एक बैठक के लिए काफ़ी है। ऊपर लिखे एक भी जवाब को परखा नहीं गया, क्योंकि उन्हें किसी मॉडल ने पढ़ा नहीं।",
  "Tell me about yourself — what do you enjoy doing, at school or outside it?":
    "अपने बारे में बताइए — स्कूल में या स्कूल के बाहर आपको क्या करना पसंद है?",
  "Describe one project or assignment you worked on, and what your own part in it was.":
    "किसी एक प्रोजेक्ट या असाइनमेंट के बारे में बताइए जिस पर आपने काम किया, और उसमें आपका अपना हिस्सा क्या था।",
  "Tell me about a time something did not go as planned. What did you do next?":
    "ऐसा कोई मौका बताइए जब कुछ योजना के मुताबिक न चला। फिर आपने क्या किया?",
  "What is one thing you taught yourself, and how did you go about learning it?":
    "वह कौन सी एक चीज़ है जो आपने खुद सिखी, और कैसे सिखी?",
  "Why does this work interest you, and what would you like to be doing a year from now?":
    "यह काम आपको क्यों दिलचस्प लगता है, और एक साल बाद आप क्या कर रहे होना चाहेंगे?",
  "Give one real example for every answer — a specific thing you did beats a general quality.":
    "हर जवाब में एक असली उदाहरण दीजिए — कोई खास चीज़ जो आपने की, आम सी बात से बेहतर है।",
  "Say what your own part was, not only what the group did.":
    "बताइए आपका अपना हिस्सा क्या था, सिर्फ़ यह नहीं कि पूरे ग्रुप ने क्या किया।",
  "If you do not know, say so and then say what you would try first.":
    "अगर पता नहीं है तो वही कहिए, और फिर बताइए कि आप सबसे पहले क्या आज़माएँगे।",
  "Keep an answer to about a minute: one point, one example, what happened.":
    "जवाब करीब एक मिनट का रखिए — एक बात, एक उदाहरण, और आगे क्या हुआ।",

  // ---------------------------------------------------------- the dashboard entry point
  "Five questions about you for any job you pick, a short note after each answer, then a few things to try next time.":
    "जो जॉब चुनेंगे, उसके बारे में आपसे पाँच सवाल, हर जवाब के बाद एक छोटी सी टिप्पणी, फिर अगली बार आज़माने के लिए कुछ सुझाव।",
  "This tab holds the conversation and the server keeps nothing of it. With no AI configured you get this app's own questions, and no score.":
    "बातचीत इस टैब में रहती है, सर्वर पर इसका कुछ नहीं सहेजा जाता। जब AI सेटअप नहीं होता तो इस ऐप के अपने सवाल मिलते हैं, और कोई अंक नहीं।",
  "Start practising": "प्रैक्टिस शुरू करें",
};
