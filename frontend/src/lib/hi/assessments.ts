/**
 * Hindi for the three questionnaires: the list, the runner, the result, and the
 * four assessment components.
 *
 * The questions themselves are never here — their wording comes from the server in
 * the language the sitting was started in, so a Hindi interface still shows the exact
 * sentence the student answered. Only the app's own labels are translated.
 */
export const HI: Record<string, string> = {
  // ------------------------------------------------------------------ the list
  Assessments: "आकलन (Assessments)",
  "Self-questionnaires, not diagnoses": "खुद पर छोटे प्रश्न-पत्र, किसी निदान के लिए नहीं",
  "Three short questionnaires about what you are drawn to, how you tend to work, and puzzles you enjoy. Each one takes six to ten minutes, nothing is timed, and every answer saves as you go.":
    "तीन छोटे प्रश्न-पत्र — आपको क्या अच्छा लगता है, आप काम कैसे करते हैं, और कौन-सी पहेलियाँ जँचती हैं। हर एक में छह से दस मिनट लगते हैं, कोई समय सीमा नहीं है, और हर जवाब तुरंत सेव हो जाता है।",
  "These questions were written for this app, in house. They are self-questionnaires in the RIASEC and Big Five traditions, not licensed clinical instruments, and they are not a diagnosis, an IQ score, or a prediction about any child.":
    "ये सवाल इस ऐप के लिए ही लिखे गए हैं। ये RIASEC और Big Five परंपरा में बने स्व-प्रश्न-पत्र हैं, किसी क्लिनिकल टेस्ट की तरह मान्यता-प्राप्त नहीं — और ये किसी बच्चे का निदान, IQ स्कोर या भविष्यवाणी नहीं करते।",
  "We could not load the questionnaires": "प्रश्न-पत्र लोड नहीं हो सके",
  "No questionnaires are available right now": "अभी कोई प्रश्न-पत्र उपलब्ध नहीं है",
  "The question bank has not loaded on the server. Your guide, the career catalogue and the interest chat all still work.":
    "सर्वर पर सवालों का भंडार लोड नहीं हुआ है। आपका गाइड, करियर की सूची और रुचि वाली बातचीत सब चल रहे हैं।",
  "Not ready for a questionnaire?": "प्रश्न-पत्र देने के लिए तैयार नहीं हैं?",
  "The interest chat asks nothing but conversation questions, works from class 6 up, and builds the same kind of picture over time. There is no score at the end of it, which is partly the point.":
    "रुचि वाली बातचीत में सिर्फ़ बात करने वाले सवाल हैं, कक्षा 6 से शुरू होता है, और धीरे-धीरे वैसे ही एक चित्र बनाता है। अंत में कोई स्कोर नहीं आता — यही इसका मक़सद भी है।",
  "About {minutes} minutes": "लगभग {minutes} मिनट",
  "{count} questions": "{count} सवाल",
  "Finished {when}": "{when} पूरा किया",
  "Started {when}, not finished yet": "{when} शुरू किया, अभी पूरा नहीं हुआ",
  "This set is written for class {min_class} and above.": "यह सेट कक्षा {min_class} और उससे ऊपर के लिए लिखा गया है।",
  "Not available for your class yet": "आपकी कक्षा के लिए अभी उपलब्ध नहीं",
  "See your result": "अपना रिज़ल्ट देखें",
  "Answer again": "दोबारा जवाब दें",
  "Continue where you left off": "जहाँ छोड़ा वहीं से जारी रखें",
  Start: "शुरू करें",

  // ------------------------------------------------------------------- the runner
  Questionnaire: "प्रश्न-पत्र",
  "No such questionnaire": "ऐसा कोई प्रश्न-पत्र नहीं है",
  "This app offers three: interest, personality and aptitude.": "इस ऐप में तीन हैं: रुचि, स्वभाव और योग्यता।",
  "We do not have that questionnaire": "यह प्रश्न-पत्र हमारे पास नहीं है",
  "The address asked for an assessment this app does not offer. Nothing was started or changed.":
    "पते ने ऐसा आकलन माँगा जो इस ऐप में है ही नहीं। कुछ भी शुरू या बदला नहीं गया।",
  "Back to assessments": "आकलन की सूची पर वापस",
  "Back to the three": "तीनों प्रश्न-पत्रों पर वापस",
  "Answering. Nothing is timed, and every choice is saved as you go.":
    "जवाब दिए जा रहे हैं। कोई समय सीमा नहीं, और हर चयन साथ-साथ सेव होता है।",
  "A few minutes": "कुछ मिनट",
  "Class {min_class} and above": "कक्षा {min_class} और ऊपर",
  "About {minutes} minutes, no timer": "लगभग {minutes} मिनट, कोई टाइमर नहीं",
  "{count} questions, one at a time": "{count} सवाल, एक-एक करके",
  "Each answer saves as you go": "हर जवाब देते ही सेव हो जाता है",
  "Only you see these answers": "ये जवाब सिर्फ़ आप देख सकते हैं",
  "Start the questions": "सवाल शुरू करें",
  "The button stays disabled because the server would refuse it too — nothing here pretends to work.":
    "बटन बंद ही रहेगा क्योंकि सर्वर भी इसे मना कर देगा — यहाँ कुछ भी चलने का नाटक नहीं करता।",
  "Loading this questionnaire…": "यह प्रश्न-पत्र लोड हो रहा है…",
  "Before you start": "शुरू करने से पहले",
  "One question at a time, in your own order. Stop whenever you like and the answers you gave will still be here.":
    "एक-एक सवाल, अपने क्रम में। जब चाहें रुक जाएँ, दिए गए जवाब यही रहेंगे।",
  "This questionnaire is not on the server": "यह प्रश्न-पत्र सर्वर पर नहीं है",
  "The question bank has not loaded, so there is nothing to start. The catalogue and your guide still work.":
    "सवालों का भंडार लोड नहीं हुआ, इसलिए शुरू करने को कुछ नहीं है। करियर की सूची और आपका गाइड चल रहे हैं।",
  "Getting your questions ready…": "आपके सवाल तैयार हो रहे हैं…",
  "We could not open your answers": "आपके जवाब खोले नहीं जा सके",
  "You have already finished this one": "आप यह पहले ही पूरा कर चुके हैं",
  "Its result is kept as it was when you submitted it. Answering again would start a new sitting, and two numbers about the same week are not easy to read side by side.":
    "इसका रिज़ल्ट वैसा ही रखा गया है जैसे जमा करते समय था। दोबारा जवाब देने पर नया सेट शुरू होगा, और एक ही हफ़्ते के दो अलग-अलग आँकड़े साथ-साथ पढ़ना मुश्किल हो जाता है।",
  "Start a new sitting": "नया सेट शुरू करें",
  "Save it again": "फिर से सेव करें",
  "Question {n}": "सवाल {n}",
  "Question {n} of {total}": "सवाल {n} / {total}",
  "Saving answer {answered} of {total}…": "जवाब सेव हो रहा है ({answered} / {total})…",
  "Saved: {answered} of {total}": "सेव हुए: {answered} / {total}",
  Previous: "पिछला",
  Next: "अगला",
  "Finish and see the result": "पूरा करें और रिज़ल्ट देखें",
  "Answer one question and a finish button appears here.": "एक सवाल का जवाब दें, और यहाँ पूरा करने का बटन आ जाएगा।",
  "Start at the first question": "पहले सवाल से शुरू करें",
  "Jump to an unanswered one": "बिना जवाब वाले सवाल पर जाएँ",
  "Leave it and come back later": "छोड़ दें, बाद में वापस आ जाएँ",
  "Finish this questionnaire?": "यह प्रश्न-पत्र पूरा करें?",
  "{answered} of {total} answered": "{total} में से {answered} जवाब दिए",
  "Keep answering": "जवाब देते रहें",
  "Yes, score it": "हाँ, इसे परखें",
  "Areas with only one answer will show no number — that is honest, not a low score. Anything you leave blank stays blank.":
    "जिस क्षेत्र में सिर्फ़ एक जवाब है, वहाँ कोई संख्या नहीं दिखेगी — यह ईमानदारी है, कम स्कोर नहीं। जो खाली छोड़ेंगे, वह खाली ही रहेगा।",
  "You answered every question, so each area has a real count behind it.":
    "आपने हर सवाल का जवाब दिया, इसलिए हर क्षेत्र के पीछे असली गिनती है।",
  "Your answers are kept and the result is calculated from them. You can read the result later, and you can start a new sitting whenever you like.":
    "आपके जवाब सहेजे जाते हैं और रिज़ल्ट उन्हीं से बनता है। रिज़ल्ट बाद में भी पढ़ सकते हैं, और जब चाहें नया सेट शुरू कर सकते हैं।",
  "This questionnaire has no questions on the server": "इस प्रश्न-पत्र में सर्वर पर कोई सवाल नहीं हैं",
  "The question bank did not load. Try again, or ask your guide instead.":
    "सवालों का भंडार लोड नहीं हुआ। फिर कोशिश करें, या अपने गाइड से बात करें।",
  Reload: "फिर से लोड करें",
  "Talk to your guide": "अपने गाइड से बात करें",
  "Welcome back — your saved answers are here.": "वापसी पर स्वागत है — आपके सेव किए जवाब यहाँ हैं।",

  // ---------------------------------------------------------------------- result
  "Assessment result": "आकलन का रिज़ल्ट",
  "Calculated from {answered} of {total} answers on {date}. Only this account can open it, and it has not been changed since.":
    "{date} को {total} में से {answered} जवाबों से बनाया गया। इसे सिर्फ़ यही अकाउंट खोल सकता है, और बनने के बाद यह बदला नहीं गया।",
  "Reading the answers back from the server.": "सर्वर से जवाब पढ़े जा रहे हैं।",
  "Self-questionnaire": "स्व-प्रश्न-पत्र",
  "Questions were asked in Hindi": "सवाल हिन्दी में पूछे गए थे",
  "Questions were asked in English": "सवाल अंग्रेज़ी में पूछे गए थे",
  "Print / Save PDF": "प्रिंट / PDF सेव करें",
  "Loading your result…": "आपका रिज़ल्ट लोड हो रहा है…",
  "This result is not on this device": "यह रिज़ल्ट इस डिवाइस का नहीं है",
  "No such result": "ऐसा कोई रिज़ल्ट नहीं",
  "This address does not name a result": "इस पते में कोई रिज़ल्ट नहीं है",
  "The page address has no valid number in it, so nothing was asked of the server. Your own results are listed under Assessments.":
    "पते में सही संख्या नहीं है, इसलिए सर्वर से कुछ भी नहीं माँगा गया। आपके अपने रिज़ल्ट 'आकलन' पेज पर हैं।",
  "Saved answers, not a record anyone else can see. If a school or a counsellor ever asks for this, print it yourself and hand it over — this app does not send results to anyone.":
    "ये जवाब आपके खाते में सेव हैं, कोई और देख नहीं सकता। अगर स्कूल या काउंसलर माँगे तो खुद प्रिंट करके दें — यह ऐप किसी को रिज़ल्ट भेजता नहीं है।",
  "CareerGuide AI — {name}, answered {date}. A self-questionnaire, not a diagnosis.":
    "CareerGuide AI — {name}, {date} को भरा गया। यह स्व-प्रश्न-पत्र है, निदान नहीं।",
  "Back to the three questionnaires": "तीनों प्रश्न-पत्रों पर वापस",

  // ----------------------------------------------------------- result components
  "How much you answered": "आपने कितना जवाब दिया",
  "A shape drawn from a few answers is a weaker shape. This says which it is.":
    "थोड़े जवाबों से बना चित्र कमज़ोर होता है। यह बताता है कि यह वाला कैसा है।",
  "{answered} of {total} questions answered ({percent}%)": "{total} में से {answered} सवालों के जवाब ({percent}%)",
  "{count} answers could not be scored and were left out.": "{count} जवाब परखे नहीं जा सके, इसलिए छोड़ दिए गए।",
  "{name}: your shape": "{name}: आपका चित्र",
  "Not enough areas are scored yet for the six-sided shape, so each area is listed on its own.":
    "छह भुजाओं वाला चित्र बनाने के लिए क्षेत्र कम हैं, इसलिए हर क्षेत्र अलग से दिखाया गया है।",
  "One line per area. Longer means more of your strongest answers fell in that area.":
    "हर क्षेत्र के लिए एक पट्टी। लंबी पट्टी का मतलब है कि आपके मज़बूत जवाब उसी क्षेत्र में ज़्यादा हैं।",
  "Your strongest areas": "आपके मज़बूत क्षेत्र",
  "Ranked by the answers you gave, not by what anyone expects of you.":
    "आपके जवाबों के हिसाब से क्रम, किसी की उम्मीदों के हिसाब से नहीं।",
  "No number yet": "अभी कोई संख्या नहीं",
  "These areas had too few answers to score. They are not low: they are unknown, and answering two more questions in one of them would change that.":
    "इन क्षेत्रों में जवाब कम थे, इसलिए स्कोर नहीं बना। ये कम नहीं हैं — अनजान हैं, और किसी में दो और जवाब देने से यह बदल जाएगा।",
  "Careers worth a look": "देखने लायक करियर",
  "A large part of this work is {themes}, which came up among your strongest answers.":
    "इस काम का बड़ा हिस्सा {themes} है — यह आपके सबसे मज़बूत जवाबों में आया था।",
  // "और" reads twice when a label already contains it ("बातचीत और मिलकर काम"), so the
  // joiner here is the list-और.
  "{a} and {b}": "{a} तथा {b}",
  "Sample data — verify": "नमूना जानकारी — खुद जाँचें",
  "These are starting points to read about, not admissions advice. Nothing here predicts that you will get in, or that you will like it.":
    "ये पढ़ने के लिए शुरुआती बिंदु हैं, प्रवेश की सलाह नहीं। यहाँ यह नहीं कहा जाता कि आप चुने जाएँगे या आपको यह पसंद आएगा।",
  "No careers are listed because no area had enough answers to point at one. That is a normal result of doing only a few questions.":
    "कोई करियर नहीं दिखाया गया क्योंकि किसी क्षेत्र में इतने जवाब थे ही नहीं कि कोई दिशा बने। कुछ ही सवाल करने पर यह आम बात है।",
  "What these numbers are not": "ये संख्याएँ क्या नहीं हैं",
  "Talk to your guide about this": "इस बारे में अपने गाइड से बात करें",
  "Browse all careers": "सारे करियर देखें",
  "Your answers": "आपके जवाब",
  "Scores from 0 to 100, one row per area": "0 से 100 तक के स्कोर, हर क्षेत्र की एक पंक्ति",
  Area: "क्षेत्र",
  Score: "स्कोर",
  "Answers behind it": "पीछे के जवाब",
  "0 at the centre, 100 at the edge. Fewer answers make a shorter, less reliable spoke.":
    "केंद्र पर 0, किनारे पर 100। जवाब कम होने पर रेखा छोटी और कम भरोसेमंद होती है।",

  // ------------------------------------------------------------- the printed PDF
  "Download PDF report": "PDF रिपोर्ट डाउनलोड करें",
  Download: "डाउनलोड करें",
  "Your printed report": "आपकी छपी रिपोर्ट",
  "{filename} — {size}, printed {when}. It holds the {count} questionnaire(s) finished on this account.":
    "{filename} — {size}, {when} को छपी। इसमें इस अकाउंट पर पूरे हुए {count} प्रश्न-पत्र हैं।",
  "Fetching the file from the server.": "फ़ाइल सर्वर से लाई जा रही है।",
  "Fetching the file…": "फ़ाइल लाई जा रही है…",
  "Loading your report…": "आपकी रिपोर्ट लोड हो रही है…",
  "Printed in Hindi": "हिन्दी में छपी",
  "Printed in English": "अंग्रेज़ी में छपी",
  "Only this account can open it": "इसे सिर्फ़ यही अकाउंट खोल सकता है",
  "Report preview": "रिपोर्ट की झलक",
  "Delete this file": "यह फ़ाइल हटाएँ",
  "The report file did not arrive": "रिपोर्ट की फ़ाइल नहीं आई",
  "Fetch it again": "फ़िर से लाएँ",
  "Nothing has been deleted. The file is still on the server, and “Delete this file” above works whether this preview loads or not.":
    "कुछ हटाया नहीं गया है। फ़ाइल सर्वर पर है, और ऊपर दिया “Delete this file” इस झलक के खुलने-नखुलने से बिना काम करता है।",
  "No such report": "ऐसी कोई रिपोर्ट नहीं",
  "This address does not name a report": "इस पते में कोई रिपोर्ट नहीं है",
  "The page address has no valid number in it, so nothing was asked of the server. Open a finished questionnaire and press Download PDF report to make one.":
    "पते में सही संख्या नहीं है, इसलिए सर्वर से कुछ नहीं माँगा गया। किसी पूरे हुए प्रश्न-पत्र को खोलकर Download PDF report दबाएँ तो रिपोर्ट बन जाएगी।",
  "This report could not be read": "यह रिपोर्ट पढ़ी नहीं जा सकी",
  "No report with that number is on this account": "इस अकाउंट पर उस नंबर की कोई रिपोर्ट नहीं है",
  "It may have been deleted here, or the questionnaire inside it was deleted. Making a new one takes a moment from any finished result page.":
    "होता है कि इसे यहाँ से हटा दिया गया हो, या इसके अंदर वाला प्रश्न-पत्र हट गया हो। किसी भी पूरे हुए रिज़ल्ट से नई रिपोर्ट बनाने में एक मिनट लगता है।",
  "This preview is drawn by your browser, and some browsers on phones do not show a PDF inside a page. If the box above stayed empty, the Download button still gives you the same file.":
    "यह झलक आपके ब्राउज़र से दिखती है, और कुछ फ़ोन ब्राउज़र पेज के अंदर PDF नहीं दिखाते। ऊपर का हिस्सा खाली रहे तो भी Download बटन वही फ़ाइल दे देगा।",
  "The file is kept on the server so you can come back for it, and it is deleted the moment you delete it here or delete a questionnaire inside it. Nothing is written to a folder beside your answers.":
    "फ़ाइल सर्वर पर रखी जाती है ताकि आप दोबारा इसे ले सकें, और यहाँ हटाने पर — या इसके अंदर का प्रश्न-पत्र हटाने पर — यह तुरंत मिट जाती है। आपके जवाबों के बगल में कोई फ़ोल्डर नहीं बनता।",
  "Finish another questionnaire and the next request prints again, with everything you have answered by then. This copy is not quietly swapped out from under you.":
    "कोई और प्रश्न-पत्र पूरा करेंगे तो अगली बार रिपोर्ट दोबारा छपेगी, तब तक के सारे जवाबों के साथ। यह कॉपी चुपचाप बदली नहीं जाती।",
};
