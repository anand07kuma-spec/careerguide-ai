/**
 * Hindi for the public study-abroad pages — `/study-abroad`, one destination page,
 * and the enquiry form that sits at the bottom of both — plus the bare `Career`
 * heading the app's own career page shows when there is nothing to show.
 *
 * Keys are the English source text, so an untranslated string still renders — in
 * English — instead of vanishing from a child's screen.
 *
 * These are server components, so the swap happens before the HTML is sent (see
 * `lib/public-i18n.ts`), and `metadata` titles and descriptions stay English exactly
 * as on `/careers`. The form's sentences about what it stores, what it never shares
 * and whether a mail actually left are translated at the same strength as the English
 * says them — nothing promised that the server has not promised, nothing softened.
 */

export const HI: Record<string, string> = {
  // The enquiry form's own messages, most of them legal-adjacent
  "Tick the box first — nothing is stored without it.":
    "पहले बॉक्स पर टिक करें — उसके बिना कुछ भी सहेजा नहीं जाता।",
  "A name and an email address are needed to reply.": "जवाब देने के लिए नाम और ईमेल पता ज़रूरी है।",
  "The enquiry could not be sent. Check your connection and try again.":
    "पूछताछ भेजी नहीं जा सकी। अपना कनेक्शन जाँचें और फिर कोशिश करें।",
  "Your enquiry is stored. Nothing else has happened yet.":
    "आपकी पूछताछ सहेज ली गई है। अभी इसके सिवा और कुछ नहीं हुआ है।",
  "A copy has been sent to the address you gave, so check your inbox for it.":
    "आपके दिए पते पर इसकी एक प्रति भेज दी गई है, इसलिए अपने इनबॉक्स में देख लें।",
  // Says "no mail left", because on a build with no key configured none can leave.
  "No confirmation mail left this server:": "इस सर्वर से कोई पुष्टि-मेल नहीं भेजा गया:",
  "Open contact": "संपर्क पेज खोलें",
  "This enquiry will say it came from:": "इस पूछताछ में लिखा होगा कि यह कहाँ से आई है:",
  // Every negation survives: nothing booked, no date held, no outcome promised, and a reply
  // only if one comes — the conditional stays a conditional.
  "No consultation is booked by this form. No date or time is held for anyone, and no university or visa outcome is promised. If a reply comes, it comes to the address you typed.":
    "इस फ़ॉर्म से कोई काउंसलेशन बुक नहीं होता। किसी के लिए कोई तारीख़ या समय नहीं रखा जाता, और न ही किसी यूनिवर्सिटी या वीज़ा के नतीजे का वादा किया जाता है। अगर जवाब आएगा, तो उसी पते पर आएगा जो आपने लिखा है।",
  // Says nobody was mailed, because with no operator address set there was nobody to mail.
  "This deployment has no operator address configured, so nobody was mailed about it either. The /contact page is the channel that does not depend on that setting.":
    "इस डिप्लॉयमेंट पर ऑपरेटर का पता सेट नहीं है, इसलिए इस बारे में किसी को भी मेल नहीं भेजा गया। /contact पेज वह रास्ता है जो इस सेटिंग पर निर्भर नहीं करता।",
  // The one sentence the index page hands to the form as `intro`.
  "Tell us the student's class and the destination you are thinking about. A person reads every one of these; there is no auto-reply and no call centre.":
    "बताएँ कि विद्यार्थी कौन-सी कक्षा में है और आप किस देश के बारे में सोच रहे हैं। यह हर पूछताछ कोई इंसान ही पढ़ता है; यहाँ कोई ऑटो-रिप्लाई नहीं है और न कोई कॉल सेंटर है।",

  // Field labels, placeholders and hints
  "Who should we address?": "किसका नाम लिखें?",
  "Used only to reply to this enquiry. It is not added to any mailing list.":
    "इसका इस्तेमाल सिर्फ़ इस पूछताछ का जवाब देने के लिए होगा। इसे किसी मेलिंग लिस्ट में नहीं जोड़ा जाता।",
  "Phone (optional)": "फ़ोन (ज़रूरी नहीं)",
  "Only if you would rather be called. It is never shared with a university.":
    "सिर्फ़ अगर आप फ़ोन पर बात करना चाहें। यह नंबर किसी विश्वविद्यालय को कभी नहीं दिया जाता।",
  "Where the student is (optional)": "विद्यार्थी अभी कहाँ है (ज़रूरी नहीं)",
  "Not stated": "बताया नहीं गया",
  // `Select` translates every `options[].label` itself, so the stage list needs its own key.
  "Already in college": "पहले से कॉलेज में",
  "What would you like to ask? (optional)": "आप क्या पूछना चाहते हैं? (ज़रूरी नहीं)",
  "One or two sentences is enough for a first conversation.":
    "पहली बातचीत के लिए एक-दो वाक्य काफ़ी हैं।",
  "Please leave out the school name, marks, documents and any other detail that identifies the student by record. A first conversation does not need them.":
    "कृपया स्कूल का नाम, अंक, दस्तावेज़ और कोई भी ऐसी बात न लिखें जिससे विद्यार्थी का रिकॉर्ड पहचाना जा सके। पहली बातचीत में इनकी ज़रूरत नहीं होती।",
  // The consent tick — worded as the same sentence is worded in `legal.ts`.
  "You may contact me at this address about this enquiry.":
    "इस पूछताछ के बारे में आप मुझे इस पते पर संपर्क कर सकते हैं।",
  "Without this tick nothing is stored at all. The enquiry can be deleted on request — see the privacy policy.":
    "इस टिक के बिना कुछ भी सहेजा नहीं जाता। पूछताछ को कहने पर हटवाया जा सकता है — गोपनीयता नीति देखें।",
  "Send enquiry": "पूछताछ भेजें",
  // Both placeholders are the form an address or a number has to be typed in, so they
  // stay as written: `you@example.com` and `+91…` mean the same to a Hindi reader.
  "you@example.com": "you@example.com",
  "+91…": "+91…",

  // Section headings on `/study-abroad/[country]`
  "What it costs": "कितना खर्च होता है",
  "Intakes": "प्रवेश के महीने",
  "English requirements": "अंग्रेज़ी की शर्तें",
  "Visa, work rights and what changes": "वीज़ा, काम के अधिकार और क्या बदलता है",
  // Like the `/careers` search box, this placeholder lists English words: the
  // university names and cities in the directory are stored in English, so Hindi
  // suggestions would send a reader to a guaranteed empty result.
  "engineering, medicine, Melbourne": "engineering, medicine, Melbourne",

  // The heading on `/app/careers/[slug]` when the career is missing
  Career: "करियर",
};
