/**
 * Hindi for the operator's exam editor under `/app/admin/exams`, plus the two
 * labels the settings and study-abroad screens add on — a field label, a
 * validation hint, or a save/publish state for one exam row or one door.
 *
 * Keys are the English source text, so an untranslated string still renders — in
 * English — instead of vanishing from a child's screen.
 */
export const HI: Record<string, string> = {
  "Conducting body, as the card prints it": "परीक्षा कराने वाली संस्था, जैसे कार्ड पर छपती है",
  "Date, as the notification states it": "तारीख़, जैसे नोटिफ़िकेशन में लिखी है",
  "Leave empty until you have read it": "जब तक आपने इसे न पढ़ लिया हो, खाली छोड़ें",
  "Fee, as the notification states it": "फ़ीस, जैसे नोटिफ़िकेशन में लिखी है",
  "On the page": "पेज पर दिख रहा है",
  "Heading, as students see it": "शीर्षक, जैसे विद्यार्थी उसे देखते हैं",
  "What this door is for": "यह दरवाज़ा किस लिए है",
  "Under which door": "किस दरवाज़े के नीचे",
  "Choose a door": "कोई दरवाज़ा चुनें",
  // An example exam name, and the two source URLs are example links; both stay
  // exactly as the operator types them into the box.
  "JEE Main": "JEE Main",
  "https://…/annual-notification": "https://…/annual-notification",
  "https://…/fees-and-funding": "https://…/fees-and-funding",
  "Conducting body": "परीक्षा कराने वाली संस्था",
  "Exams — operator": "परीक्षाएँ — ऑपरेटर",
  "Loading the exam catalogue": "परीक्षाओं का कैटलॉग खुल रहा है",
  "The map a class 11 or 12 student reads. The sentences are general information; a date or a fee is a record, and a record needs the page it came from.":
    "यह वह नक्शा है जो कक्षा 11 या 12 का विद्यार्थी पढ़ता है। वाक्य सामान्य जानकारी हैं; तारीख़ या फ़ीस एक रिकॉर्ड है, और रिकॉर्ड को वह पेज चाहिए जिससे वह पढ़ा गया।",
  "The catalogue is empty": "कैटलॉग खाली है",
  "No door and no exam has been written into the database. The public page shows this as an empty map rather than filling it in from memory.":
    "डेटाबेस में न कोई दरवाज़ा लिखा गया है न कोई परीक्षा। पब्लिक पेज इसे खाली नक्शे की तरह दिखाता है, याद से पूरा करने के बजाय।",
  "Saved. The server stamped today as the verification date.":
    "सेव हो गया। सर्वर ने सत्यापन की तारीख़ आज की मुहर लगा दी।",
  "Naming whose exam it is tells a family whose official site is the authority.":
    "परीक्षा किसकी है यह बताने से परिवार को पता चलता है कि किसकी आधिकारिक साइट ही अधिकारी है।",
  "Without a source here, the verified tick cannot be set.": "यहाँ स्रोत के बिना सत्यापन टिक नहीं लगाया जा सकता।",
  "Refused without a source URL above. The date is stamped by the server, never typed.":
    "ऊपर स्रोत URL के बिना यह मंज़ूर नहीं होगा। तारीख़ सर्वर मुहर लगाता है, कभी टाइप नहीं की जाती।",
  "Off means hidden, not deleted: the four sentences stay for when it is right again.":
    "बंद का मतलब छिपा हुआ है, डिलीट नहीं: चारों वाक्य बचे रहते हैं, ताकि जब यह फिर से सही हो तब दिखें।",
  "Nothing has changed yet.": "अभी कुछ नहीं बदला।",
  "Hidden": "छिपा हुआ",
  "No verified figure": "कोई सत्यापित आँकड़ा नहीं",
  "Public card shows no date and no fee — it names the official notification.":
    "पब्लिक कार्ड पर न तारीख़ दिखती है न फ़ीस — वह बस आधिकारिक नोटिफ़िकेशन का नाम लिखता है।",
  "Delete the row": "पंक्ति डिलीट करें",
  "The door could not be saved.": "दरवाज़ा सेव नहीं हो सका।",
  "hidden": "छिपा हुआ",
  "Edit the door": "दरवाज़ा बदलें",
  "A door with nothing under it does not show to students either way.":
    "जिस दरवाज़े के नीचे कुछ भी नहीं, वह विद्यार्थियों को दोनों ही हालत में नहीं दिखता।",
  "Delete the door": "दरवाज़ा डिलीट करें",
  "Added with no date, no fee and no verification — which is the only correct way for a row to arrive.":
    "पंक्ति जुड़ गई, पर तारीख़, फ़ीस और सत्यापन के बिना — और एक पंक्ति का इसी तरह आना ही सही तरीका है।",
  "The exam could not be added.": "परीक्षा जोड़ी नहीं जा सकी।",
  "Add the exam": "परीक्षा जोड़ें",
  "See the student's map": "विद्यार्थी का नक्शा देखें",
  "Every row has a verified figure recorded against a source.":
    "हर पंक्ति का आँकड़ा किसी स्रोत के सहारे सत्यापित होकर दर्ज है।",
  "Writes here are limited to ten a minute. A refusal prints the server's own sentence below the button.":
    "यहाँ लिखना प्रति मिनट दस तक सीमित है। मना किया जाए तो सर्वर का अपना वाक्य बटन के नीचे छपता है।",
  "Add an exam": "नई परीक्षा जोड़ें",
  "The careers catalogue": "करियर का कैटलॉग",
  "Public card shows: {figures}": "पब्लिक कार्ड में दिखता है: {figures}",
  "{count} exam{s}": "{count} परीक्षा",
  "{doors} doors and {exams} exams.": "{doors} दरवाज़े और {exams} परीक्षाएँ हैं।",
  "{count} of them have no verified date or fee, so their cards print the official notification instead. That is the state the seed was written in, and it is a correct state — not a queue to empty.":
    "उनमें से {count} पर कोई सत्यापित तारीख़ या फ़ीस नहीं, इसलिए उनके कार्ड आधिकारिक नोटिफ़िकेशन का नाम लिखते हैं। सीड इसी हालत में लिखा गया था, और यह सही हालत है — इसे खाली करने की क़तार नहीं।",
  "Reads, per session": "पढ़ने की संख्या, प्रति सेशन",
  "Empty means the public card prints no date at all and names this year's official notification instead. That is the correct state until a person reads the figure.":
    "खाली छोड़ने का मतलब है कि पब्लिक कार्ड पर कोई तारीख़ बिल्कुल नहीं छपेगी, उसकी जगह इस साल के आधिकारिक नोटिफ़िकेशन का नाम लिखा जाएगा। जब तक कोई इंसान वह आँकड़ा न पढ़ ले, यही सही हालत है।",
  "The two boxes below are the only ones on this form that a child may read as a fact. They need the page they came from, and the server refuses them without it.":
    "नीचे वाले दो बॉक्स इस फ़ॉर्म के एकमात्र ऐसे बॉक्स हैं, जिन्हें बच्चा तथ्य मान सकता है। इन्हें वह पेज चाहिए जिससे ये लिए गए थे, और पेज के बिना सर्वर इन्हें मंज़ूर नहीं करता।",
  "Hiding it is usually the answer: a card can be wrong for a year and right again. Deleting removes the row and its verification, and there is no undo on this screen.":
    "आम तौर पर इसे छिपाना ही जवाब है: एक कार्ड किसी साल ग़लत हो सकता है और बाद में फिर सही हो जाए। डिलीट करने से पंक्ति और उसका सत्यापन दोनों मिट जाते हैं, और इस स्क्रीन से इसे वापस नहीं लाया जा सकता।",
  "A door that still has exams under it is refused, so nothing a student is reading disappears with a heading. Hide it instead, or move the exams out first.":
    "जिस दरवाज़े के नीचे अभी परीक्षाएँ हों, उसे सर्वर डिलीट नहीं होने देता, ताकि विद्यार्थी जो पढ़ रहा हो वह शीर्षक के साथ न उड़े। उसके बजाय दरवाज़ा छिपाएँ, या पहले परीक्षाएँ हटाकर कहीं और रखें।",
  "All six of these are what a student will read, so they are written here rather than left as a stub — the server refuses a row whose sentences are too short to be sentences. A new exam has no date, no fee and no verification; those enter later, from the edit card, with the page they were read from.":
    "ये छहों वह हैं जो विद्यार्थी पढ़ेगा, इसलिए इन्हें यहाँ लिखा जाता है, अधूरा नहीं छोड़ा जाता — सर्वर ऐसी पंक्ति मंज़ूर नहीं करता जिसके वाक्य इतने छोटे हों कि वाक्य कहला ही न सकें। नई परीक्षा के साथ न तारीख़ होती है, न फ़ीस, न सत्यापन; वे बाद में भरती हैं, एडिट कार्ड से, और जिस पेज से पढ़ी गई थीं उसके साथ।",
  // Source splits this one t() call across three lines with +, so the runtime key
  // is the whole joined sentence on one line.
  "Every GET that has no rule of its own. The catalogue a public page reads is exempt, so this is the ceiling on a session paging through a database — not on a class opening the same page at once.":
    "यह हर GET पर लगता है जिसकी अपनी कोई सीमा नहीं है। पब्लिक पेज जो कैटलॉग पढ़ता है वह इससे बाहर है, इसलिए यह एक सेशन के डेटाबेस के पेज पलटने की ऊपरी हद है — एक क्लास के एक साथ एक ही पेज खोलने की नहीं।",
};
