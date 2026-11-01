/**
 * Hindi for `/app/reports`: the screen's own headings, buttons, confirm dialogs and
 * the "what this report cannot do" panel.
 *
 * The report body itself — framing, themes, recommendations, quotes — is written by the
 * server in the language the student was using, so it is data and is not translated here.
 *
 * Every entry is on one line on purpose: the two checkers in `scripts/` read this folder
 * as text, and a key wrapped onto its own line is a key they cannot see.
 */
export const HI: Record<string, string> = {
  // ------------------------------------------------------------------ the header
  "My Career Report": "मेरी करियर रिपोर्ट",
  "An exploratory summary of what you have shared so far. It is not a prediction, an assessment or a verdict about you.": "अब तक आपने जो साझा किया है उसका एक खोजबीन-भरा सार। यह न कोई भविष्यवाणी है, न आँकलन, और न आपके बारे में कोई फ़ैसला।",
  "Exploratory document": "खोजबीन का दस्तावेज़",
  "Fresh report": "नई रिपोर्ट",
  "No report yet": "अभी कोई रिपोर्ट नहीं",
  "A report needs a few conversations or interest answers first. Talk with your guide or note what you enjoy, then come back and generate it here.": "रिपोर्ट के लिए पहले कुछ बातचीत या रुचि के जवाब चाहिए। अपने गाइड से बात कीजिए या लिखिए कि आपको क्या अच्छा लगता है, फिर यहाँ लौटकर रिपोर्ट बनाइए।",
  "Explore interests": "रुचियाँ खोजें",
  "Generate my report": "मेरी रिपोर्ट बनाएँ",
  "Prepared for": "तैयार की गई:",
  "this student": "यह विद्यार्थी",
  "Generated {when}": "{when} को बनी",

  // ----------------------------------------------------------------- the sections
  "Themes we noticed": "वे रुझान जो हमें दिखे",
  "Patterns from what you shared — not labels or limits.": "आपने जो साझा किया उससे बने पैटर्न — न कोई लेबल, न कोई हद।",
  "Things you mentioned enjoying": "वे चीज़ें जिनका आपने मज़ा लेना बताया",
  "Careers you named": "वे करियर जिनका आपने नाम लिया",
  "Naming a job you're curious about now is completely normal — and it is allowed to change later. Nothing here is locked in.": "अभी जिस काम को लेकर आप उत्सुक हैं उसका नाम लेना बिल्कुल आम बात है — और बाद में बदलना भी जायज़ है। यहाँ कुछ भी पक्का नहीं किया गया।",
  "Fields worth exploring": "वे क्षेत्र जिन्हें खोजना सार्थक है",
  "These are directions to look into based on what you've said — not recommendations about who you should become.": "ये वे दिशाएँ हैं जिन्हें आपने जो कहा उसके आधार पर देखा जा सकता है — इस बारे में सिफ़ारिश नहीं कि आपको क्या बनना चाहिए।",
  "Careers you saved": "वे करियर जो आपने सेव किए",
  "Small experiments to try": "आज़माने लायक छोटे प्रयोग",
  "Low-pressure ways to test what actually interests you.": "बिना दबाव के तरीक़े, यह परखने के लिए कि असल में आपको क्या रुचिकर लगता है।",
  "Suggested next steps": "सुझाए गए अगले कदम",
  "About costs and support": "ख़र्च और मदद के बारे में",
  "What we still don't know": "वह जो हम अभी नहीं जानते",
  "This part is just as important as the rest. These gaps are normal, not a problem with you.": "यह हिस्सा बाक़ी जितना ही ज़रूरी है। ये ख़ाली जगहें आम हैं, आपमें कोई कमी नहीं।",
  "There are no specific gaps flagged right now — but plans can always change as you learn more, and that is expected.": "अभी कोई ख़ास कमी चिन्हित नहीं है — लेकिन जैसे-जैसे आप और जानेंगे, योजनाएँ बदल सकती हैं, और यही अपेक्षित है।",
  "Based on {n} conversation reviewed so far.": "अब तक देखी गई {n} बातचीत पर आधारित।",
  "Based on {n} conversations reviewed so far.": "अब तक देखी गई {n} बातचीतों पर आधारित।",

  // ------------------------------------------------- inside a recommendation block
  "What you said that points here": "आपकी वह बात जो यहाँ इशारा करती है",
  "Still worth finding out": "जो अभी जानना बाक़ी है",
  "Skills to try": "आज़माने लायक स्किल",
  "Qualifications to check": "जाँचने लायक योग्यताएँ",
  "Related options to keep open": "मिलते-जुले विकल्प जो खुले रखें",
  "A small next step:": "एक छोटा अगला कदम:",

  // ---------------------------------------------------- what the report cannot do
  "What this report cannot do": "यह रिपोर्ट क्या नहीं कर सकती",
  "It does not predict your results, marks or future.": "यह आपके नतीजों, अंकों या भविष्य की भविष्यवाणी नहीं करती।",
  "It does not certify, rank or assess you in any official way.": "यह आपको किसी आधिकारिक रूप से प्रमाणित, रैंक या आँकती नहीं है।",
  "No school, admission office or employer should treat it as an assessment. It is only a mirror of conversations you chose to have here.": "किसी स्कूल, प्रवेश कार्यालय या नियोक्ता को इसे आँकलन नहीं मानना चाहिए। यह बस उन बातचीत का आईना है जो आपने यहाँ करना चुनीं।",

  // ------------------------------------------------------------- toasts and modals
  "Your report has been refreshed.": "आपकी रिपोर्ट ताज़ा हो गई है।",
  "This report has been deleted.": "यह रिपोर्ट हटा दी गई है।",
  "Generate a fresh report?": "नई रिपोर्ट बनाएँ?",
  "This creates a new report from what you've shared so far and replaces the one you're viewing.": "यह अब तक आपने जो साझा किया है उससे नई रिपोर्ट बनाता है और जो आप देख रहे हैं उसकी जगह ले लेता है।",
  "Keep current": "मौजूदा रहने दें",
  "Generate fresh report": "नई रिपोर्ट बनाएँ",
  "Your current report stays until the new one is ready. If the new one is empty, you can simply explore more and generate again later.": "नई रिपोर्ट तैयार होने तक आपकी मौजूदा रिपोर्ट बनी रहती है। अगर नई ख़ाली हो, तो आप और खोजबीन करके बाद में दोबारा बना सकते हैं।",
  "Delete this report?": "यह रिपोर्ट हटा दें?",
  "This removes the report from your account. It cannot be undone from here.": "यह रिपोर्ट आपके अकाउंट से हटा देता है। यहाँ से यह वापस नहीं हो सकता।",
  "Delete report": "रिपोर्ट हटाएँ",
  "You can always generate a new report later. Nothing else you have saved is affected.": "आप बाद में कभी भी नई रिपोर्ट बना सकते हैं। आपकी सेव की हुई बाक़ी चीज़ों पर असर नहीं पड़ता।",
};