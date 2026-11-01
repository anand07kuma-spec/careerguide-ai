/**
 * Hindi for the plan on a finished result: the skill gap, the four weeks, and the chat
 * card that opens from them — and, at the foot of the file, for `/app/plans`, the plans
 * a student writes for themselves. The two are kept together because a reader meets them
 * as one idea ("my plan"), even though only the first is written by the server.
 *
 * The plan's own sentences are not here. `services/roadmap.py` stores language-neutral
 * data and writes the sentences at read time, so a student reading the app in Hindi gets
 * Hindi steps from the server. What this file holds is the app's own labels around them,
 * the two sentences about a provider that failed, and — as in `hi/assessments.ts` — the
 * eight theme names the gap list uses, which come from the server in English and are
 * looked up in `hi/common.ts`.
 *
 * Every entry is on one line on purpose: the two checkers in `scripts/` read this folder
 * as text, and a key wrapped onto its own line is a key they cannot see.
 */
export const HI: Record<string, string> = {
  // ------------------------------------------------------------- the skill gap card
  "Your skill gap": "आपका स्किल-गैप",
  "What your answers already cover, and what {career} leans on beyond that. This describes the work, not you.": "आपके जवाब किन चीज़ों को ढकते हैं, और {career} उससे आगे किन पर टिका है। यह काम का बयान है, आपका फ़ैसला नहीं।",
  "this work": "यह काम",
  "Where your answers came back strong": "आपके जवाब जहाँ सबसे मज़बूत आए",
  "Nothing came back strong enough to name. That is a result of how few answers there were, not a judgement.": "इतना मज़बूत कुछ भी नहीं आया कि उसका नाम लिया जा सके। यह जवाबों की कम गिनती का नतीजा है, आप पर कोई फ़ैसला नहीं।",
  "What this work asks for beyond that": "इस काम को उससे आगे क्या चाहिए",
  "This plan goes deeper into what you already like rather than fixing a gap.": "यह योजना किसी कमी को भरने के बजाय उसी काम को गहरा करती है जो आपको पहले से अच्छा लगता है।",
  "Not measured, so not a weakness": "नापा ही नहीं गया, इसलिए कमज़ोरी नहीं",
  "Too few answers in these areas to score anything. They are left out of the gap above on purpose.": "इन क्षेत्रों में इतने कम जवाब थे कि कुछ आँका जा सके। इसलिए इन्हें ऊपर लिखी कमी में जान-बूझकर नहीं रखा गया।",
  "Skills {career} leans on": "वे स्किल जिन पर {career} टिका है",
  "These are the skills the work itself lists. Nothing here was tested, and none of them say what you are capable of learning.": "ये स्किल उस काम की अपनी सूची हैं। इनमें से एक भी आप पर परखा नहीं गया, और ये नहीं बताते कि आप क्या सीख सकते हैं।",

  // -------------------------------------------------------------------- the source
  "Written by the app's own rules": "इस ऐप के अपने नियमों से लिखी गई",
  "{provider} model": "{provider} मॉडल",
  "Written in {language}": "{language} में लिखी गई",
  "Rewrite this plan with AI": "AI से यह योजना दोबारा लिखवाएँ",
  "Asking the model…": "मॉडल से पूछा जा रहा है…",
  // The two sentences the rebuild route answers with when the model does not deliver.
  // These exact strings live in `services/roadmap.py`, which is why they are here. They
  // say only that nothing changed, never who wrote the plan that is standing — the badge
  // above them already says that, and after one successful ✨ the standing plan is the
  // model's, not the rules'.
  "The AI provider could not be reached, so the plan on this page did not change.": "AI सर्विस से बात नहीं हो पाई, इसलिए इस पेज पर जो योजना पहले थी वैसी ही रही है।",
  "The AI provider did not return a usable plan, so the plan on this page did not change.": "AI सर्विस ने ऐसा जवाब दिया जो योजना नहीं बन सकी, इसलिए इस पेज पर जो योजना पहले थी वैसी ही रही है।",

  // ------------------------------------------------------------- the four-week plan
  "Your 30-day plan": "आपकी 30-दिन की योजना",
  "Four weeks aimed at {career}, from your own answers. Do them in order, swap them, or skip one — this is a suggestion, not a timetable.": "आपके अपने जवाबों से लिखी गई, {career} पर निशाना लगाती चार हफ़्ते। क्रम से कीजिए, आपस में बदल दीजिए, या कोई एक छोड़ दीजिए — यह सुझाव है, टाइम-टेबल नहीं।",
  "Discuss this roadmap with AI Guide": "इस योजना पर AI गाइड से बात करें",
  "Read about {career}": "{career} के बारे में पढ़ें",
  "Nothing here is a promise about results, admissions or a job. It is four weeks of things to try, and the fact that you did them is the only thing it proves.": "यहाँ न नतीजों की, न प्रवेश की, न नौकरी की कोई गारंटी है। यह चार हफ़्ते के आज़माने वाले काम हैं, और आपके उन्हें करने के सिवाय कुछ भी साबित नहीं होता।",
  "This plan has no weeks in it, which means something went wrong above rather than with you.": "इस योजना में कोई हफ़्ते नहीं हैं, इसका मतलब है कि ऊपर कहीं कुछ गड़बड़ हुई है — आपकी वजह से नहीं।",

  // ---------------------------------------------------------------- no plan at all
  "No plan for these answers yet": "इन जवाबों के लिए अभी कोई योजना नहीं",
  "This result was saved before the app started writing four-week plans, or its answers matched no career in its own notes closely enough to aim one at. Answering the questionnaire again produces a result that comes with a plan.": "यह रिज़ल्ट उससे पहले सेव हुआ था जब इस ऐप में चार हफ़्ते की योजना बनना शुरू हुई, या आपके जवाब इस ऐप के किसी करियर-नोट से इतने नहीं मेल खाते थे कि योजना उस पर निशाना लगा सके। प्रश्न-पत्र दोबारा भरने पर रिज़ल्ट अपने साथ योजना भी लाएगा।",
  "No career in this app's notes matched your answers closely enough to aim four weeks at, so there is nothing for a plan to work towards. Answering more of the questionnaire is what changes that.": "इस ऐप के करियर-नोट में से कोई भी आपके जवाबों से इतना मेल नहीं खाया कि चार हफ़्ते उस पर लगाए जा सकें, इसलिए योजना में काम करने को कुछ है ही नहीं। प्रश्न-पत्र के और जवाब देने से यही बदलेगा।",

  // -------------------------------------------------- the plan card inside the chat
  "Reading your plan…": "आपकी योजना पढ़ी जा रही है…",
  "Aimed at {career}. Your guide is looking at these same four weeks, so you can ask about week two without describing it.": "{career} पर निशाना लगाती यह चार हफ़्ते की योजना आपके गाइड के सामने भी खुली है, इसलिए दूसरे हफ़्ते के बारे में पूछने पर उसे समझाना नहीं होगा।",
  "Week {n}": "हफ़्ता {n}",
  "Open the full plan": "पूरी योजना खोलें",
  "Put this plan away": "यह योजना हटा दें",
  "Show the plan again": "योजना दोबारा दिखाएँ",
  "That plan is not on this account any more, so your guide has not been shown one. This chat works exactly as it did before — and a questionnaire you answer now comes with a plan of its own.": "उस योजना वाला रिज़ल्ट अब इस अकाउंट पर नहीं है, इसलिए गाइड को कोई योजना नहीं दिखाई गई। यह बातचीत बिल्कुल पहले जैसी चलती रहेगी — और अब जो प्रश्न-पत्र आप भरेंगे, उसके साथ अपनी योजना भी आएगी।",
  "My 30-day plan is next to this chat — what should I do first this week?": "मेरी 30-दिन की योजना इस चैट के बगल में खुली है — इस हफ़्ते सबसे पहले क्या करूँ?",

  // ------------------------------------------- the plans the student sets themselves
  // `/app/plans` is a different thing from the four-week plan above: nothing here is
  // written by the server. The student names the goal, picks the steps and sets the
  // pace, so the Hindi keeps the same ownership — "आपकी योजना", never "आपको दी गई योजना".
  "Plans you set for yourself, about things you're curious about. Change, shorten or drop them any time — nothing here is assigned by a teacher or an algorithm.": "ऐसी योजनाएँ जो आप खुद अपने लिए बनाते हैं, उन चीज़ों के बारे में जो आपको जानने का मन करता है। इन्हें कभी भी बदलें, छोटा करें या छोड़ दें — यहाँ कुछ भी किसी टीचर या एल्गोरिद्म ने तय नहीं किया है।",
  "Student-owned and adjustable": "आपकी अपनी, और बदलने लायक",
  "New plan": "नई योजना",
  "Falling behind on a plan is normal, not failure. If a step feels too big, make it smaller. If a plan no longer interests you, change it or start a new one.": "योजना में पीछे रह जाना आम बात है, नाकामी नहीं। कोई कदम बहुत बड़ा लगे तो उसे छोटा कर दीजिए। कोई योजना अब अच्छी न लगे तो उसे बदल दीजिए या नई शुरू कर दीजिए।",
  "We couldn't load your plans": "आपकी योजनाएँ लोड नहीं हो सकीं",
  "No plans yet": "अभी कोई योजना नहीं",
  "A plan is just a list of small things you'd like to try next — you decide what goes in it and how fast you move.": "योजना बस उन छोटे कामों की सूची है जो आप आगे आज़माना चाहते हैं — उसमें क्या जाएगा और आप कितनी तेज़ी से बढ़ेंगे, यह आप तय करते हैं।",
  "Create your first plan": "अपनी पहली योजना बनाएँ",
  "Look at careers for ideas": "आइडिया के लिए करियर देखें",
  "Delete this plan?": "यह योजना हटा दें?",
  "Delete this step?": "यह कदम हटा दें?",
  "\"{title}\" and all of its steps will go away. This cannot be undone.": "\"{title}\" और उसके सारे कदम हट जाएँगे। यह वापस नहीं हो सकता।",
  "\"{title}\" will be removed from the plan. This cannot be undone.": "\"{title}\" योजना से हट जाएगा। यह वापस नहीं हो सकता।",
  "Yes, delete": "हाँ, हटा दें",
  "Deleting a plan doesn't erase anything else you've explored. You can always make a new one.": "योजना हटाने से आपकी बाकी खोजबीन नहीं मिटती। आप कभी भी नई बना सकते हैं।",
  "Your plan, your pace": "आपकी योजना, आपकी रफ़्तार",
  "Made {when} · {n} step you chose": "{when} बनाई · {n} कदम आपने चुना",
  "Made {when} · {n} steps you chose": "{when} बनाई · {n} कदम आपने चुने",
  "Expand {title}": "{title} खोलें",
  "Collapse {title}": "{title} समेटें",
  "Delete plan {title}": "योजना {title} हटाएँ",
  "Steps you've finished: {done} of {total}": "आपके पूरे किए कदम: {total} में से {done}",
  "This bar only shows what you chose to do. Unfinished steps are not a grade.": "यह पट्टी सिर्फ़ वही दिखाती है जो आपने खुद चुना था। अधूरे कदम कोई नंबर नहीं हैं।",
  "No steps yet. Add one below — keep it small and doable.": "अभी कोई कदम नहीं। नीचे एक जोड़िए — छोटा और हो सके ऐसा।",
  "Not started": "शुरू नहीं हुआ",
  "Doing it now": "अभी कर रहे हैं",
  "Skipped — that's okay": "छोड़ दिया — कोई बात नहीं",
  "Mark done": "पूरा हुआ बताएँ",
  "Reopen": "फिर खोलें",
  "Delete step {title}": "कदम {title} हटाएँ",
  "Open resource": "संसाधन खोलें",
  "15 min": "15 मिनट",
  "30 min": "30 मिनट",
  "1 hour": "1 घंटा",
  "This week": "इस हफ़्ते",
  "No estimate": "कोई अनुमान नहीं",
  "Add a step": "एक कदम जोड़ें",
  "Keep it small. You can edit or remove it any time.": "इसे छोटा रखिए। आप इसे कभी भी बदल या हटा सकते हैं।",
  "What do you want to do? *": "आप क्या करना चाहते हैं? *",
  "e.g. Watch one video about how engineers work": "जैसे: इंजीनियर कैसे काम करते हैं, इस पर एक वीडियो देखना",
  "Any detail? (optional)": "कुछ और बताना है? (ज़रूरी नहीं)",
  "Why this step, or how you'll know it felt useful.": "यह कदम क्यों, या आपको कैसे पता चलेगा कि यह काम का लगा।",
  "How long might it take? (optional)": "इसमें कितना समय लग सकता है? (ज़रूरी नहीं)",
  "Add step": "कदम जोड़ें",
  "Step added to your plan.": "कदम आपकी योजना में जुड़ गया।",
  "Nice — step marked done.": "बढ़िया — कदम पूरा हुआ बताया गया।",
  "Status updated.": "स्थिति बदल गई।",
  "Step removed from your plan.": "कदम आपकी योजना से हट गया।",
  "Plan deleted.": "योजना हट गई।",
  "Your plan is ready. Edit it any way you like.": "आपकी योजना तैयार है। इसे जैसे चाहें वैसे बदलें।",
  "Start a new plan": "नई योजना शुरू करें",
  "A plan is a set of small steps you choose for yourself. It can start with one sentence about what you're curious about.": "योजना छोटे कदमों का एक सेट है जो आप खुद अपने लिए चुनते हैं। इसकी शुरुआत एक वाक्य से हो सकती है — उस चीज़ के बारे में जो आपको जानने का मन करता है।",
  "Create plan": "योजना बनाएँ",
  "What would you like to explore? *": "आप क्या जानना-परखना चाहेंगे? *",
  "For example: 'I want to find out what designing games is really like.'": "जैसे: 'मैं जानना चाहता हूँ कि गेम डिज़ाइन करना असल में कैसा होता है।'",
  "Plan title (optional)": "योजना का नाम (ज़रूरी नहीं)",
  "Leave it blank and we'll pick a friendly default.": "खाली छोड़ दीजिए, हम एक अच्छा-सा नाम रख देंगे।",
  "e.g. My game-design week": "जैसे: मेरा गेम-डिज़ाइन हफ़्ता",
  "We'll suggest a few starter steps. They are suggestions only — delete, rewrite or reorder anything once the plan is made.": "हम शुरुआत के कुछ कदम सुझाएँगे। वे सिर्फ़ सुझाव हैं — योजना बनने के बाद कुछ भी हटाइए, दोबारा लिखिए या आगे-पीछे करिए।",
};
