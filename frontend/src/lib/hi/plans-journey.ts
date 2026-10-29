/**
 * Hindi for the three student screens that look back instead of forward: the plans a
 * student set for themselves, the journey record of chats, saved careers and finished
 * steps, and the one-page report a student shows a parent or a teacher.
 *
 * Two promises run through these strings and stay exactly as explicit in Hindi as they
 * are in English: an activity is something to try, never homework and never a score,
 * and a report says only what the guide actually heard from the student plus what is
 * still unverified.
 *
 * Keys are the English source text, so an untranslated string still renders — in
 * English — instead of vanishing from a child's screen.
 */
export const HI: Record<string, string> = {
  // ------------------------------------------------------------------- my journey
  "A record of everything you've explored so far — chats, questions, careers you saved, plans you started. It is a story, not a score.":
    "आपने अब तक जो कुछ देखा, उसका रिकॉर्ड — चैट, सवाल, सेव किए करियर, शुरू किए प्लान। यह एक कहानी है, स्कोर नहीं।",
  "How much you've explored": "आपने कितना कुछ देखा है",
  "These numbers count exploration only — not achievement, not ability, and not how good you are at anything.":
    "ये आँकड़े सिर्फ़ इतना गिनते हैं कि आपने कितना कुछ देखा — न आपकी उपलब्धि, न आपकी काबिलियत, न यह कि आप किसी काम में कितने अच्छे हैं।",
  "We couldn't load your journey stats": "आपकी यात्रा के आँकड़े नहीं खुल सके",
  "Chats finished": "पूरी हुई चैट",
  "Plans going": "चलते प्लान",
  // The timeline and the journal are the same list on this screen, and `common.ts`
  // already calls that list डायरी, so the heading keeps that one word.
  "Your timeline": "आपकी डायरी",
  "The most recent things you did, grouped by day.": "आपके सबसे हाल के काम, दिन के हिसाब से सजे हुए।",
  "Loading your timeline…": "आपकी डायरी खुल रही है…",
  "We couldn't load your timeline": "आपकी डायरी नहीं खुल सकी",
  "Your journey starts with one small step": "आपकी यात्रा एक छोटे से कदम से शुरू होती है",
  "Nothing here yet — that just means you haven't explored much so far, and that's completely fine. Talk to the AI guide or browse a few careers and they'll appear here.":
    "यहाँ अभी कुछ नहीं — इसका मतलब बस इतना है कि आपने अब तक ज़्यादा कुछ नहीं देखा, और यह बिल्कुल ठीक है। AI गाइड से बात करें या कुछ करियर देखें, वे यहाँ आ जाएँगे।",
  "Nothing of this type yet": "इस प्रकार का अभी कुछ नहीं",
  "Try another filter, or go explore something new.": "दूसरा फ़िल्टर चुनें, या जाकर कुछ नया देखें।",
  // `ProgressBar` runs its `label` through `t()`, so both forms of this caption are
  // dictionary strings rather than page text.
  "Plan steps you chose to do: none yet, they come with a study plan":
    "आपने चुनकर किए प्लान के कदम: अभी कोई नहीं, वे पढ़ाई के प्लान के साथ आते हैं",
  "Plan steps you chose to do: {done} of {total}":
    "आपने चुनकर किए प्लान के कदम: {total} में से {done}",

  // --------------------------------------------------------- study & skill plans
  "Plans you set for yourself, about things you're curious about. Change, shorten or drop them any time — nothing here is assigned by a teacher or an algorithm.":
    "प्लान आपने ख़ुद के लिए चुने हैं, उन्हीं चीज़ों पर जिनमें आपकी जिज्ञासा है। इन्हें कभी भी बदलें, छोटा करें या हटा दें — यहाँ कोई काम न टीचर ने दिया है, न किसी एल्गोरिदम ने।",
  "We couldn't load your plans": "आपके प्लान नहीं खुल सके",
  "No plans yet": "अभी कोई प्लान नहीं",
  "A plan is just a list of small things you'd like to try next — you decide what goes in it and how fast you move.":
    "प्लान बस छोटी-छोटी उन चीज़ों की सूची है जो आप आगे आज़माना चाहते हैं — उसमें क्या जाएगा और आप कितनी रफ़्तार से चलेंगे, यह आप तय करते हैं।",
  "What do you want to do? *": "आप क्या करना चाहते हैं? *",
  "e.g. Watch one video about how engineers work": "जैसे: एक वीडियो देखें कि इंजीनियर काम कैसे करते हैं",
  "Any detail? (optional)": "कोई और बात? (ज़रूरी नहीं)",
  "Why this step, or how you'll know it felt useful.": "यह कदम क्यों, या कैसे पता चलेगा कि यह काम आया।",
  "How long might it take? (optional)": "इसमें कितना समय लग सकता है? (ज़रूरी नहीं)",
  "No estimate": "कोई अनुमान नहीं",
  "Start a new plan": "नया प्लान शुरू करें",
  "A plan is a set of small steps you choose for yourself. It can start with one sentence about what you're curious about.":
    "प्लान छोटे-छोटे कदमों का सेट है, जो आप ख़ुद चुनते हैं। यह एक वाक्य से भी शुरू हो सकता है कि आपको किस चीज़ में जिज्ञासा है।",
  "What would you like to explore? *": "आप क्या खोजना चाहते हैं? *",
  "Plan title (optional)": "प्लान का नाम (ज़रूरी नहीं)",
  "e.g. My game-design week": "जैसे: मेरा गेम-डिज़ाइन का हफ़्ता",
  // The status and effort pickers are plain arrays, and `Select` runs each
  // `options[].label` through `t()` itself, so these labels are translatable here.
  "Not started": "शुरू नहीं किया",
  "Doing it now": "अभी कर रहे हैं",
  "This week": "इस हफ़्ते",
  "Step added to your plan.": "कदम आपके प्लान में जुड़ गया।",
  "Step removed from your plan.": "कदम आपके प्लान से हटा दिया गया।",
  "Your plan is ready. Edit it any way you like.": "आपका प्लान तैयार है। इसे जैसे चाहें वैसा बदलें।",
  "Delete this plan?": "यह प्लान हटाएँ?",
  "Delete this step?": "यह कदम हटाएँ?",
  "For example: 'I want to find out what designing games is really like.'":
    "जैसे: 'मुझे जानना है कि गेम डिज़ाइन करना असल में कैसा होता है।'",
  "Leave it blank and we'll pick a friendly default.":
    "ख़ाली छोड़ दीजिए, हम ख़ुद एक आसान सा नाम रख देंगे।",

  // ------------------------------------------------------------- career report
  "My Career Report": "मेरी करियर रिपोर्ट",
  "An exploratory summary of what you have shared so far. It is not a prediction, an assessment or a verdict about you.":
    "आपने अब तक जो बताया, उसका एक सारांश — जो आगे खोजने के लिए है। यह न आपके बारे में कोई अनुमान है, न आकलन, न फ़ैसला।",
  "No report yet": "अभी कोई रिपोर्ट नहीं",
  "A report needs a few conversations or interest answers first. Talk with your guide or note what you enjoy, then come back and generate it here.":
    "रिपोर्ट के लिए पहले कुछ बातचीत या रुचि के जवाब चाहिए। अपने गाइड से बात करें या जो चीज़ें आपको अच्छी लगती हैं उन्हें नोट करें, फिर लौटकर यहाँ रिपोर्ट बनाएँ।",
  "Themes we noticed": "जो विषय हमें दिखे",
  "Patterns from what you shared — not labels or limits.": "आपने जो बताया, उसी से ये पैटर्न बने हैं — न इनमें कोई लेबल है, न कोई हद।",
  "Things you mentioned enjoying": "आपकी बताई पसंद की चीज़ें",
  "Careers you named": "आपने जो करियर बताए",
  "Naming a job you're curious about now is completely normal — and it is allowed to change later. Nothing here is locked in.":
    "अभी जिस काम के बारे में जानना चाहते हैं उसका नाम बताना बिल्कुल आम बात है — और आगे चलकर वह बदल भी सकता है। यहाँ कुछ भी पक्का नहीं लिखा गया।",
  "Fields worth exploring": "जो फ़ील्ड देखने लायक हैं",
  "These are directions to look into based on what you've said — not recommendations about who you should become.":
    "ये दिशाएँ आपके कहने पर टिकी हैं, इन्हें आगे देखा जा सकता है — ये यह नहीं बता रहीं कि आपको कौन बनना चाहिए।",
  "Careers you saved": "आपके सेव किए करियर",
  "Small experiments to try": "आज़माने के छोटे काम",
  "Low-pressure ways to test what actually interests you.": "बिना किसी दबाव के तरीके, जिनसे पता चले कि आपको असल में क्या रुचि देता है।",
  "Suggested next steps": "आगे के सुझाए कदम",
  "About costs and support": "खर्चे और मदद के बारे में",
  "What we still don't know": "जो बातें हमें अब तक नहीं पता",
  "This part is just as important as the rest. These gaps are normal, not a problem with you.":
    "यह हिस्सा उतना ही अहम है जितना बाक़ी सब। जो बातें अभी छूटी हैं वे आम हैं — इसमें आपकी कोई कमी नहीं।",
  "What this report cannot do": "यह रिपोर्ट क्या नहीं कर सकती",
  "Generate a fresh report?": "एकदम नई रिपोर्ट बनाएँ?",
  "This creates a new report from what you've shared so far and replaces the one you're viewing.":
    "इससे अब तक आपके बताए से एक नई रिपोर्ट बनेगी, और जो रिपोर्ट आप अभी देख रहे हैं वह बदल जाएगी।",
  "Delete this report?": "यह रिपोर्ट हटाएँ?",
  "This removes the report from your account. It cannot be undone from here.":
    "इससे आपके अकाउंट से यह रिपोर्ट हट जाएगी। यहाँ से यह वापस नहीं किया जा सकता।",
  "Your report has been refreshed.": "आपकी रिपोर्ट दोबारा बना दी गई है।",
  "This report has been deleted.": "यह रिपोर्ट हटा दी गई है।",
};
