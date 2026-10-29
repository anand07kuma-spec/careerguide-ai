/**
 * Hindi for the public pricing screen and its parts: the plan cards, the checkout
 * dialog and the comparison table.
 *
 * Keys are the English source text, so an untranslated string still renders — in
 * English — instead of vanishing from a child's screen.
 *
 * Prices, periods and limits are read from the server and never typed into these
 * files, so no entry here names an amount, a number of days or a capability the
 * English does not already claim — including whether a plan can be bought at all
 * on this deployment, which the screen says honestly and the Hindi keeps saying.
 */

export const HI: Record<string, string> = {
  // ---- Pricing page: frame, headings, loading and error states
  "Plans and pricing": "प्लान और कीमत",
  "CareerGuide AI home": "CareerGuide AI होम",
  "The conversation can cost money. The information cannot.":
    "बातचीत के पैसे लग सकते हैं। जानकारी के कभी नहीं।",
  "Loading the price list": "कीमतों की सूची लोड हो रही है",
  "The price list could not be read": "कीमतों की सूची नहीं पढ़ी जा सकी",
  "This page shows the server's own prices, and the server is not answering.":
    "यह पेज सर्वर की अपनी कीमतें दिखाता है, और सर्वर जवाब नहीं दे रहा।",
  "Answer the first question, then choose a plan.": "पहला सवाल जवाब दीजिए, फिर प्लान चुनें।",

  // ---- Pricing page: section headings
  "Both prices stay on the page. This only chooses which one comes first.":
    "दोनों कीमतें पेज पर रहती हैं। यह सिर्फ़ तय करता है कि कौन सी पहले दिखे।",
  "What each plan includes": "हर प्लान में क्या शामिल है",
  "Four things that do not change with a plan": "चार बातें जो प्लान से नहीं बदलतीं",
  "Questions a parent asks first": "वे सवाल जो पैरेंट सबसे पहले पूछते हैं",
  "Before you pay": "पैसे देने से पहले",

  // ---- Pricing page: the monthly/yearly toggle
  Monthly: "महीने का",
  Yearly: "साल का",
  "{label} · save {percent}%": "{label} · {percent}% छूट",

  // ---- Pricing page: what the page promises before any button appears
  "Everything about careers — every career, stream, exam, resource, scholarship and institute — is free, and stays free on every plan. A paid plan adds more conversation, more questionnaires, a printed report and a parent's view of progress.":
    "करियर से जुड़ी हर चीज़ — हर करियर, स्ट्रीम, एग्ज़ाम, रिसोर्स, स्कॉलरशिप और संस्थान — मुफ़्त है, और हर प्लान पर मुफ़्त रहेगी। पेड प्लान ज़्यादा बातचीत, ज़्यादा क्वेश्चनर, एक प्रिंट होने वाली रिपोर्ट और प्रोग्रेस दिखने वाली पैरेंट की नज़र जोड़ता है।",
  "Prices below are rupee figures the server itself quotes, in paise, and the limits beside them are the ones the server enforces. Nothing on this page is a copy of a number kept somewhere else.":
    "नीचे की कीमतें सर्वर खुद बताता है, पैसे में, और बगल में दिखने वाली लिमिट भी वही हैं जो सर्वर असल में लगाता है। इस पेज पर लिखा कोई भी अंक कहीं और रखी गई नक़ल नहीं है।",

  // ---- Pricing page: what these buttons can honestly do on this deployment
  "Online payment is not switched on for this deployment. The plans and their limits below are the real ones the server enforces, but no card can be taken here yet, so every upgrade button is disabled rather than pretending.":
    "इस डिप्लॉयमेंट पर ऑनलाइन पेमेंट चालू नहीं है। नीचे के प्लान और उनकी लिमिट असल में वही हैं जो सर्वर लगाता है, पर यहाँ अभी कोई कार्ड नहीं लिया जा सकता, इसलिए हर अपग्रेड बटन सच में बंद रखा गया है — दिखावे के लिए चालू नहीं।",
  "Payment is switched on with Razorpay's test keys on this server. The card sheet behaves as it does for real and no money moves.":
    "इस सर्वर पर पेमेंट Razorpay की टेस्ट कीज़ के साथ चालू है। कार्ड शीट वैसा ही व्यवहार करती है जैसे असली में, और कोई पैसा हिलता नहीं है।",
  "Payment is switched on. Card details are handled entirely by Razorpay's own payment page; this server keeps an order id, a payment id and a receipt.":
    "पेमेंट चालू है। कार्ड की जानकारी पूरी तरह Razorpay के अपने पेमेंट पेज के पास रहती है; यह सर्वर सिर्फ़ एक ऑर्डर id, एक पेमेंट id और एक रसीद रखता है।",
  "Note for this deployment: the free plan's caps are published above but are not being switched on yet, so a free account is not currently turned away at its third chat of the day. The numbers describe the plan; enforcement is a setting the operator turns on deliberately.":
    "इस डिप्लॉयमेंट के लिए नोट: फ्री प्लान की कैप्स ऊपर लिखी हैं, पर अभी चालू नहीं की जा रहीं, इसलिए एक फ्री अकाउंट को अभी दिन की तीसरी चैट पर नहीं रोका जाता। ये अंक सिर्फ़ प्लान का ब्यौरा बताते हैं; उन्हें लगू करना एक सेटिंग है, जो ऑपरेटर जानबूझकर चालू करता है।",

  // ---- Pricing page: the four things a plan does not change
  "The advice does not change with the plan": "सलाह प्लान के साथ नहीं बदलती",
  "A paid plan buys conversation, questionnaires, a printed document and a parent's view. It cannot buy a career a suggestion, a ranking, or an exam listed ahead of another. There is no sponsored placement anywhere in the catalogue, and the tests check that a recommendation comes out identical before and after a payment.":
    "पैसा देने वाला प्लान बातचीत, क्वेश्चनर, एक प्रिंट होने वाला दस्तावेज़ और पैरेंट की अपनी नज़र खरीदता है। वह न किसी करियर का सुझाव खरीद सकता है, न रैंकिंग, न किसी एग्ज़ाम को दूसरे से आगे दिखाना। कैटलॉग के कहीं भी पैसे लेकर दी गई स्पॉन्सर्ड प्लेसमेंट नहीं है, और टेस्ट यह जाँचते हैं कि भुगतान से पहले और बाद में सिफ़ारिश बिल्कुल एक जैसी निकलती है।",
  "The card never touches this server": "कार्ड इस सर्वर को कभी नहीं मिलता",
  "The payment sheet is Razorpay's own, drawn inside their frame. This application sees an order id, a payment id and a signature, and stores only those three. No card number, no expiry, no CVV, no last four digits — so a leak here could not hand over a card even if it wanted to.":
    "पेमेंट शीट Razorpay की अपनी है, उनके ही फ़्रेम के अंदर बनती है। इस ऐप्लिकेशन को सिर्फ़ ऑर्डर id, पेमेंट id और सिग्नेचर दिखता है, और बस यही तीन चीज़ें सेव होती हैं। न कार्ड नंबर, न एक्सपायरी, न CVV, न आख़िरी चार अंक — इसलिए यहाँ लीक हो भी जाए तो यह एक कार्ड नहीं दे पाएगा, चाहे वह चाहता हो।",
  "An adult has to say so, every time": "हर बार एक बड़े इंसान को कहना पड़ता है",
  "Before an order is created, the person paying confirms they are 18 or older and are paying for this knowingly. That answer is stored against that one order, because the question a dispute asks is not \"is there an adult somewhere in this family\" but \"who agreed to this payment\".":
    "ऑर्डर बनने से पहले पैसे देने वाला क़बूल करता है कि उसकी उम्र 18 या उससे ज़्यादा है और वह समझकर यह भुगतान कर रहा है। वह जवाब उसी एक ऑर्डर के साथ सेव होता है, क्योंकि विवाद में सवाल यह नहीं होता कि इस परिवार में कहीं न कहीं कोई बड़ा है, बल्कि यह होता है कि इस भुगतान के लिए किसने हाँ कही।",
  "Stop paying and nothing is taken away": "पैसे देना बंद कीजिए, कुछ छीना नहीं जाएगा",
  "When a paid period ends the account drops to the free plan. Conversations, assessment results and reports already made stay readable and downloadable. A child is never cut off from work they already did because a payment stopped.":
    "जब पेड पीरियड खत्म होता है, अकाउंट फ्री प्लान पर आ जाता है। जो बातचीत, असेसमेंट रिज़ल्ट और रिपोर्ट पहले बन चुकी हैं, वे पढ़ी और डाउनलोड की जा सकती रहती हैं। भुगतान रुक जाने की वजह से बच्चे को उसके पहले किए काम से कभी नहीं काटा जाता।",

  // ---- Pricing page: the questions a parent asks first, asked and answered in one array
  "Does the plan renew on its own?": "क्या प्लान अपने आप रीन्यू हो जाता है?",
  "No. One payment buys one fixed period — 30 days or 365 — and your billing page shows the date it ends. Renewing is a second deliberate click. Real auto-renewal needs the provider's subscription object and a card-on-file mandate, and this build does not have either, so it will never claim to.":
    "ना। एक बार का भुगतान एक तय पीरियड खरीदता है — 30 दिन या 365 — और आपका बिलिंग पेज वह तारीख़ दिखाता है जब वह खत्म होगा। रीन्यू करना दूसरी बार, सोच-समझकर की गई क्लिक है। असली ऑटो-रीन्यू के लिए प्रोवाइडर का सब्सक्रिप्शन ऑब्जेक्ट और कार्ड-ऑन-फ़ाइल मंडेट चाहिए, और इस बिल्ड में दोनों में से एक भी नहीं है, इसलिए यह कभी ऐसा दावा नहीं करेगा।",
  "What happens when the period ends?": "पीरियड खत्म होने पर क्या होता है?",
  "The account returns to the free plan with its limits. Everything already made stays: chats, assessment results and any report you have already downloaded are still yours. You can renew from the billing page at any time.":
    "अकाउंट अपनी लिमिट के साथ फ्री प्लान पर वापस आ जाता है। पहले जो भी बना है वह रहता है: चैट, असेसमेंट रिज़ल्ट और आपने जो कोई रिपोर्ट पहले डाउनलोड कर ली, वह आपकी ही है। आप कभी भी बिलिंग पेज से रीन्यू कर सकते हैं।",
  "Can I get a refund?": "क्या मुझे रिफ़ंड मिलेगा?",
  "The refund policy page describes the promises this project makes about money back, and every order carries its own receipt so a payment can be identified. Until a real payment account is connected and tested, no refund has been paid and no amount has been taken.":
    "रिफ़ंड पॉलिसी पेज बताता है कि पैसे वापस को लेकर यह प्रोजेक्ट क्या वादे करता है, और हर ऑर्डर के साथ अपनी रसीद होती है ताकि भुगतान पहचाना जा सके। जब तक असली पेमेंट अकाउंट जुड़कर टेस्ट नहीं हो जाता, तब तक कोई रिफ़ंड नहीं दिया गया और कोई रक़म भी नहीं ली गई।",
  "Do you sell our data, or share conversations?":
    "क्या आप हमारा डेटा बेचते हैं, या बातचीत शेयर करते हैं?",
  "No. Private conversations are not sold or disclosed to advertisers, and a parent's dashboard shows progress and themes that the student has chosen to share. The privacy policy states what is stored and how to export or delete it.":
    "ना। निजी बातचीत विज्ञापन देने वालों को न बेची जाती है न बताई जाती है, और पैरेंट का डैशबोर्ड सिर्फ़ प्रोग्रेस और वे थीम दिखाता है जो छात्र ने खुद शेयर करने चुकी हैं। प्राइवेसी पॉलिसी बताती है कि क्या सेव होता है और उसे एक्सपोर्ट या डिलीट कैसे करें।",
  "Is the free plan really free?": "क्या फ्री प्लान सच में मुफ़्त है?",
  "Yes, and the whole career catalogue is free on every plan. The paid plans add conversation volume, repeat questionnaires, a printable PDF report and a guardian's view — never access to information about a path a child might take.":
    "हाँ, और पूरा करियर कैटलॉग हर प्लान पर मुफ़्त है। पेड प्लान बातचीत की मात्रा, दोहराए जाने वाले क्वेश्चनर, एक प्रिंट होने वाली PDF रिपोर्ट और गार्जियन की नज़र जोड़ते हैं — पर बच्चे जिस रास्ते पर जा सकता है, उसकी जानकारी तक पहुँच कभी नहीं जोड़ते।",
  "The payment page said it worked but my plan has not changed.":
    "पेमेंट पेज ने कहा कि हो गया, पर मेरा प्लान नहीं बदला।",
  "The browser's answer is only a claim until this server checks its signature, and a provider's confirmation can take a few seconds to arrive. Do not pay again: reload the billing page. If it is still not unlocked after a few minutes, contact us with the receipt number and it can be reconciled.":
    "जब तक यह सर्वर उसका सिग्नेचर न जाँच ले, तब तक ब्राउज़र का जवाब सिर्फ़ एक दावा है, और प्रोवाइडर की पुष्टि पहुँचने में कुछ सेकंड लग सकते हैं। दोबारा भुगतान न करें: बिलिंग पेज फिर से खोलें। कुछ मिनट बाद भी प्लान अनलॉक न हो तो रसीद नंबर के साथ हमसे संपर्क करें, उसका हिसाब मिलाया जा सकता है।",
  "Can a school pay for a whole class?": "क्या एक स्कूल पूरी क्लास के लिए पैसा दे सकता है?",
  "That is the School Plan, and it is priced with a person rather than a checkout form, because there is no per-student count this page can guess. Use the contact page. A licence granted to a school unlocks the same tools and never changes the guidance a student is given.":
    "वही School Plan है, और उसकी कीमत एक इंसान के साथ तय होती है न कि चेकआउट फ़ॉर्म से, क्योंकि यहाँ प्रति-छात्र कोई गिनती नहीं है जो यह पेज अनुमान लगा सके। संपर्क पेज इस्तेमाल कीजिए। स्कूल को दिया गया लाइसेंस वही टूल्स खोलता है और छात्र को मिलने वाले मार्गदर्शन में कभी फ़र्क नहीं लाता।",
  "What if I am a student and I want to upgrade myself?":
    "अगर मैं छात्र हूँ और खुद अपग्रेड करना चाहूँ तो?",
  "Ask an adult to make the payment. The order cannot be created without the attestation, and that is intentional — this is a service for children, and a card should not be reachable by one.":
    "किसी बड़े से कहिए कि वह भुगतान करे। इस क़बूल के बिना ऑर्डर नहीं बन सकता, और यह जानबूझकर किया गया है — यह बच्चों की सेवा है, इसलिए कार्ड बच्चों की पहुँच में नहीं होना चाहिए।",

  // ---- Pricing page: the table note and the note before a card is used
  // "3 chats a day" is the server's own string, quoted here as the limiter writes it.
  "The row help text and every cell come from the server, which is why the wording in \"3 chats a day\" is the wording the limiter uses.":
    "हर पंक्ति का हेल्प टेक्स्ट और हर सेल सर्वर से आता है, इसलिए \"3 chats a day\" में जो शब्द हैं, वही शब्द लिमिटर इस्तेमाल करता है।",
  "Read the refund policy and the terms. This project is a prototype: it is not a replacement for a qualified career counsellor, it makes no promise about admissions, placements or salaries, and it does not claim to be compliant with any law because a feature was built. Those pages say what is real and where the gaps still are.":
    "रिफ़ंड पॉलिसी और नियम ज़रूर पढ़िए। यह प्रोजेक्ट एक प्रोटोटाइप है: यह किसी योग्य करियर काउंसलर का विकल्प नहीं है, यह एडमिशन, प्लेसमेंट या तनख़्वाह का कोई वादा नहीं करता, और कोई फ़ीचर बन जाने की वजह से यह किसी क़ानून का पालन करने का दावा नहीं करता। वे पेज बताते हैं कि क्या असली है और कहाँ-कहाँ अभी कमी है।",

  // ---- Checkout dialog: title, buttons and the two honest failure states
  // The title keeps the English word order — the plan name and the price follow it.
  "Pay for": "भुगतान करें",
  "Test mode": "टेस्ट मोड",
  "Not now": "अभी नहीं",
  "Continue to payment": "भुगतान पर आगे बढ़ें",
  "You closed the payment page. Nothing was charged and your plan is unchanged.":
    "आपने पेमेंट पेज बंद कर दिया। कुछ भी कटा नहीं और आपका प्लान वैसा ही है।",

  // ---- Checkout dialog: the order summary rows
  Plan: "प्लान",
  "You save": "आपकी बचत",
  Length: "अवधि",
  days: "दिन",
  "one payment": "एक बार का भुगतान",
  Renews: "रीन्यू",
  "Never by itself": "कभी अपने आप नहीं",

  // ---- Checkout dialog: what is being bought, and who may buy it
  "This buys {plan} for {days} days from the day the payment is captured. It does not renew by itself.":
    "भुगतान कटने के दिन से {days} दिनों तक आपको {plan} मिलेगा। यह अपने आप रीन्यू नहीं होगा।",
  "{plan} is not a subscription, and it does not renew by itself.":
    "{plan} कोई सब्सक्रिप्शन नहीं है, और यह अपने आप रीन्यू नहीं होता।",
  "I am 18 or older, and I am the adult paying for this":
    "मेरी उम्र 18 या उससे ज़्यादा है, और भुगतान करने वाले बड़े मैं ही हूँ",
  "Card details go to Razorpay, never to this server.":
    "कार्ड की जानकारी Razorpay को जाती है, इस सर्वर को कभी नहीं।",
  "Refunds and cancellation": "रिफ़ंड और रद्द करना",

  // ---- Checkout dialog: lines the code holds and hands to t() later, plus the two notes
  "This app is for students. A paid plan can only be bought by an adult who says so here, and that answer is kept against this one order.":
    "यह ऐप छात्रों के लिए है। पेड प्लान सिर्फ़ एक बड़ा इंसान खरीद सकता है, जो यहाँ अपने बारे में कहता है, और वह जवाब इसी एक ऑर्डर के साथ रखा जाता है।",
  "This server is running on Razorpay's test keys. The card sheet behaves exactly as it does for real, but no money moves and no card is charged.":
    "यह सर्वर Razorpay की टेस्ट कीज़ पर चल रहा है। कार्ड शीट बिल्कुल वैसा ही व्यवहार करती है जैसे असली में, पर कोई पैसा नहीं हिलता और किसी कार्ड से कुछ नहीं कटता।",
  "Razorpay's own payment page should be open now. If it is not, a pop-up blocker or a content filter is stopping it — nothing has been charged, so close this and try again.":
    "Razorpay का अपना पेमेंट पेज अब खुल चुका होना चाहिए। अगर नहीं खुला, तो कोई पॉप-अप ब्लॉकर या कंटेंट फ़िल्टर उसे रोक रहा है — कुछ भी कटा नहीं है, इसलिए यह बंद कीजिए और फिर कोशिश करें।",
  "The payment page said it went through, but this server could not confirm it yet. If money left your account it will appear on your billing page within a minute or two. Please do not pay again until it does.":
    "पेमेंट पेज ने कहा कि भुगतान हो गया, पर यह सर्वर अभी उसकी पुष्टि नहीं कर सका। अगर आपके अकाउंट से पैसा गया होगा तो एक-दो मिनट में आपके बिलिंग पेज पर दिख जाएगा। जब तक न दिखे, तब तक दोबारा भुगतान मत कीजिए।",
  "That order could not be started. Nothing has been charged.":
    "वह ऑर्डर शुरू नहीं हो सका। कहीं से कुछ नहीं कटा है।",

  // ---- Feature table: header and cells
  Feature: "फीचर",
  Included: "शामिल",
  "Not included": "शामिल नहीं",
  // The price cell for a plan a person quotes instead of a checkout form, i.e. the
  // table's version of the card's "हमसे बात करें".
  Custom: "कस्टम कीमत",
  Free: "मुफ़्त",
  "Your plan": "आपका प्लान",

  // ---- Plan cards: badges, prices and the three honest button states
  Current: "मौजूदा",
  "Most chosen": "सबसे ज़्यादा चुना गया",
  "Talk to us": "हमसे बात करें",
  // Reads as "(30% छूट)" — the percent itself always comes from the server.
  off: "छूट",
  "No card, no commitment.": "न कार्ड, न कोई बाध्यता।",
  "This is your plan": "यही आपका प्लान है",
  "Ask about school licences": "स्कूल लाइसेंस के बारे में पूछें",
  "Start free": "मुफ़्त शुरू करें",
  Upgrade: "अपग्रेड करें",
  "Upgrades are not open yet": "अपग्रेड अभी चालू नहीं हैं",
  // The period a price is quoted against, read from the plan's own interval.
  "a month": "हर महीने",
  "a year": "हर साल",
  "Online payment is not switched on for this deployment, so this button does nothing yet. Everything this plan promises is still free to read about.":
    "इस डिप्लॉयमेंट पर ऑनलाइन पेमेंट चालू नहीं है, इसलिए यह बटन अभी कुछ नहीं करता। इस प्लान के बारे में जो कुछ वादा किया गया है, उसे पढ़ना फिर भी मुफ़्त है।",

  // ---------------------------------------------------------- The plan copy itself
  // Names, taglines, feature rows and their one-line explanations are served by
  // `GET /api/payments/plans` from `backend/app/services/plans.py`, so they reach the
  // screen as data and no source literal in this app ever names them. They are still
  // product copy a family reads before paying, so they are translated here — the only
  // place the Hindi can live without moving the words out of the pricing service.
  //
  // The free plan's limits arrive as "3 chats a day", built from `FREE_DAILY_CHATS`.
  // Those keys carry `{n}` instead of the number, which is why `PlanCard` and
  // `FeatureTable` translate their values with `useTNumeric()`. `billing.ts` already
  // owns the "{n} chats a day" line — the same server string on the same screen pair.
  "{n} questionnaire, once": "सिर्फ़ {n} प्रश्नावली, एक बार",
  "{n} a day": "दिन में {n} बार",
  "about {amount} a month": "लगभग {amount} हर महीने",
  "Pro Yearly": "Pro सालाना",
  "School Plan": "स्कूल प्लान",
  forever: "हमेशा के लिए",
  "Everything about careers, with a limited number of conversations.":
    "करियर के बारे में सब कुछ, पर बातचीत सीमित संख्या में।",
  "Unlimited conversation, every questionnaire, a printed report.":
    "अनलिमिटेड बातचीत, हर तरह की प्रश्नावली, और एक प्रिंट होने वाली रिपोर्ट।",
  "The same Pro, paid for a year at about 30% less.":
    "वही Pro, साल भर का एक साथ — लगभग 30% कम में।",
  "Bulk licences for a class or a whole school, priced with a person.":
    "पूरी क्लास या पूरे स्कूल के लिए ज़्यादा लाइसेंस — दाम इंसान से बात करके तय होता है।",
  "Every type, repeatable": "हर तरह की, कितनी बार चाहें",
  "Any number, with a come-back code": "किसी भी डिवाइस से, बस वापसी कोड से",
  "One device": "एक ही डिवाइस",
  "Unlimited for every student": "हर स्टूडेंट के लिए अनलिमिटेड",
  "Managed seats": "सीटें स्कूल संभालता है",
  "Talk with the guide": "गाइड से बात करें",
  "Careers, streams, exams, resources, scholarships, institutes":
    "करियर, स्ट्रीम, एग्ज़ाम, संसाधन, स्कॉलरशिप और संस्थान",
  "Spoken replies and read-aloud": "बोलकर जवाब, और पढ़कर सुनाना",
  "Printable PDF report": "प्रिंट करने लायक PDF रिपोर्ट",
  "Coming back on another device": "दूसरे डिवाइस पर वापस आना",
  "English, Hindi and Hinglish": "अंग्रेज़ी, हिन्दी और Hinglish",
  "See, export and delete your own data": "अपना डेटा खुद देखें, निकालें और मिटाएँ",
  "The chat and the spoken call use the same conversation, so the guide keeps what it already learned about you.":
    "चैट और वॉइस कॉल एक ही बातचीत में चलते हैं, इसलिए गाइड वह याद रखता है जो आपने पहले बताया था।",
  "Interest, aptitude and stream-readiness questionnaires, each with a scored result page.":
    "रुचि, योग्यता और स्ट्रीम की तैयारी की प्रश्नावलियाँ — हर एक का स्कोर और रिज़ल्ट पेज।",
  "Free on every plan, and stays free. Selling access to this is selling what a child is allowed to find out.":
    "हर प्लान में मुफ़्त, और हमेशा मुफ़्त रहेगा। इस तक पहुँच बेचना यानी बच्चे के जानने के हक़ को बेचना।",
  "The server voice, with your own browser's voice as the fallback.":
    "सर्वर की आवाज़ — वह न मिले तो आपके ब्राउज़र की अपनी आवाज़।",
  "One document with every finished questionnaire, in English or Hindi.":
    "हर पूरी हुई प्रश्नावली एक ही दस्तावेज़ में, अंग्रेज़ी या हिन्दी में।",
  "A guardian's view of progress, opened only by a code the student chooses to share. Transcripts stay private unless the student says otherwise.":
    "अभिभावक को प्रगति दिखती है, और वह भी तभी जब स्टूडेंट खुद कोड शेयर करे। पढ़ाई की पूरी जानकारी निजी रहती है, जब तक स्टूडेंट ख़ुद कुछ और न कहे।",
  "A come-back code, plus optional email sign-in where it is configured.":
    "वापसी का कोड, और जहाँ सेटअप किया गया हो वहाँ ई-मेल साइन-इन भी।",
  "The guide answers in the language you used, in the same conversation.":
    "आपने जिस भाषा में सवाल पूछा, गाइड उसी भाषा में और उसी बातचीत में जवाब देता है।",
  "On every plan. Deleting an account is never something a paid plan has to unlock, and a free account that stopped paying keeps its deletion path.":
    "हर प्लान में। खाता मिटाना कभी पैसों से खुलने वाली चीज़ नहीं रही, और जो फ़्री अकाउंट भुगतान करना छोड़ दे उसके पास भी मिटाने का रास्ता बहरहाल खुला रहता है।",
};
