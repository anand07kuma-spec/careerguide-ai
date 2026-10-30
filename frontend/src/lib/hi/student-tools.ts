/** Hindi for the two student browse screens — the Institutes & Courses directory
 * and the Free Learning Resources library — the copy that catalogue.ts did not
 * already own: the card headings, the sponsored-listing honesty statements, the
 * results count line, the empty-state titles, the enum labels behind the type /
 * mode / level chips and cards, and the "questions to ask" list.
 *
 * Keys are the exact English source text (placeholders included), so a string
 * nobody translated still renders — in English — rather than vanishing from the
 * child's screen. Many of the shared labels on these two screens — `Search
 * institutes`, `Filter by state`, `Any language`, `All categories`, `Clear
 * filters`, `Clear search`, `Scholarships`, `In person`, `Private`, `English`,
 * `Hindi`, `Open`, `with your filters`, the empty-state descriptions and the
 * one-line Hindi-coverage note — already live in `catalogue.ts`, `common.ts`,
 * `dashboard.ts` and `portal.ts`. They are deliberately NOT re-added here: the
 * merge in `index.ts` lets a later file silently win, and a second, different
 * entry would change the word on some other screen. The screens now pass those
 * strings through `t()`, so their existing entries finally get used.
 *
 * What stays English on purpose:
 * - institute names, city/state, course titles, fee/admission/scholarship text,
 *   career-area tags, resource titles/descriptions/kind/category/level and the
 *   backend `sponsorship_disclosure` — all catalogue data the API returns, which
 *   each screen already labels as a sample rather than a live feed;
 * - the `Search resources, e.g. coding, pilot, Hindi`, `All categories` and
 *   `Any language` control placeholders, which `Input`/`Select` run through `t`
 *   themselves — the screens mark them `hi-coverage:ignore` rather than wrap
 *   them twice;
 * - a language code that is neither `en` nor `hi` (`titleCase` of the raw value)
 *   — untranslated catalogue data, so it prints as it does in English.
 */

export const HI: Record<string, string> = {
  // Institutes & Courses — screen badge, card headings and the sponsored honesty.
  "Sample directory": "नमूना डायरेक्टरी",
  "Sponsored partner": "प्रायोजित साझेदार",
  "Courses listed": "लिस्ट किए गए कोर्स",
  "Type": "टाइप",
  "Mode": "मोड",
  "Fees": "फ़ीस",
  "Admission": "दाखिला",
  "Website": "वेबसाइट",
  "Sponsorship never changes a career recommendation anywhere in this app.":
    "प्रायोजन इस ऐप में कहीं भी करियर की सिफ़ारिश नहीं बदलता।",
  "Free, government and aided institutes get no promotional treatment either — you should compare all of them on your own terms.":
    "मुफ़्त, सरकारी और सहायता प्राप्त संस्थानों को भी कोई प्रचार-सुविधा नहीं मिलती — अपनी शर्तों पर हर एक की तुलना ख़ुद करें।",
  "Order here is not a ranking.": "यहाँ का क्रम कोई रैंकिंग नहीं है।",

  // Institutes — empty states and the results count line.
  "No institutes match these filters": "इन फ़िल्टर से कोई संस्थान नहीं मिला",
  "No institutes found yet": "अभी कोई संस्थान नहीं मिला",
  "Showing 1 institute": "1 संस्थान दिख रहा है",
  "Showing {n} institutes": "{n} संस्थान दिख रहे हैं",

  // Questions to ask any institute before you join — phrased as questions, never claims.
  "Is this institute and this specific course recognised or accredited, and by whom — can I check that body's own list?":
    "क्या यह संस्थान और यह खास कोर्स मान्यताप्राप्त या एक्रिटेड हैं, और किसने दी है — क्या उस संस्था की अपनी सूची से इसे जाँचा जा सकता है?",
  "What is the total fee for the whole course, and what extra costs (forms, labs, exams, materials) are not in the headline number?":
    "पूरे कोर्स की कुल फ़ीस कितनी है, और कौन-से अतिरिक्त खर्च (फ़ॉर्म, लैब, एग्ज़ाम, सामग्री) उस मुख्य आँकड़े में शामिल नहीं हैं?",
  "What is available for hostel and daily travel, and what does each actually cost per month?":
    "हॉस्टल और रोज़मर्रा की आवाजाही के लिए क्या उपलब्ध है, और हर एक का महीने का असली खर्च कितना है?",
  "Who teaches the course, and what are their qualifications and how long have they taught here?":
    "कौन-कौन यह कोर्स पढ़ाते हैं, उनकी क्वालिफ़िकेशन क्या है, और वे यहाँ कितने समय से पढ़ा रहे हैं?",
  "Where do past students of this exact course actually work or study now — can I speak to a few of them directly?":
    "इसी कोर्स के पुराने छात्र अभी कहाँ काम या पढ़ाई कर रहे हैं — क्या मैं उनमें से कुछ से सीधे बात कर सकता हूँ?",

  // Institutes — the enum labels the type / mode / level chips and cards show.
  // `In person` and `Private` already live in `catalogue.ts` and `portal.ts` and are left to them.
  "Public / Government": "सार्वजनिक / सरकारी",
  "Aided": "सहायता प्राप्त",
  "Deemed university": "डेम्ड यूनिवर्सिटी",
  "Online": "ऑनलाइन",
  "Hybrid": "हाइब्रिड",
  "Distance": "डिस्टेंस",
  "School": "स्कूल",
  "Diploma / ITI": "डिप्लोमा / आईटीआई",
  "Undergraduate": "स्नातक",
  "Postgraduate": "स्नातकोत्तर",
  "Training centre": "प्रशिक्षण केंद्र",

  // The "select all" chips that lead each filter group.
  "All types": "सभी टाइप",
  "Any mode": "कोई भी मोड",
  "All states": "सभी राज्य",
  "All career areas": "सभी करियर क्षेत्र",

  // Free Learning Resources — badge, the honest starting-points note, and states.
  "Sample catalogue": "नमूना कैटलॉग",
  "These are publicly available starting points. Links and page contents can change at any time, so always check the page that actually opens.":
    "ये सबको खुले शुरुआती संसाधन हैं। लिंक और पेज का कंटेंट कभी भी बदल सकता है, इसलिए जो पेज सच में खुलता है उसे हमेशा ख़ुद जाँचें।",
  "No resources match these filters": "इन फ़िल्टर से कोई संसाधन नहीं मिला",
  "No resources found yet": "अभी कोई संसाधन नहीं मिला",
  "Showing 1 resource": "1 संसाधन दिख रहा है",
  "Showing {n} resources": "{n} संसाधन दिख रहे हैं",
  // The count sentence carries two numbers, so the placeholders travel inside the key
  // and Hindi can order them its own way ({h} of {t} → "{t} में से {h}").
  "Most resources are in English. Only {h} of {t} are in Hindi so far.":
    "ज़्यादातर संसाधन अंग्रेज़ी में हैं। अभी {t} में से केवल {h} हिन्दी में हैं।",
  // Duration pill. Singular and plural share the shape; Hindi does not inflect "मिनट".
  "about {n} minute": "लगभग {n} मिनट",
  "about {n} minutes": "लगभग {n} मिनट",
};
