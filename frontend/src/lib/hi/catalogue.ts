/**
 * Hindi for `/app/resources`, the free learning-resource catalogue: its filters,
 * count line, cards and empty states.
 *
 * Resource titles, descriptions and category names come from the server and are data;
 * only the app's own labels around them live here. The few facet words below (kind and
 * level) are a closed enum the backend writes, so translating them is safe.
 *
 * Every entry is on one line on purpose: the two checkers in `scripts/` read this folder
 * as text, and a key wrapped onto its own line is a key they cannot see.
 */
export const HI: Record<string, string> = {
  "Free Learning Resources": "मुफ़्त सीखने के संसाधन",
  "Hand-picked free things to try — videos, activities and sites. They are starting points for exploring, not homework or a test.": "चुनी हुई मुफ़्त चीज़ें आज़माने के लिए — वीडियो, गतिविधियाँ और साइटें। ये खोजबीन की शुरुआत हैं, होमवर्क या टेस्ट नहीं।",
  "Publicly available resources to explore careers and skills for free. These are starting points to look into, not a ranked or complete list.": "करियर और स्किल मुफ़्त में खोजने के लिए सार्वजनिक रूप से उपलब्ध संसाधन। ये देखने की शुरुआत हैं, कोई रैंकिंग वाली या पूरी सूची नहीं।",
  "Sample catalogue": "नमूना कैटलॉग",
  "Search resources, e.g. coding, pilot, Hindi": "संसाधन खोजें, जैसे कोडिंग, पायलट, हिन्दी",
  "Search resources": "संसाधन खोजें",
  "All categories": "सभी श्रेणियाँ",
  "Filter by category": "श्रेणी से छाँटें",
  "Type": "क़िस्म",
  "All types": "सभी क़िस्में",
  "Any language": "कोई भी भाषा",
  "Filter by language": "भाषा से छाँटें",
  "Most resources are in English. Only {hi} of {total} are in Hindi so far.": "ज़्यादातर संसाधन अंग्रेज़ी में हैं। अभी {total} में से सिर्फ़ {hi} हिन्दी में हैं।",
  "Most resources are in English; Hindi content is still limited.": "ज़्यादातर संसाधन अंग्रेज़ी में हैं; हिन्दी सामग्री अभी सीमित है।",
  "These are publicly available starting points. Links and page contents can change at any time, so always check the page that actually opens.": "ये सार्वजनिक रूप से उपलब्ध शुरुआती बिंदु हैं। लिंक और पेज की सामग्री कभी भी बदल सकती है, इसलिए जो पेज असल में खुले उसे हमेशा जाँच लें।",
  "No resources match these filters": "इन फ़िल्टर से कोई संसाधन मेल नहीं खाता",
  "No resources found yet": "अभी कोई संसाधन नहीं मिला",
  "Try a different search term, or clear the filters to see the full sample list.": "कोई और शब्द आज़माइए, या पूरी नमूना सूची देखने के लिए फ़िल्टर हटा दीजिए।",
  "The resource library is empty right now. Please check back soon.": "संसाधन लाइब्रेरी अभी ख़ाली है। कृपया जल्द ही दोबारा देखें।",
  "Showing {n} resource.": "{n} संसाधन दिख रहा है।",
  "Showing {n} resources.": "{n} संसाधन दिख रहे हैं।",
  "Showing {n} resource with your filters.": "आपके फ़िल्टर से {n} संसाधन दिख रहा है।",
  "Showing {n} resources with your filters.": "आपके फ़िल्टर से {n} संसाधन दिख रहे हैं।",
  "about {n} minute": "लगभग {n} मिनट",
  "about {n} minutes": "लगभग {n} मिनट",
  "Show more resources": "और संसाधन दिखाएँ",

  // ------------------------------------------- closed enums the backend writes
  Video: "वीडियो",
  Article: "लेख",
  Activity: "गतिविधि",
  Website: "वेबसाइट",
  Course: "कोर्स",
  Pdf: "पीडीएफ़",
  Interactive: "इंटरैक्टिव",
  Beginner: "शुरुआती",
  Intermediate: "मध्यम",
  Advanced: "उन्नत",
};