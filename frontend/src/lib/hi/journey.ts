/**
 * Hindi for `/app/journey`: the stats header, the day-grouped timeline and the
 * event-kind names the filter tabs use.
 *
 * The event titles and details themselves are written by the server and arrive in
 * whatever language the student was using, so they are data and are not translated
 * here — only the app's own labels around them are.
 *
 * Every entry is on one line on purpose: the two checkers in `scripts/` read this folder
 * as text, and a key wrapped onto its own line is a key they cannot see.
 */
export const HI: Record<string, string> = {
  // ------------------------------------------------------------------ the header
  "A record of everything you've explored so far — chats, questions, careers you saved, plans you started. It is a story, not a score.": "अब तक आपने जो कुछ खोजा है उसका रिकॉर्ड — बातचीत, सवाल, सेव किए करियर, शुरू की योजनाएँ। यह एक कहानी है, कोई स्कोर नहीं।",
  "Exploration, not ranking": "खोजबीन, कोई रैंकिंग नहीं",
  "How much you've explored": "आपने कितना खोजा",
  "These numbers count exploration only — not achievement, not ability, and not how good you are at anything.": "ये गिनती सिर्फ़ खोजबीन की है — न उपलब्धि की, न काबिलियत की, और न इस बात की कि आप किसी चीज़ में कितने अच्छे हैं।",
  "We couldn't load your journey stats": "आपके सफ़र के आँकड़े लोड नहीं हो सके",
  "Chats finished": "पूरी हुई बातचीत",
  "Conversations you completed": "वे बातचीत जो आपने पूरी कीं",
  "Profiles you bookmarked": "वे प्रोफ़ाइल जो आपने बुकमार्क कीं",
  "Interest areas noticed": "रुचि के क्षेत्र जो दिखे",
  "Plans going": "चालू योजनाएँ",
  "Study plans you set yourself": "पढ़ाई की योजनाएँ जो आपने खुद बनाईं",
  "Plan steps you chose to do: {done} of {total}": "वे कदम जो आपने करने चुने: {total} में से {done}",
  "Plan steps you chose to do: none yet, they come with a study plan": "वे कदम जो आपने करने चुने: अभी कोई नहीं, ये पढ़ाई की योजना के साथ आते हैं",
  "Every number here just counts things you explored. Nobody is ranked by it, and taking a break never erases anything.": "यहाँ हर गिनती बस उन चीज़ों की है जो आपने खोजीं। इससे किसी की रैंकिंग नहीं होती, और बीच में रुक जाने से कुछ भी नहीं मिटता।",

  // ---------------------------------------------------------------- the timeline
  "Your timeline": "आपकी समय-रेखा",
  "The most recent things you did, grouped by day.": "हाल ही में आपने जो किया, दिन के हिसाब से बँटा हुआ।",
  "Refresh": "ताज़ा करें",
  "Loading your timeline…": "आपकी समय-रेखा लोड हो रही है…",
  "We couldn't load your timeline": "आपकी समय-रेखा लोड नहीं हो सकी",
  "Your journey starts with one small step": "आपका सफ़र एक छोटे कदम से शुरू होता है",
  "Nothing here yet — that just means you haven't explored much so far, and that's completely fine. Talk to the AI guide or browse a few careers and they'll appear here.": "अभी यहाँ कुछ नहीं — इसका मतलब बस इतना है कि आपने अब तक ज़्यादा खोजा नहीं है, और यह बिल्कुल ठीक है। AI गाइड से बात कीजिए या कुछ करियर देखिए, वे यहाँ दिखने लगेंगे।",
  "Nothing of this type yet": "इस तरह का अभी कुछ नहीं",
  "Try another filter, or go explore something new.": "कोई और फ़िल्टर आज़माइए, या कुछ नया खोजने जाइए।",
  "Show everything": "सब दिखाएँ",
  "This timeline is only a record of what you explored. It is private to you, it never grades anything, and skipping days changes nothing.": "यह समय-रेखा सिर्फ़ आपकी खोजबीन का रिकॉर्ड है। यह आपके लिए निजी है, यह कभी कुछ नहीं आँकती, और दिन छोड़ देने से कुछ नहीं बदलता।",

  // ------------------------------------------------------- day headings and kinds
  "Today": "आज",
  "Yesterday": "कल",
  "Sometime": "कभी",
  "Conversation": "बातचीत",
  "Interest noted": "रुचि दर्ज हुई",
  "Interest question": "रुचि का सवाल",
  "Saved career": "सेव किया करियर",
  "Plan step done": "योजना का कदम पूरा",
  "Safety note": "सुरक्षा नोट",
};