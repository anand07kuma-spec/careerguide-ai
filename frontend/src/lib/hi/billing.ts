/**
 * Hindi for the billing & plan screen: the plan a family is on, what it covers, the
 * payment history, and the controls to renew or drop back to the free plan.
 *
 * Keys are the English source text, so an untranslated string still renders — in
 * English — instead of vanishing from a child's screen.
 */

export const HI: Record<string, string> = {
  "Billing & plan": "बिलिंग और प्लान",
  "What you are on, what it covers, and every payment this account has made.":
    "आप किस प्लान पर हैं, उसमें क्या-क्या आता है, और इस अकाउंट ने किए गए हर भुगतान का पूरा ब्यौरा।",
  "Used so far": "अभी तक इस्तेमाल",
  "Chats today": "आज की चैट",
  "Chats left today": "आज बची चैट",
  "Questionnaires finished": "पूरे किए प्रश्न-पत्र",
  "Next payment": "अगला भुगतान",
  // "one" here = a next payment; the card sits directly under the "Next payment" title.
  "There isn't one, and that is the design.":
    "नहीं है — और यही इसे जान-बूझकर इस तरह बनाया गया है।",
  "Every order this account has made, paid or not.":
    "इस अकाउंट ने जो हर ऑर्डर किए, चाहे उनका भुगतान हुआ हो या न हुआ हो।",
  "You are on the free plan now.": "अब आप फ़्री प्लान पर हैं।",
  "Test mode — no real money": "टेस्ट मोड — असली पैसा नहीं",
  "See the plans": "प्लान देखें",
  "Loading your plan": "आपका प्लान लोड हो रहा है",
  "Your billing details could not be read.": "आपकी बिलिंग की जानकारी नहीं पढ़ी जा सकी।",
  "Current plan": "मौजूदा प्लान",
  // source = "payment": an adult on this account/device paid for it.
  "Bought by an adult here": "यहाँ के किसी अभिभावक ने खरीदा",
  "Licence granted to you": "आपको दिया गया लाइसेंस",
  "Free plan": "फ़्री प्लान",
  "Shared from family": "परिवार से शेयर किया गया",
  "Until": "यह तारीख़ तक",
  "No end date, nothing to pay": "कोई समाप्ति तारीख़ नहीं, देने को कुछ नहीं",
  // source = "granted" with no end date: the licence does not expire by itself.
  "Does not lapse on its own": "अपने आप ख़त्म नहीं होता",
  "Last paid plan:": "आख़िरी पेड प्लान:",
  "This plan renews": "यह प्लान दोबारा चालू होगा",
  "only if you pay again": "सिर्फ़ तब, जब आप दोबारा भुगतान करें",
  "Renew for another period": "एक और अवधि के लिए दोबारा भुगतान करें",
  "Choose a paid plan": "कोई पेड प्लान चुनें",
  "Switch to the free plan": "फ़्री प्लान पर जाएँ",
  "Unlimited": "असीमित",
  "Period ends": "अवधि ख़त्म होती है",
  "Receipt": "रसीद",
  // appended to a payment row that carries test_mode.
  test: "टेस्ट",
  "Refunds follow the": "रिफ़ंड इनके अनुसार होते हैं —",
  "refund policy": "रिफ़ंड पॉलिसी",
  "Your plan is unlocked.": "आपका प्लान अनलॉक हो गया।",
  "Switch to the free plan?": "फ़्री प्लान पर जाएँ?",
  "Keep my plan": "मेरा प्लान रहने दें",
  "Switch to free": "फ़्री पर जाएँ",
  "Given up:": "छोड़ना होगा:",
  "printable PDF reports": "छपने लायक PDF रिपोर्ट",
  "the parent dashboard": "अभिभावक डैशबोर्ड",
  "unlimited chats": "असीमित चैट",
  "every questionnaire, repeatable": "हर प्रश्न-पत्र, दोबारा भी",
  "nothing, because this plan is not capped": "कुछ नहीं, क्योंकि इस प्लान पर कोई सीमा नहीं",
  "{days} days left": "{days} दिन बचे",
  "{used} of {allowed}": "{allowed} में से {used}",
  "{n} left": "{n} बचे",
  "{n} so far": "अभी तक {n}",
  "{n} chats a day": "रोज़ {n} चैट",
  "{n} questionnaires in total": "कुल {n} प्रश्न-पत्र",
  "The period you already paid for would have lasted until {date}.":
    "जिस अवधि के लिए आपने पहले ही भुगतान कर दिया था, वह {date} तक चलती।",
  "Paid and unlocked": "भुगतान हुआ, अनलॉक हो गया",
  "Started, not paid yet": "शुरू हुआ, भुगतान अभी नहीं",
  "Did not go through": "भुगतान नहीं हो पाया",
  "The caps the server applies to this plan.": "वे सीमाएँ जो सर्वर इस प्लान पर लागू करता है।",
  "The caps this plan publishes. This server is not enforcing them yet.":
    "इस प्लान की बताई गई सीमाएँ। सर्वर इन्हें अभी लागू नहीं कर रहा।",
  // In the source these paragraphs are one t() call whose text is split across
  // lines with +, so the runtime key is the whole joined sentence on one line.
  "The paid period on this account has ended, so the account is back on the free plan with its limits. Nothing that was already made has been taken away — conversations, results and reports you generated are still there.":
    "इस अकाउंट की पेड अवधि ख़त्म हो गई है, इसलिए अकाउंट वापस फ़्री प्लान पर आ गया है और उसकी अपनी सीमाएँ फिर से लागू हैं। पहले से बना हुआ कुछ भी छीना नहीं गया — आपकी चैट, रिज़ल्ट और बनाई गई रिपोर्ट्स जैसी थीं वैसी ही बची हैं।",
  "This paid period was bought on another account in the same family. Its end date is the one shown above, and nobody can unlock it by editing anything in this browser — the server worked it out from the payment it holds.":
    "यह पेड अवधि इसी परिवार के दूसरे अकाउंट पर खरीदी गई थी। इसकी ख़त्म होने की तारीख़ वही है जो ऊपर दिख रही है, और इस ब्राउज़र में कुछ भी बदलकर कोई इसे अनलॉक नहीं कर सकता — सर्वर ने अपने पास पड़े भुगतान से ही यह निकाला है।",
  "Payment is not switched on for this deployment, so the button above that would take a card is disabled rather than dead.":
    "इस डिप्लॉयमेंट पर पेमेंट चालू नहीं है, इसलिए ऊपर वाला बटन, जो कार्ड लेता, जान-बूझकर बंद है — टूटा हुआ नहीं।",
  "Nothing on this screen takes a card. Online payment is not switched on for this deployment, so the paid plans are described rather than sold.":
    "इस पेज पर कुछ भी आपका कार्ड नहीं लेता। इस डिप्लॉयमेंट पर ऑनलाइन पेमेंट चालू नहीं है, इसलिए पेड प्लान बेचने के लिए नहीं, सिर्फ़ समझाने के लिए लिखे गए हैं।",
  "Counts are read from the conversations and results this account actually has, and a chat day turns over at midnight in India rather than in Greenwich.":
    "गिनती इस अकाउंट की सच में मौजूद चैट और रिज़ल्ट से पढ़ी जाती है, और चैट का दिन भारत में आधी रात को बदलता है, ग्रीनविच में नहीं।",
  "A payment here buys a period with an end date. Nothing charges again by itself, so there is no next billing date to show and nothing to cancel. When the period ends the account moves to the free plan, and renewing is a deliberate click.":
    "यहाँ भुगतान करने पर एक तय तारीख़ तक चलने वाली अवधि मिलती है। कुछ भी अपने आप दोबारा चार्ज नहीं होता, इसलिए न दिखाने को कोई अगली बिलिंग तारीख़ है, न रद्द करने को कुछ। अवधि ख़त्म होने पर अकाउंट फ़्री प्लान पर चला जाता है, और दोबारा चालू करने के लिए जान-बूझकर बटन दबाना पड़ता है।",
  "No payment has been made on this account. That is not a failure to load — the list is empty because nothing was charged.":
    "इस अकाउंट पर अभी तक कोई भुगतान नहीं हुआ है। यह लोड न होने की दिक्कत नहीं है — सूची खाली है क्योंकि कुछ भी चार्ज नहीं हुआ।",
  "These rows hold an order id, a payment id, an amount and a receipt. They hold no card number, no expiry, no CVV and no cardholder name — that part of a payment stays with Razorpay, which is the reason a database here that also holds children's answers could never leak a card.":
    "इन पंक्तियों में ऑर्डर आईडी, पेमेंट आईडी, रक़म और रसीद हैं। इनमें न कार्ड नंबर है, न एक्सपायरी, न CVV, न कार्डधारक का नाम — भुगतान का यह हिस्सा Razorpay के पास ही रहता है, इसीलिए यहाँ का डेटाबेस, जो बच्चों के जवाब भी रखता है, कार्ड की जानकारी कभी लीक नहीं कर सकता।",
  "This stops the paid period early. It does not delete anything you made, and it cannot be undone by this page — you would have to pay for a new period to get the features back.":
    "इससे पेड अवधि जल्दी रुक जाएगी। यह आपके बनाए हुए कुछ भी डिलीट नहीं करती, और इस पेज से इसे वापस नहीं लाया जा सकता — फ़ीचर वापस पाने के लिए आपको नई अवधि का भुगतान दोबारा करना होगा।",
};
