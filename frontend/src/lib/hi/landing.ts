/** Hindi for the landing page (`src/app/page.tsx`).
 *
 * The landing page is the one screen a reader reaches without having chosen
 * anything yet, so its copy is translated in full — including the feature and
 * step cards, which are module constants and are looked up through
 * `t(item.title)`.
 *
 * Two deliberate English leftovers:
 * - `metadata` title and description, because a crawler and a Hindi reader should
 *   not be handed two accounts of the same URL;
 * - the two student messages in the sample chat, which are Hinglish on purpose —
 *   their whole point is that anything you type gets understood.
 */
export const HI: Record<string, string> = {
  // Header and hero
  "Safety and privacy": "सुरक्षा और निजता",
  "For students in class 6 to 12, and the parents who support them":
    "कक्षा 6 से 12 के विद्यार्थियों के लिए, और उनके अभिभावकों के लिए",
  "Career guidance that feels like a conversation, not an examination.":
    "करियर का मार्गदर्शन, जो बातचीत लगे — परीक्षा नहीं।",
  "Talk about what you enjoy, what you are curious about and what worries you. CareerGuide AI helps you explore real careers, understand the routes and costs, and take one small next step — in Hindi, English or Hinglish.":
    "जो आपको पसंद है, जिसके बारे में जानना चाहते हैं, और जो चिंता देती है — उसकी बात करें। CareerGuide AI आपको असली करियर देखने, रास्तों और खर्च को समझने, और एक छोटा अगला कदम उठाने में मदद करता है — हिन्दी, अंग्रेज़ी या हिंग्लिश में।",
  "I am a parent": "मैं अभिभावक हूँ",
  "No career is called impossible": "कोई करियर असंभव नहीं कहा जाता",
  "Never listens in the background": "कभी छिपकर नहीं सुनता",
  "A typical first chat": "पहली बातचीत ऐसी होती है",
  "Both can stay open — many products, games and buildings need designers, and some engineering jobs include drawing too. May I ask one small thing? When you draw, is it characters, or how things are built, or colours and layouts?":
    "दोनों रास्ते खुले रह सकते हैं — कई प्रोडक्ट, गेम्स और इमारतों को डिज़ाइनर चाहिए होते हैं, और कुछ इंजीनियरिंग के कामों में ड्रॉइंग भी शामिल है। एक छोटा सवाल पूछ लूँ? जब आप बनाते हैं, तो किरदार, चीज़ें कैसे बनती हैं, या रंग और लेआउट — कौन-सा?",
  "That is a real interest theme worth exploring. Three paths to look at together: architecture, industrial design and mechanical drafting. None of them needs an expensive course to test first.":
    "यह सच में ऐसी रुचि है जिसे आगे देखना सार्थक है। साथ में देखने के तीन रास्ते: आर्किटेक्चर, इंडस्ट्रियल डिज़ाइन और मैकेनिकल ड्रॉफ़्टिंग। इन्हें आज़माने से पहले किसी महँगे कोर्स की ज़रूरत नहीं है।",
  "Exploratory suggestion based on what was said. Not a prediction, and no paid course is being recommended.":
    "कही गई बात के आधार पर आगे देखने का सुझाव। यह भविष्यवाणी नहीं है, और कोई पेड कोर्स सलाह के तौर पर नहीं दिया जा रहा।",

  // Feature cards
  "Everything a first conversation should do": "वह सब जो पहली बातचीत को करना चाहिए",
  "Talk, don't type": "बोलो, टाइप मत करो",
  "Speak naturally in Hindi, English or Hinglish. The guide listens, replies out loud, and always keeps the text on screen so nothing is missed.":
    "हिन्दी, अंग्रेज़ी या हिंग्लिश में ज्यों का त्यों बोलें। गाइड सुनता है, बोलकर जवाब देता है, और साथ में स्क्रीन पर टेक्स्ट भी रखता है ताकि कुछ छूटे नहीं।",
  "Explore careers properly": "करियर को गहराई से देखें",
  "Over forty career profiles across every field — what a working day really looks like, what it costs, what to check next, and routes from smaller towns.":
    "हर फ़ील्ड में चालीस से ज़्यादा करियर प्रोफ़ाइलें — एक आम दिन असल में कैसा होता है, कितना खर्च होता है, आगे क्या जाँचना है, और छोटे शहरों से जाने वाले रास्ते।",
  "Interests, not labels": "रुचियाँ, लेबल नहीं",
  "Suggestions are built from what you actually say. They are starting points to explore, never a verdict on who a child can become.":
    "सुझाव इस बात से बनते हैं कि आप सच में क्या कहते हैं। ये आगे देखने की शुरुआत हैं, यह फ़ैसला नहीं कि बच्चा बन सकता क्या है।",
  "Parents in the loop": "अभिभावक भी साथ में",
  "A student chooses what a parent sees. Guardians get guidance on supporting a child without pressure, and no hidden monitoring.":
    "बच्चा तय करता है कि अभिभावक क्या देखें। अभिभावक को मार्गदर्शन मिलता है कि बच्चे का साथ बिना दबाव डाले कैसे दिया जाए, और कोई छिपी निगरानी नहीं होती।",
  "Money talked about honestly": "पैसों की बात साफ़-साफ़",
  "Scholarships, low-cost routes and free practice are shown alongside every expensive path, so a budget never closes a door.":
    "हर महँगे रास्ते के साथ स्कॉलरशिप, सस्ते रास्ते और मुफ़्त अभ्यास भी दिखाए जाते हैं, ताकि बजट कभी दरवाज़ा न बंद करे।",
  "Data kept small": "डेटा कम से कम",
  "No raw microphone recording, no continuous listening, no selling of a child's conversations. Delete a transcript any time.":
    "न कच्ची माइक रिकॉर्डिंग, न लगातार सुनना, न बच्चों की बातें पैसे पर बेचना। ट्रांसक्रिप्ट कभी भी हटा सकते हैं।",

  // How it works
  "A grown-up gives permission": "अनुमति एक बड़े देते हैं",
  "Onboarding takes two minutes and starts with consent. You choose whether voice is used and what a parent may see.":
    "शुरुआत दो मिनट में होती है और पहला कदम सहमति है। आप तय करते हैं कि वॉइस इस्तेमाल होगी या नहीं, और अभिभावक क्या देख सकते हैं।",
  "Have a real conversation": "एक सच्ची बातचीत",
  "Answer in your own words and language. The guide asks one question at a time, like a friendly senior, not an examiner.":
    "अपने शब्दों और अपनी भाषा में जवाब दें। गाइड एक बार में एक सवाल पूछता है, दोस्ताना सीनियर की तरह — परीक्षा लेने वाले की तरह नहीं।",
  "See what fits and explore it": "जो फ़िट हो उसे देखें और आगे जाएँ",
  "Careers are matched to themes you mentioned, with the evidence shown so you can disagree with a suggestion.":
    "करियर आपकी बताई हुई रुचियों से मिलाए जाते हैं, और उसके पीछे का आधार भी दिखता है — ताकि आप किसी सुझाव से असहमत भी हो सकें।",
  "Plan the next small step": "अगला छोटा कदम तय करें",
  "Turn interest into a free, doable plan — a book, a video, a project, a conversation with someone who does the work.":
    "रुचि को मुफ़्त और होने लायक योजना में बदलें — एक किताब, एक वीडियो, एक प्रोजेक्ट, या उस काम को करने वाले किसी से बात।",

  // Parents
  "For parents and guardians": "अभिभावकों और संरक्षकों के लिए",
  "Help without pressure": "मदद, दबाव नहीं",
  "Most arguments about careers start because neither side knows what the other is afraid of. The parent dashboard shows what interests your child is exploring and what evidence sits behind a suggestion — never a secret score, never a diagnosis, never a message your child did not choose to share.":
    "करियर पर ज़्यादातर बहइस इसलिए शुरू होती हैं क्योंकि दोनों पक्षों को पता नहीं कि दूसरा किस बात से डरता है। पेरेंट डैशबोर्ड दिखाता है कि आपका बच्चा किन रुचियों को देख रहा है और किसी सुझाव के पीछे क्या आधार है — कभी छिपा हुआ स्कोर नहीं, कभी निदान नहीं, और कभी वह संदेश नहीं जो बच्चा खुद बंटाने को तैयार नहीं हुआ।",
  "Sharing settings belong to the student. Conversations stay private unless they opt in.":
    "बंटाने की सेटिंग विद्यार्थी की अपनी हैं। जब तक वह खुद न चुनें, बातचीत निजी रहती है।",
  "Wording that helps you discuss a choice calmly, instead of insisting on one.":
    "ऐसे शब्द जो किसी चुनाव पर शांति से बात करने में मदद करें, एक ही बात पर ज़िद करने के बजाय।",
  "Realistic cost pictures, including lower-cost routes and what to verify yourself.":
    "खर्च का असली चित्र, जिसमें सस्ते रास्ते भी हैं और यह भी कि आपको खुद क्या जाँचना है।",
  "An example of what the parent view says": "पेरेंट व्यू ऐसा कहता है — उदाहरण",
  "“Your child keeps coming back to how things are put together. That is an observation from two conversations, not a conclusion. Before deciding anything, try one low-risk step together: a free design video, then a walk through a workshop or office where such work happens. Architecture, industrial design and mechanical drafting all begin from this interest, and their costs differ a lot — worth checking government college fees before ruling anything out.”":
    "“आपका बच्चा बार-बार इसी बात पर आता है कि चीज़ें कैसे जोड़ी जाती हैं। यह दो बातचीतों से देखा गया अवलोकन है, नतीजा नहीं। कुछ भी तय करने से पहले साथ में एक छोटा और सुरक्षित कदम आज़माएँ: एक मुफ़्त डिज़ाइन वीडियो, फिर ऐसी वर्कशॉप या ऑफ़िस में घूमना जहाँ यह काम होता है। आर्किटेक्चर, इंडस्ट्रियल डिज़ाइन और मैकेनिकल ड्रॉफ़्टिंग — तीनों इसी रुचि से शुरू होते हैं, और इनका खर्च बहुत अलग-अलग है — कोई रास्ता रद्द करने से पहले सरकारी कॉलेज की फ़ीस देखना सार्थक है।”",
  "No institution is named, no fee is claimed, and no career is presented as settled.":
    "इसमें किसी संस्थान का नाम नहीं, कोई फ़ीस दावे के तौर पर नहीं, और कोई करियर पक्का बताकर नहीं दिखाया गया है।",

  // Safety
  "What CareerGuide AI will not do": "CareerGuide AI क्या नहीं करेगा",
  "A guidance tool for children is only useful if it can be trusted. These limits are built into the app, not written as policy you have to read.":
    "बच्चों के लिए मार्गदर्शन का साधन तभी काम का है जब उस पर भरोसा हो सके। ये सीमाएँ ऐप में बनाई गई हैं, नीति की तरह पढ़ने के लिए नहीं लिखी गईं।",
  "No background listening": "बिना बातचीत के सुनना नहीं",
  "The microphone turns on only while you hold a conversation open, and raw audio is not stored.":
    "माइक तभी चालू रहता है जब बातचीत खुली हो, और कच्चा ऑडियो स्टोर नहीं होता।",
  "No selling of private chats": "निजी बातें बेचना नहीं",
  "Children's conversations are never shared with advertisers or institutions for money.":
    "बच्चों की बातें कभी भी विज्ञापन देने वालों या संस्थाओं को पैसे के लिए नहीं दी जातीं।",
  "No persuasive upselling": "कुछ भी थोपना नहीं",
  "It will never push a paid course, coaching institute or college on a family.":
    "यह किसी परिवार को कभी पेड कोर्स, कोचिंग संस्थान या कॉलेज ज़बरदस्ती नहीं थोपेगा।",
  "No judgement from accent or voice": "बोलने के अंदाज़ पर फ़ैसला नहीं",
  "Ability is never inferred from how a child speaks, their pitch, speed or accent.":
    "बच्चा कैसे बोलता है — उसकी आवाज़, गति या लहज़ा — इनसे उसकी क्षमता का अनुमान कभी नहीं लगाया जाता।",
  "No diagnosis": "कोई निदान नहीं",
  "It does not label mental health, intelligence or personality. If something serious comes up, it points to a trusted adult and Childline 1098.":
    "यह मानसिक स्वास्थ्य, बुद्धि या व्यक्तित्व का लेबल नहीं लगाता। अगर कोई गंभीर बात सामने आए, तो विश्वासपात्र बड़े और चाइल्डलाइन 1098 की ओर भेजता है।",
  "No fabricated results": "गढ़े हुए नतीजे नहीं",
  "No invented salaries, placements, admissions or cut-offs. Anything uncertain is marked for verification.":
    "न गढ़ी हुई तनख्वाह, न प्लेसमेंट, न दाखिला, न कटऑफ। जो बात पक्की नहीं है, उसे जाँचने के लिए खुला छोड़ा जाता है।",
  "Please read this honestly": "कृपया इसे ध्यान से पढ़ें",
  "It does not predict the future and is not an aptitude or IQ test.":
    "यह भविष्य नहीं बताता, और यह एप्टिट्यूड या आईक्यू टेस्ट भी नहीं है।",
  "Fees, exam dates, seats and scheme rules change every year — every listing asks you to verify on the official site.":
    "फ़ीस, एग्ज़ाम की तारीखें, सीटें और योजना के नियम हर साल बदलते हैं — हर लिस्टिंग आपको आधिकारिक साइट पर जाँचने के लिए कहती है।",
  "Institutions that pay for a listing are labelled, and payment never changes a career suggestion.":
    "जो संस्थान लिस्टिंग के लिए पैसे देते हैं उन्हें चिह्नित किया जाता है, और पैसे कभी करियर का सुझाव नहीं बदलते।",
  "Spoken replies need internet. If voice fails, the same answer is still readable as text.":
    "बोले गए जवाब के लिए इंटरनेट चाहिए। अगर वॉइस काम न करे तो वही जवाब टेक्स्ट में पढ़ने को मिलता है।",

  // Closing
  "No test to prepare for, no form full of personal details. Just a few honest answers about what you like and what you are curious about.":
    "कोई ऐसी परीक्षा जिसकी तैयारी करनी हो, कोई ऐसा फ़ॉर्म जो निजी जानकारी से भरा हो। बस कुछ सच्चे जवाब — आपको क्या पसंद है और जिसके बारे में आप जानना चाहते हैं।",
};
