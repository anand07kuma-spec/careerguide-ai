/**
 * Hindi for `/app/institutes`: the sponsorship disclosure, the filters, the count
 * line, the institute cards and the questions to ask before joining.
 *
 * Institute names, cities, states, career areas, course names, fee ranges and
 * admission notes are server data — they arrive in whatever language they were
 * written in and are not translated here. Only the app's own labels around them
 * live in this file, plus the closed type/mode/education-level enums the page
 * prettifies for display.
 *
 * Every entry is on one line on purpose: the two checkers in `scripts/` read this folder
 * as text, and a key wrapped onto its own line is a key they cannot see.
 */
export const HI: Record<string, string> = {
  // ------------------------------------------------------------------ the header
  "A sample directory of places to look into. Listings are not verified or ranked, and some are sponsored partnerships — compare every institute yourself.": "देखने लायक जगहों की एक नमूना डायरेक्टरी। लिस्टिंग न जाँची गई हैं, न रैंक की गई हैं, और कुछ प्रायोजित साझेदारियाँ हैं — हर संस्थान की तुलना आप ख़ुद कीजिए।",
  "Sample directory": "नमूना डायरेक्टरी",

  // ------------------------------------------------------ sponsorship disclosure
  "About these listings": "इन लिस्टिंग के बारे में",
  "Some entries below are sponsored partnerships. A sponsored badge is always shown, and the order here is not a ranking.": "नीचे कुछ एंट्री प्रायोजित साझेदारियाँ हैं। प्रायोजित बैज हमेशा दिखता है, और यहाँ का क्रम कोई रैंकिंग नहीं है।",
  "Sponsorship never changes a career recommendation anywhere in this app.": "प्रायोजन इस ऐप में कहीं भी करियर की सलाह नहीं बदलता।",
  "Free, government and aided institutes get no promotional treatment either — you should compare all of them on your own terms.": "मुफ़्त, सरकारी और एडेड संस्थानों को भी कोई प्रचार-विशेष नहीं मिलता — आप सभी की तुलना अपनी शर्तों पर कीजिए।",

  // -------------------------------------------------------------------- filters
  "Search institutes": "संस्थान खोजें",
  "Filter by career area": "करियर क्षेत्र से छाँटें",
  "All states": "सभी राज्य",
  "All career areas": "सभी करियर क्षेत्र",
  "Mode": "पढ़ाई का माध्यम",
  "Any mode": "कोई भी माध्यम",

  // ------------------------------------------------------- results and empty states
  "No institutes match these filters": "इन फ़िल्टर से कोई संस्थान मेल नहीं खाता",
  "No institutes found yet": "अभी कोई संस्थान नहीं मिला",
  "Try a different state, career area or type, or clear the filters to see the sample list.": "कोई दूसरा राज्य, करियर क्षेत्र या क़िस्म आज़माइए, या नमूना सूची देखने के लिए फ़िल्टर हटा दीजिए।",
  "The institute directory is empty right now. Please check back soon.": "संस्थान डायरेक्टरी अभी ख़ाली है। कृपया जल्द ही दोबारा देखें।",
  "Showing {n} institute.": "{n} संस्थान दिख रहा है।",
  "Showing {n} institutes.": "{n} संस्थान दिख रहे हैं।",
  "Showing {n} institute with your filters.": "आपके फ़िल्टर से {n} संस्थान दिख रहा है।",
  "Showing {n} institutes with your filters.": "आपके फ़िल्टर से {n} संस्थान दिख रहे हैं।",
  "Order here is not a ranking.": "यहाँ का क्रम कोई रैंकिंग नहीं है।",
  "Show more institutes": "और संस्थान दिखाएँ",

  // ----------------------------------------------------------------- the cards
  "Sponsored partner": "प्रायोजित साझेदार",
  "Courses listed": "कोर्स की सूची",
  "Fees": "फ़ीस",
  "Admission": "एडमिशन",

  // ------------------------------------------- closed enums the backend writes
  // "Diploma / ITI", "Undergraduate" and "Postgraduate" already live in scholarships.ts.
  "Public / Government": "सरकारी / पब्लिक",
  "Private": "प्राइवेट",
  "Aided": "एडेड",
  "Deemed university": "डीम्ड यूनिवर्सिटी",
  "Online": "ऑनलाइन",
  "In person": "आमने-सामने",
  "Hybrid": "हाइब्रिड",
  "Distance": "डिस्टेंस",
  "School": "स्कूल",
  "Training centre": "ट्रेनिंग सेंटर",

  // -------------------------------------------- questions to ask before joining
  "Questions to ask any institute before you join": "दाख़िले से पहले किसी भी संस्थान से पूछने वाले सवाल",
  "Take these to the admission office or a current student. The answers matter more than any brochure.": "ये सवाल एडमिशन ऑफ़िस या वहाँ पढ़ रहे किसी विद्यार्थी से पूछिए। जवाब किसी भी ब्रोशर से ज़्यादा मायने रखते हैं।",
  "Is this institute and this specific course recognised or accredited, and by whom — can I check that body's own list?": "क्या यह संस्थान और यह ख़ास कोर्स मान्यता प्राप्त या एक्रेडिटेड है, और किस निकाय से — क्या उस निकाय की अपनी सूची से इसकी जाँच हो सकती है?",
  "What is the total fee for the whole course, and what extra costs (forms, labs, exams, materials) are not in the headline number?": "पूरे कोर्स की कुल फ़ीस कितनी है, और कौन-से अतिरिक्त ख़र्च (फ़ॉर्म, लैब, परीक्षा, सामग्री) उस बताई गई रक़म में शामिल नहीं हैं?",
  "What is available for hostel and daily travel, and what does each actually cost per month?": "हॉस्टल और रोज़ के आने-जाने की क्या सुविधा है, और हर एक का असली ख़र्च महीने में कितना बैठता है?",
  "Who teaches the course, and what are their qualifications and how long have they taught here?": "कोर्स कौन पढ़ाता है, उनकी योग्यता क्या है, और वे यहाँ कितने समय से पढ़ा रहे हैं?",
  "Where do past students of this exact course actually work or study now — can I speak to a few of them directly?": "इसी कोर्स के पुराने विद्यार्थी अभी असल में कहाँ काम या पढ़ाई कर रहे हैं — क्या उनमें से कुछ से सीधे बात हो सकती है?",
  "Courses, fees & admission": "कोर्स, फ़ीस और एडमिशन",
};