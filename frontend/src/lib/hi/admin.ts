/**
 * Hindi for the operator area under `/app/admin` — the shell, the overview, the
 * accounts list, the enquiry queue — and the shared table helpers those screens
 * build on.
 *
 * Keys are the English source text so a missing entry falls back to English.
 * Sentences about what an operator can and cannot see are translated exactly as
 * narrowly as the English says; nothing here widens or narrows an access right.
 */
export const HI: Record<string, string> = {
  // Shell and navigation
  Accounts: "खाते",
  Content: "कंटेंट",
  Enquiries: "पूछताछ",
  Deployment: "डिप्लॉयमेंट",
  Operator: "ऑपरेटर",
  "Operator screens": "ऑपरेटर स्क्रीन",
  Admin: "एडमिन",
  "Checking whether this account runs the site": "देखा जा रहा है कि यह अकाउंट साइट चलाता है या नहीं",
  "The server is not answering": "सर्वर जवाब नहीं दे रहा",
  "These screens are not open to this account": "ये स्क्रीन इस अकाउंट के लिए खुली नहीं हैं",
  "The backend could not be reached, so it could not say whether this account holds the operator flag. Nothing has been cleared on this device.":
    "बैकएंड तक पहुँचा नहीं जा सका, इसलिए यह नहीं बताया जा सका कि इस अकाउंट के पास ऑपरेटर फ़्लैग है या नहीं। इस डिवाइस पर कुछ भी हटाया नहीं गया है।",
  "Only the account with the is_admin flag may see the counts, the accounts list or the catalogue. No page, form or sign-up can ask for that flag, and it is not a role a token carries.":
    "जिस अकाउंट के पास is_admin फ़्लैग है, वही गिनती, अकाउंट लिस्ट और कैटलॉग देख सकता है। कोई पेज, फ़ॉर्म या साइन-अप से यह फ़्लैग माँगा नहीं जा सकता, और यह कोई ऐसी भूमिका नहीं है जो टोकन के साथ आती है।",
  "On the server, run this command for the confirmed address this account signs in with, then reload this page:":
    "सर्वर पर यह कमांड उस पक्के किए पते पर चलाएँ जिससे यह अकाउंट साइन इन करता है, फिर यह पेज दोबारा खोलें:",
  "To take it back, add this option to the command:": "हटाने के लिए, कमांड में यह ऑप्शन जोड़ें:",
  "Either way the change is written into the operator log.":
    "दोनों ही सूरत में बदलाव ऑपरेटर लॉग में लिखा जाता है।",
  "Check again": "फिर से जाँचें",

  // Operator overview
  Recount: "फिर से गिनें",
  "Counting the deployment": "डिप्लॉयमेंट की गिनती हो रही है",
  "Nothing to count": "गिनने को कुछ नहीं",
  "The server answered with an empty summary.": "सर्वर ने खाली सारांश भेजा।",
  "Every figure is a count or a sum over the rows this deployment holds, taken at {at}.":
    "हर आँकड़ा इस डिप्लॉयमेंट में मौजूद पंक्तियों की गिनती या जोड़ है, {at} को लिया गया।",
  "Nothing is estimated, extrapolated or projected, and there is no percentage growth on this page.":
    "कुछ भी अनुमान से या आँकड़ों को बढ़ा-घटाकर नहीं निकाला गया, और इस पेज पर ग्रोथ का कोई परसेंटेज नहीं है।",
  Conversations: "बातचीत",
  Money: "पैसा",
  "Waiting on somebody": "किसी का इंतज़ार",
  "Open accounts": "खुले अकाउंट",
  Students: "विद्यार्थी",
  Parents: "अभिभावक",
  Closed: "बंद",
  "New this week": "इस हफ़्ते नए",
  Operators: "ऑपरेटर",
  Sessions: "सेशन",
  Messages: "मैसेज",
  Typed: "टाइप किए",
  Spoken: "आवाज़ से",
  "{n} ever created": "अब तक कुल {n} बने",
  "Data untouched; reopening returns to it": "डेटा वैसा ही रहता है; दोबारा खोलने पर वही मिलेगा",
  "{n} in 30 days": "30 दिन में {n}",
  "Set by scripts/admin_grant.py": "scripts/admin_grant.py से सेट होता है",
  "{n} this week": "इस हफ़्ते {n}",
  "Replies from a model": "मॉडल के जवाब",
  "A configured provider answered these": "कॉन्फ़िगर किए प्रोवाइडर ने इनका जवाब दिया",
  "Demo replies": "डेमो जवाब",
  "Written by the canned script, not a model": "बने-बनाए स्क्रिप्ट से लिखे, मॉडल से नहीं",
  "Typed and spoken sessions add up to the total ({chat} + {voice} = {sessions}), and the two reply counts do the same for messages written by the guide.":
    "टाइप और आवाज़ के सेशन मिलकर कुल बनते हैं ({chat} + {voice} = {sessions}), और दोनों तरह के जवाबों की गिनती भी गाइड के मैसेज के लिए ऐसा ही करती है।",
  "A deployment running {env} produces only demo replies, and this panel is where that becomes visible.":
    "{env} पर चल रहा डिप्लॉयमेंट सिर्फ़ डेमो जवाब बनाता है, और इस पैनल में यही दिखता है।",
  Started: "शुरू किए",
  Completed: "पूरे किए",
  "Still open": "अभी खुले",
  Results: "रिज़ल्ट",
  "Printed reports": "प्रिंट किए रिपोर्ट",
  "By questionnaire": "प्रश्नावली के हिसाब से",
  "No sittings have been started yet, so there is nothing to break down.":
    "अभी कोई असेसमेंट शुरू नहीं हुआ, इसलिए हिसाब बाँटने को कुछ नहीं।",
  Captured: "कैप्चर किए",
  "{n} orders": "{n} ऑर्डर",
  "Captured, 30 days": "कैप्चर किए, 30 दिन",
  "Test-mode": "टेस्ट-मोड",
  "{n} orders — moved no money, never added above":
    "{n} ऑर्डर — इनमें पैसा नहीं चला, ऊपर दिए आँकड़े में कभी नहीं जोड़े गए",
  Refunded: "रिफ़ंड किए",
  "Failed orders": "असफल ऑर्डर",
  "Accounts on a plan": "प्लान वाले अकाउंट",
  "{paying} paid, {granted} granted": "{paying} ने पेमेंट किया, {granted} को ग्रांट मिला",
  "Open subscriptions by plan": "प्लान के हिसाब से खुले सब्सक्रिप्शन",
  "Nobody is on a paid or granted plan right now.": "अभी कोई पैड या ग्रांटेड प्लान पर नहीं है।",
  "A granted subscription is one somebody was written in by hand, and it is counted apart from the {paying} that came through a payment.":
    "ग्रांटेड सब्सक्रिप्शन वह है जिसे किसी ने हाथ से जोड़ा है, और इसे {paying} से अलग गिना जाता है जो पेमेंट से आए हैं।",
  "Money never decides what a child is recommended; the catalogue and the scoring are the same on every plan.":
    "पैसा कभी तय नहीं करता कि बच्चे को क्या सुझाया जाए; कैटलॉग और स्कोरिंग हर प्लान में एक जैसे हैं।",
  Portals: "पोर्टल",
  "{schools} schools, {practices} practices": "{schools} स्कूल, {practices} प्रैक्टिस",
  "Members joined": "जुड़े सदस्य",
  "Invited, not joined": "इनवाइट किए, नहीं जुड़े",
  "Notes shared with a family": "परिवार से शेयर किए नोट्स",
  "Careers to verify": "जाँचने वाले करियर",
  "{n} in the catalogue": "कैटलॉग में {n}",
  "Open the catalogue": "कैटलॉग खोलें",
  "Open enquiries": "खुली पूछताछ",
  "{n} altogether": "कुल मिलाकर {n}",
  "Open the queue": "क़तार खोलें",
  "Email waiting": "ईमेल क़तार में",
  "Drained by scripts/email_worker.py": "scripts/email_worker.py यह क़तार भेजता है",
  "Email failed": "असफल ईमेल",
  "Questions in the bank": "बैंक में सवाल",
  "Seeded from data/assessment_questions.json": "data/assessment_questions.json से भरे गए",
  "{flagged} of {total} career entries carry the flag the seed set, which means nobody has read a real source beside them.":
    "{total} करियर एंट्री में से {flagged} पर सीड वाला फ़्लैग है, यानी किसी ने उनके बगल में कोई असली स्रोत नहीं पढ़ा है।",
  "The way to clear it is row by row against a source, not by switching the flag off — the API refuses that in both directions.":
    "इसे हटाने का तरीका है हर पंक्ति को स्रोत से मिलाकर जाँचना — फ़्लैग बंद करने से नहीं; API दोनों तरह से मना करता है।",
  "What this page cannot tell you": "यह पेज आपको नहीं बता सकता",
  "It cannot show a conversation, an answer, a score or a report. Those belong to the account that made them, and no route here reaches into one.":
    "यह कोई बातचीत, जवाब, स्कोर या रिपोर्ट नहीं दिखा सकता। वे उस अकाउंट की अपनी चीज़ें हैं, और यहाँ से कोई रूट उसके अंदर नहीं जाता।",
  "It cannot rank people. There is no “who talked most” and no “whose scores are highest”, because the second is a claim about a child.":
    "यह लोगों की रैंक नहीं कर सकता। न “किसने सबसे ज़्यादा बात की” है और न “किसके स्कोर सबसे ऊँचे हैं”, क्योंकि दूसरा बच्चे के बारे में दावा है।",
  "It cannot tell you what a payment was for or who pays. Plan names and totals are here; the money itself lives on the billing page of the account that paid it.":
    "यह नहीं बता सकता कि पेमेंट किस चीज़ के लिए था या कौन देता है। प्लान के नाम और कुल यहाँ हैं; पैसा उस अकाउंट की बिलिंग पेज पर रहता है जिसने दिया।",

  // Accounts list
  "Find an account, see how much it has used the app, and change whether it is open or whether it runs the site. Nothing else about a person is readable here.":
    "अकाउंट खोजें, देखें कि उसने ऐप कितना इस्तेमाल किया, और बदलें कि वह खुला है या साइट चलाता है। किसी इंसान के बारे में इसके अलावा और कुछ यहाँ नहीं पढ़ा जा सकता।",
  "Students and parents": "विद्यार्थी और अभिभावक",
  "Students only": "सिर्फ़ विद्यार्थी",
  "Parents only": "सिर्फ़ अभिभावक",
  "Open and closed": "खुले और बंद",
  "Open only": "सिर्फ़ खुले",
  "Closed only": "सिर्फ़ बंद",
  "All accounts": "सभी अकाउंट",
  "Operators only": "सिर्फ़ ऑपरेटर",
  "A name, or an exact id": "कोई नाम, या पूरा id",
  "Email addresses are not searched — see the note below the list.":
    "ईमेल पते नहीं खोजे जाते — लिस्ट के नीचे दिया नोट देखें।",
  Role: "भूमिका",
  State: "हालत",
  "Looking up accounts": "अकाउंट खोजे जा रहे हैं",
  "No account matches this": "कोई अकाउंट इससे मेल नहीं खाता",
  "Nothing is named “{name}”. Names are matched as a substring, and ids exactly.":
    "“{name}” नाम से कोई नहीं है। नाम आंशिक मिलान से जाँचे जाते हैं, और id बिल्कुल मिलना चाहिए।",
  "Nothing is named “{name}”, and there is no account with id {id}. Names are matched as a substring, and ids exactly.":
    "“{name}” नाम से कोई नहीं है, और {id} वाले कोई अकाउंट भी नहीं है। नाम आंशिक मिलान से जाँचे जाते हैं, और id बिल्कुल मिलना चाहिए।",
  "This filter has no rows. That is the whole of the answer — an empty table here is not an error.":
    "इस फ़िल्टर में कोई पंक्ति नहीं है। इतना ही पूरा जवाब है — यहाँ खाली टेबल कोई एरर नहीं है।",
  "Joined {joined} · reads {language} · plan {plan}":
    "{joined} को जुड़े · पढ़ने की भाषा {language} · प्लान {plan}",
  "Joined {joined} · reads {language} · plan {plan}, until {until}":
    "{joined} को जुड़े · पढ़ने की भाषा {language} · प्लान {plan}, {until} तक",
  "Address on file: {address} ({status})": "अकाउंट पर दर्ज पता: {address} ({status})",
  "confirmed {date}": "{date} को पक्का हुआ",
  "not confirmed": "पक्का नहीं हुआ",
  "No email address attached to this account.": "इस अकाउंट से कोई ईमेल पता नहीं जुड़ा है।",
  "Sessions this account has had, of any kind": "इस अकाउंट के सभी तरह के सेशन",
  "Sittings started and completed by this account": "इस अकाउंट द्वारा शुरू और पूरे किए असेसमेंट",
  "Portals this account appears on the roster of": "जिन पोर्टल की रोस्टर लिस्ट में यह अकाउंट है",
  conversations: "बातचीत",
  "assessments completed": "असेसमेंट पूरे",
  "portal memberships": "पोर्टल सदस्यता",
  "Counts only. What this account said, and what it answered, stay behind its own session.":
    "सिर्फ़ गिनती। इस अकाउंट ने क्या कहा और क्या जवाब दिया, यह उसके अपने सेशन के पीछे रहता है।",
  "Remove operator access": "ऑपरेटर पहुँच हटाएँ",
  "Make an operator": "ऑपरेटर बनाएँ",
  "Confirm close": "बंद करना पक्का करें",
  "Close account": "अकाउंट बंद करें",
  "Reopen account": "अकाउंट दोबारा खोलें",
  "The operator flag was removed from this account. It is written in the log.":
    "इस अकाउंट से ऑपरेटर फ़्लैग हटा दिया गया। यह लॉग में लिखा गया है।",
  "This account now holds the operator flag, and can open every screen in this area.":
    "अब इस अकाउंट के पास ऑपरेटर फ़्लैग है, और यह इस हिस्से की हर स्क्रीन खोल सकता है।",
  "Closed. Nothing was deleted — the account's own rows are untouched, and its next request will be refused.":
    "बंद कर दिया। कुछ नहीं हटाया गया — अकाउंट की अपनी पंक्तियाँ वैसी ही हैं, और उसका अगला रिक्वेस्ट रिजेक्ट होगा।",
  "Open again. The family returns to exactly the data they left.":
    "फिर से खुल गया। परिवार बिल्कुल वैसा डेटा पाएगा जैसा छोड़ा था।",
  // The literal for a refused server call on the accounts rows lives in the shared
  // admin-content dictionary, so it is not repeated here.
  "Why there is no email search, and no delete": "ईमेल खोज और डिलीट क्यों नहीं है",
  "An address belongs to the person who attached it. Searching by one would let anybody with this flag test which addresses have accounts here, so the server has no such query — a name and an id are the only ways in.":
    "पता उस इंसान का होता है जिसने उसे जोड़ा। पते से खोज का मतलब होगा कि फ़्लैग वाला कोई भी देख सकता है कि इन पतों पर अकाउंट है या नहीं, इसलिए सर्वर में ऐसा कोई सवाल ही नहीं — नाम और id ही अंदर जाने के एकमात्र रास्ते हैं।",
  "Closing is reversible and deleting is not, so only closing is offered. There is no operator endpoint that erases a person’s rows; a request to remove somebody else’s data is handled outside this screen, by whoever runs the deployment.":
    "बंद करना वापस लिया जा सकता है, डिलीट नहीं, इसलिए सिर्फ़ बंद करना दिया गया है। कोई ऑपरेटर एंडपॉइंट किसी इंसान की पंक्तियाँ नहीं मिटाता; किसी और का डेटा हटाने की रिक्वेस्ट इस स्क्रीन से बाहर, डिप्लॉयमेंट चलाने वाले के पास होती है।",
  "A plan is not changed here either. What somebody pays is their own billing page’s business, and a grant or a cancellation made from an admin screen would be a financial action with no receipt behind it.":
    "प्लान भी यहाँ नहीं बदलता। कोई कितना देता है यह उनकी अपनी बिलिंग पेज की बात है, और एडमिन स्क्रीन से ग्रांट या रद्द करना बिना रसीद के पीछे के वित्तीय काम होता।",
  "Every change on this page writes one row into the operator log, which you can read on the deployment screen. The log holds the action and the field that moved, never a value.":
    "इस पेज का हर बदलाव ऑपरेटर लॉग में एक पंक्ति लिखता है, जो आप डिप्लॉयमेंट स्क्रीन पर पढ़ सकते हैं। लॉग काम और बदली हुई फ़ील्ड रखता है, कभी वैल्यू नहीं।",

  // Enquiry queue
  "What families and schools asked us through the study-abroad pages, in the order it arrived. Their words stay as they typed them.":
    "परिवारों और स्कूलों ने विदेश में पढ़ाई के पेजों से जो हमसे पूछा, वह उसी क्रम में जैसे आया। उनके शब्द वैसे ही रहते हैं जैसे उन्होंने टाइप किए।",
  "The public form": "पब्लिक फ़ॉर्म",
  All: "सभी",
  New: "नया",
  Contacted: "संपर्क किया",
  "Contact allowed": "संपर्क की अनुमति है",
  "No consent to contact": "संपर्क की अनुमति नहीं",
  "asked {date}": "{date} को पूछा",
  "consent {date}": "अनुमति {date} को",
  "Stage: {stage}": "चरण: {stage}",
  "No stage given": "चरण नहीं बताया",
  "from {page}": "{page} से",
  Hide: "छिपाएँ",
  "Read it": "पढ़ें",
  "Their message, as typed": "उनका मैसेज, जैसे टाइप किया",
  "They sent no message — only the form and their details.":
    "उन्होंने कोई मैसेज नहीं भेजा — सिर्फ़ फ़ॉर्म और अपनी जानकारी।",
  "Where this has got to": "कहाँ तक पहुँची",
  "An enquiry nobody has answered yet is still “new”.":
    "जिस पूछताछ का अभी किसी ने जवाब नहीं दिया, वह “नया” ही रहती है।",
  "Note to yourself": "अपने लिए नोट",
  "Only you and the other operators read this. It is not sent to the family.":
    "इसे सिर्फ़ आप और बाकी ऑपरेटर पढ़ते हैं। यह परिवार को नहीं भेजा जाता।",
  "Nothing to save": "सेव करने को कुछ नहीं",
  "Yes, delete it": "हाँ, डिलीट करें",
  "Keep it": "रहने दें",
  Delete: "डिलीट करें",
  "Deleting removes the row and there is no undo and no archive. Closing the enquiry keeps it on the list and says it is finished, which is nearly always what is wanted.":
    "डिलीट से पंक्ति हट जाती है, और न उसे वापस लाया जा सकता है न कोई आर्काइव बचता है। पूछताछ बंद करने पर वह लिस्ट में रहती है और पूरी की गई मानी जाती है, जो लगभग हमेशा चाहिए होता है।",
  "Saved. Their own words were not touched.": "सेव हो गया। उनके अपने शब्दों को हाथ नहीं लगाया।",
  "Saved. Their own words were not touched, and the handling is stamped {at}.":
    "सेव हो गया। उनके अपने शब्दों को हाथ नहीं लगाया, और हैंडलिंग की मुहर {at} की लगी।",
  "The server did not answer, so nothing was saved.": "सर्वर ने जवाब नहीं दिया, इसलिए कुछ सेव नहीं हुआ।",
  "The server did not answer, so it is still here.": "सर्वर ने जवाब नहीं दिया, इसलिए यह अभी यहाँ है।",
  "Last handled {at}.": "आख़िरी बार {at} को हैंडल हुई।",
  "Opening the queue": "क़तार खुल रही है",
  "The queue would not load": "क़तार लोड नहीं हुई",
  "This list comes from the study-abroad routes, which are behind the same operator flag as the rest of this area. A server that is running but refusing you is a different answer from a server that is not running at all, and the message above says which.":
    "यह लिस्ट study-abroad रूट्स से आती है, जो इस हिस्से के बाकी रूट्स की तरह उसी ऑपरेटर फ़्लैग के पीछे हैं। चलता हुआ पर आपको रिजेक्ट करने वाला सर्वर और बिल्कुल न चलने वाले सर्वर में फ़र्क है, और ऊपर का मैसेज बताता है कि कौन सा वाला है।",
  "Nothing matches this": "इससे कुछ मेल नहीं खाता",
  "No enquiries yet": "अभी कोई पूछताछ नहीं",
  "Not an error — this filter has no rows. Try All, or clear the search.":
    "इसमें कोई गलती नहीं — इस फ़िल्टर में पंक्तियाँ नहीं हैं। सभी आज़माएँ, या खोज साफ़ करें।",
  "Nobody has sent the study-abroad form yet. When they do, it appears here and a copy goes to the address in LEAD_NOTIFY_EMAIL.":
    "अभी किसी ने study-abroad फ़ॉर्म नहीं भेजा। भेजने पर वह यहाँ आएगा और एक कॉपी LEAD_NOTIFY_EMAIL वाले पते पर जाएगी।",
  "Nothing with this filter, and no enquiry is hidden from it.":
    "इस फ़िल्टर से कुछ नहीं, और कोई पूछताछ इससे छिपी नहीं है।",
  "All {n} with this filter are in view; the oldest is from {date}.":
    "इस फ़िल्टर की सभी {n} दिख रही हैं; सबसे पुरानी {date} की है।",
  "Only the newest {n} enquiries are listed; the oldest in view is from {date}. An older one is found by searching rather than by paging, because the public form is throttled per network and a school can send a class at once.":
    "सिर्फ़ सबसे नई {n} पूछताछ लिस्ट में हैं; यहाँ दिख रही सबसे पुरानी {date} की है। पुरानी खोज से मिलती है, पेजिंग से नहीं, क्योंकि पब्लिक फ़ॉर्म नेटवर्क के हिसाब से लिमिट किया जाता है और एक स्कूल एक साथ पूरी क्लास भेज सकता है।",
  "What this queue is, and is not": "यह क़तार क्या है, और क्या नहीं",
  "It is a copy of what a person chose to send. An enquiry does not create an account, does not start a conversation, and does not appear anywhere in a child’s profile.":
    "यह उसी की कॉपी है जो इंसान ने भेजने का खुद चुना। पूछताछ से अकाउंट नहीं बनता, बातचीत नहीं शुरू होती, और बच्चे की प्रोफ़ाइल में कहीं नहीं दिखती।",
  "A contact address here is for answering this enquiry. It is not added to a mailing list, and there is no route that reads this table to send anything else.":
    "यहाँ का संपर्क पता सिर्फ़ इस पूछताछ का जवाब देने के लिए है। इसे मेलिंग लिस्ट में नहीं जोड़ा जाता, और कोई रूट यह टेबल पढ़कर कुछ और नहीं भेजता।",
  "An enquiry from a school about a class is the same row as one from a parent about a child. Nothing in this table decides what either of them is recommended.":
    "स्कूल की ओर से क्लास के लिए आई पूछताछ और अभिभावक की ओर से बच्चे के लिए आई पूछताछ एकैसी पंक्ति हैं। यह टेबल कुछ भी तय नहीं करती कि किसे क्या सुझाया जाए।",
  "Search the enquiries": "पूछताछ खोजें",
  "A name, an address, or a word in a message": "कोई नाम, पता, या मैसेज का कोई शब्द",

  // Shared operator controls
  "No {unit} match this filter.": "इस फ़िल्टर से कोई {unit} नहीं मिला।",
  "{first}–{last} of {total} {unit}.": "कुल {total} {unit} में से {first}–{last}।",
  rows: "पंक्तियाँ",
  accounts: "अकाउंट",
};
