"""Country and service copy for the study-abroad section.

Two rules, inherited from `app/seed/__init__.py` and stated here because this is the
part a family will actually read:

1. **No number that cannot be checked from here.** No fee, no living-cost figure, no
   processing time, no visa rule restated in our own words. Fees and immigration rules
   move every year, and this file is reviewed by nobody on a schedule. Where a legal
   fact matters, the row links to the government page that owns it and says nothing
   about what the page contains.
2. **No outcome promised.** Nothing here says a university will admit anybody, or that a
   visa will be granted. The services below say what the work involves and — in
   `not_included`, which is the more important column — what it never covers.

`checked_at` is left NULL by the seed on purpose. It means "this copy has not been
re-read against the official portal since it was written", and the country page prints
that. The site owner sets it from the admin screen on the day they do open the links.

The Indian-family angle is deliberate: these are the questions a parent in India asks in
the first meeting, and answering them with "ask the university, here is the door" is the
only answer that stays true.
"""

from __future__ import annotations

COUNTRIES: list[dict] = [
    {
        "slug": "united-states",
        "name": "United States",
        "code": "US",
        "overview": (
            "American universities admit students themselves: there is no central "
            "board that decides for all of them, which is why two schools with very "
            "similar reputations can ask for very different things. Applications are "
            "usually made to each university direct, through its own portal or through "
            "a common form that the school chooses to accept. A standard package is "
            "grades, a statement of purpose, teacher references, an English "
            "proficiency test where the university asks for one, and proof of funds "
            "later, for the visa stage. Deadlines differ by university and by "
            "programme, and the one that matters is the one printed on that "
            "programme's own page."
        ),
        "language_note": (
            "Teaching is in English everywhere. Universities set their own minimum "
            "English test score, and some waive it after a year of English-medium "
            "schooling. The waiver is the university's decision, not ours."
        ),
        "intake_note": (
            "Most first-year places begin in the autumn; some universities also take "
            "students in the spring. Which intakes are open, and when each one closes, "
            "is published by the university for that year."
        ),
        "cost_note": (
            "No fee is stated on this page. American tuition differs by university, by "
            "programme and by year, and scholarships are decided by the university "
            "after it has seen the application. The university's own cost page is the "
            "only current number; budget from it, not from an estimate."
        ),
        "work_after_note": (
            "Work rights during study and after it are set by federal immigration "
            "rules, which change. Read them on the official portal linked below "
            "before any plan depends on them."
        ),
        "to_check": [
            "Which of the universities we chose ask for an English test at my level?",
            "What does each programme cost per year, in the university's own currency?",
            "What is the last date my university application can be submitted?",
            "What financial documents does the university need before it will issue the "
            "eligibility letter?",
            "How much of the cost is met by the scholarships this university offers, "
            "and on what date do they close?",
        ],
        "visa_portal_url": "https://studyinstates.gov/",
        "visa_portal_label": "Study in the States - US Department of Homeland Security",
        "qualifications_portal_url": "https://www.educationusa.state.gov/",
        "qualifications_portal_label": "EducationUSA - the official advising network",
    },
    {
        "slug": "united-kingdom",
        "name": "United Kingdom",
        "code": "UK",
        "overview": (
            "British universities admit students themselves, and undergraduate "
            "applications in most subjects go through one national admissions service "
            "that forwards them to the schools you list. Degrees are shorter than in "
            "most other countries: an undergraduate degree in England is typically "
            "three years and a taught master's one year, with the fourth year only at "
            "Scottish universities and for some programmes. A student applies for a "
            "place first and only then deals with the visa, and the university or the "
            "sponsorship body issues the document the visa route needs. Courses are "
            "very specialised from the first week, so choosing the subject carefully "
            "matters more here than choosing the name of the college."
        ),
        "language_note": (
            "Teaching is in English. Universities set their own minimum English test "
            "score, and some programmes need a test from a list the government "
            "publishes for visa purposes - the university tells you which ones it "
            "accepts."
        ),
        "intake_note": (
            "The main entry is in September or October; January and May entries exist "
            "at some universities for some courses. Undergraduate applications through "
            "the national service have one autumn deadline that changes each cycle - "
            "check the current one rather than a date remembered from last year."
        ),
        "cost_note": (
            "No fee is stated on this page. Tuition in the UK is set by each "
            "university and by each course, and it normally rises for every new "
            "cohort, so the fee quoted for the year you start is the fee that applies "
            "to you. Living costs are published by the university and are calculated "
            "for a fixed number of months, not twelve."
        ),
        "work_after_note": (
            "Work during study, and any route to stay afterwards for interviews or "
            "search, are immigration rules. They change. The government page below is "
            "the only version worth acting on."
        ),
        "to_check": [
            "Does this course have an Indian qualification in its entry list, or does "
            "it need a foundation year?",
            "Which admissions service does the university use for this course?",
            "What is the total fee for the whole length of the course, and does it rise "
            "each year?",
            "What is the current English test requirement for this exact course?",
            "What financial evidence does the visa route ask for, and for how long must "
            "it be held before applying?",
        ],
        "visa_portal_url": "https://www.gov.uk/student-visa",
        "visa_portal_label": "gov.uk - Student visa",
        "qualifications_portal_url": "https://www.enic.org.uk/",
        "qualifications_portal_label": "UK ENIC - recognition of overseas qualifications",
    },
    {
        "slug": "canada",
        "name": "Canada",
        "code": "CA",
        "overview": (
            "Canada's universities and colleges are provincial: each one is accountable "
            "to the government of its province, so an application, a fee and a "
            "calendar are all set by the institution rather than by one national body. "
            "Colleges and institutes offer diplomas and advanced diplomas that are a "
            "different thing from a university degree, and both can be a reasonable "
            "next step after class 12. Most institutions ask an international "
            "applicant for the same four things: transcripts, an English or French "
            "test, a statement, and proof of funds. Only an institution on the "
            "government's official list can issue the letter a study permit needs - "
            "that is worth checking before anybody pays an application fee."
        ),
        "language_note": (
            "English at most institutions, French in Quebec and at some elsewhere. "
            "Each institution sets its own test requirement and its own exemption "
            "rules for English-medium schooling."
        ),
        "intake_note": (
            "September is the main intake for most programmes; January and May intakes "
            "are common at colleges and at some universities. Closing dates differ by "
            "institution and by province."
        ),
        "cost_note": (
            "No fee is stated on this page. Tuition is set by each institution for each "
            "programme and is revised regularly, so the figure to plan against is the "
            "one on that programme's page for the year you would start."
        ),
        "work_after_note": (
            "The rules that let a graduate work after a programme, and the conditions "
            "attached to them, are set by the federal immigration department and have "
            "changed more than once in recent years. Read the current text before a "
            "plan relies on it."
        ),
        "to_check": [
            "Is this institution on the government's designated list for international "
            "students?",
            "Does the province require anything extra from an international applicant?",
            "What is the fee for the whole programme, and what does it include?",
            "What proof of funds does the study permit application ask for?",
            "Is the co-op or internship part of this programme paid, and is it open to "
            "international students?",
        ],
        "visa_portal_url": (
            "https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada.html"
        ),
        "visa_portal_label": "Government of Canada - study permit",
        "qualifications_portal_url": "https://www.universitiescanada.ca/",
        "qualifications_portal_label": "Universities Canada - member institutions",
    },
    {
        "slug": "australia",
        "name": "Australia",
        "code": "AU",
        "overview": (
            "Australian institutions are governed by a national framework, and a "
            "provider must be registered on the government's official Commonwealth "
            "register before it can enrol an overseas student. That register is the "
            "first thing to check, and it takes a minute. A degree is typically three "
            "or four years, and a place is usually offered by the university or its "
            "agent directly rather than by one central board. Entry rules for an "
            "Indian student depend heavily on which class 12 board and subjects were "
            "taken, so the university's own country entry table is the document to "
            "read, not a summary of it."
        ),
        "language_note": (
            "Teaching is in English. Institutions set their own test score, and the "
            "visa rules name which tests are acceptable - the institution will say "
            "which it needs."
        ),
        "intake_note": (
            "Most universities run two main intakes, in the first half and the second "
            "half of the year, and some add a third. Closing dates are published per "
            "institution and per term."
        ),
        "cost_note": (
            "No fee is stated on this page. Tuition is set by each institution for each "
            "course and normally changes for a new intake year; the course page shows "
            "the current figure and the usual duration in years, which is what a "
            "family should multiply."
        ),
        "work_after_note": (
            "Work rights during study, and the temporary graduate route after it, are "
            "decided by the home affairs department and have changed recently. Use the "
            "official page below rather than any recollection."
        ),
        "to_check": [
            "Is the provider, and this exact course, on the Commonwealth register?",
            "Which class 12 combination does this course accept directly, and does it "
            "need a foundation programme first?",
            "What is the course duration in years and the fee per year?",
            "What English test score does this course ask for?",
            "What does the visa route require about health cover and funds?",
        ],
        "visa_portal_url": "https://immi.homeaffairs.gov.au/",
        "visa_portal_label": "Department of Home Affairs - visas",
        "qualifications_portal_url": "https://www.cricos.education.gov.au/",
        "qualifications_portal_label": "CRICOS - the official provider and course register",
    },
    {
        "slug": "germany",
        "name": "Germany",
        "code": "DE",
        "overview": (
            "German universities are mostly public and admission is set by each "
            "institution, sometimes through a national foundation service for the "
            "most-requested subjects. The single biggest thing to establish early is "
            "whether the class 12 qualification is recognised as direct university "
            "entry: an official government database exists precisely to answer that "
            "question, and it is linked below. Where a qualification does not give "
            "direct entry, a foundation year is usually the route. Taught master's "
            "programmes in English are common in engineering and computer science; "
            "undergraduate teaching is more often in German, and that is a decision a "
            "family has to make honestly rather than optimistically."
        ),
        "language_note": (
            "Many master's programmes are taught in English; a large part of "
            "undergraduate teaching is in German. Each programme states the language "
            "and the test it needs."
        ),
        "intake_note": (
            "Most programmes begin in the winter term, and a meaningful number also in "
            "the summer term. Application windows are set by the university and, for "
            "some subjects, by the national applications foundation - both change by "
            "year."
        ),
        "cost_note": (
            "No fee is stated on this page. Many public universities charge no "
            "tuition and still require a term contribution; some states and some "
            "programmes charge tuition for students from outside the European Union. "
            "Which of these applies is a question for the specific institution's page "
            "and the specific state."
        ),
        "work_after_note": (
            "Part-time work limits during study and the job-seeking period afterwards "
            "are immigration rules. They have been revised in recent years; read the "
            "official portal before planning around them."
        ),
        "to_check": [
            "Does the official database show my class 12 qualification as direct "
            "university entry for the state I would apply in?",
            "If not, which foundation programme does the university accept?",
            "Is this programme taught in German or in English, and what proof does it "
            "ask for?",
            "Does this state or university charge tuition for non-EU students?",
            "What blocked-account or proof-of-funds amount does the visa ask for this "
            "year?",
        ],
        "visa_portal_url": "https://www.make-it-in-germany.com/en/",
        "visa_portal_label": "Make it in Germany - the official government portal",
        "qualifications_portal_url": "https://anabin.kmk.org/",
        "qualifications_portal_label": "anabin - recognition status of foreign qualifications",
    },
    {
        "slug": "ireland",
        "name": "Ireland",
        "code": "IE",
        "overview": (
            "Ireland has seven universities and a group of technological universities, "
            "all of them institutions of the state, and undergraduate applications from "
            "outside the European Union usually go directly to the college rather than "
            "through the domestic central system. Master's programmes are one year and "
            "concentrated, particularly in computing, business and pharmaceutical "
            "science. Each institution publishes its own entry requirements for Indian "
            "school leavers, and the differences between them are real, so a shortlist "
            "is worth building from those pages rather than from a ranking. A letter of "
            "offer comes first; the permission to enter comes after it."
        ),
        "language_note": (
            "Teaching is in English. Each institution sets its own test requirement, "
            "and English-medium schooling is accepted by some and not by others."
        ),
        "intake_note": (
            "The main entry is in September. Some programmes in computing and business "
            "also begin in January. Offers are made on a rolling basis at several "
            "colleges, and the practical deadline is the point where a course becomes "
            "full."
        ),
        "cost_note": (
            "No fee is stated on this page. Fees for students from outside the European "
            "Union are set per course by each institution and are published on that "
            "course's page; some also hold a deposit that counts against the fee."
        ),
        "work_after_note": (
            "Permission to work during a course, and the third-level graduate scheme "
            "after it, are immigration rules issued by the state. Read the current "
            "wording before a plan depends on it."
        ),
        "to_check": [
            "Does this college list my class 12 board and subjects in its own entry "
            "table?",
            "Is a deposit required to hold the offer, and is it refundable?",
            "What English score does this exact course ask for?",
            "What funds evidence does the entry permission ask for, and for how long "
            "must the money be held?",
            "Is this course on the graduate-employment list for the year I would finish?",
        ],
        "visa_portal_url": "https://www.irishimmigration.ie/",
        "visa_portal_label": "Irish Immigration Service Delivery - study",
        "qualifications_portal_url": "https://www.qqi.ie/",
        "qualifications_portal_label": "Quality and Qualifications Ireland",
    },
]


SERVICES: list[dict] = [
    {
        "slug": "profile-building",
        "title": "Profile building",
        "summary": (
            "An honest picture of what a student has, and the two or three things worth "
            "doing in the year ahead to strengthen it."
        ),
        "detail": (
            "We start from what is already there: marks so far, subjects, what the "
            "student actually does outside school, and what they say they want. The "
            "output is a written profile and a short list of things to do next that "
            "are real - an exam sitting, a project, a subject choice - not activities "
            "invented to fill a page. Where the profile is weak for the destination a "
            "family has in mind, we say so in the first meeting, because a plan built "
            "on a flattering description wastes the family's money and the student's "
            "year."
        ),
        "steps": [
            "A conversation with the student, and one with the parent separately.",
            "Marks, subjects and school activities read from the documents you already "
            "have.",
            "A written profile: strengths, gaps, and what a university would see.",
            "Two or three specific things to do in the coming year, with dates.",
            "A review after that year, and a rewritten profile.",
        ],
        "includes": [
            "The student's own record, read carefully.",
            "A written profile the student can use in an application.",
            "A short, dated list of what to do next.",
        ],
        "not_included": [
            "Any guarantee that a university will find the profile interesting.",
            "Invented activities, certificates or positions of responsibility.",
            "A claim about what an admissions officer will decide.",
        ],
        "who_for": "A student in class 9 to 12 who still has a year or more to act.",
        "fees_note": (
            "Quoted as a flat amount for the whole engagement before anything starts. "
            "Nothing is charged automatically and no payment is needed to talk to us."
        ),
        "available": True,
        "sort_order": 1,
    },
    {
        "slug": "university-shortlisting",
        "title": "University shortlisting",
        "summary": (
            "A small list of courses the student could actually get into, with each "
            "one's entry rules and current fee read from its own page."
        ),
        "detail": (
            "Shortlisting is mostly elimination. For each candidate course we open the "
            "university's own entry table and cost page, write down what it requires "
            "and what it charges for the year the student would start, and drop the "
            "ones that do not fit. The output is a list of eight to twelve courses "
            "across three levels, with the sources attached so the family can check "
            "every line themselves. We do not present a university because it pays us; "
            "if a university in this directory is a paid listing, that is stated on "
            "its page wherever it appears."
        ),
        "steps": [
            "Fix the destination, the subject and the budget before any name is "
            "suggested.",
            "Read each university's published entry rule for Indian qualifications.",
            "Read each university's published fee for the intake year.",
            "Sort the result into ambitious, matching and safe.",
            "Hand over the list with the source page for every single line.",
        ],
        "includes": [
            "Entry requirements taken from the university's own page, not remembered.",
            "Fee and duration for the specific course.",
            "A list a family can verify line by line.",
        ],
        "not_included": [
            "Any promise that a listed university will make an offer.",
            "Rankings presented as a recommendation.",
            "A paid placement of one university over another.",
        ],
        "who_for": "A student with a subject decided and one application season ahead.",
        "fees_note": (
            "Quoted as a flat amount before it starts. It does not depend on where the "
            "student is finally admitted."
        ),
        "available": True,
        "sort_order": 2,
    },
    {
        "slug": "sop-lor",
        "title": "SOP and LOR guidance",
        "summary": (
            "Helping a student write their own statement, and helping a teacher write a "
            "reference that a university will believe."
        ),
        "detail": (
            "A statement of purpose is the one part of an application the student "
            "controls completely, so the work is on structure and specificity: what "
            "they have done, what they want to study, why this course. We will read "
            "drafts, mark where a sentence says nothing, and push on the parts that "
            "are vague. We do not write it for them. A university can ask for the "
            "student's own voice, and a statement an applicant cannot explain in an "
            "interview is worse than a plain one they can. For references, we help the "
            "teacher see what a useful one contains - a specific instance rather than "
            "an adjective."
        ),
        "steps": [
            "The student drafts alone, from a structure we give them.",
            "We mark the draft for what is unsupported, generic or untrue.",
            "Two or three rounds of the student rewriting it.",
            "A briefing note for each referee on what a reference needs.",
            "A final read for clarity before the university's deadline.",
        ],
        "includes": [
            "Written feedback on the student's own drafts.",
            "A structure and a set of questions to answer.",
            "Guidance for teachers writing the references.",
        ],
        "not_included": [
            "Writing or ghostwriting the statement, or any part of it.",
            "Any statement that is not true of the student.",
            "A guarantee that any wording leads to an offer.",
        ],
        "who_for": "A student applying to courses that ask for a statement or essays.",
        "fees_note": "Quoted per round of feedback, agreed before the first draft arrives.",
        "available": True,
        "sort_order": 3,
    },
    {
        "slug": "visa-guidance",
        "title": "Visa guidance",
        "summary": (
            "Official government pages, explained in plain language, and nothing that "
            "requires an immigration licence."
        ),
        "detail": (
            "This is where a platform has to be careful about what it claims. Student "
            "visa rules are law, they change, and in several corridors giving regulated "
            "immigration advice or lodging an application on somebody's behalf requires "
            "a licence this platform does not hold. So what is offered here is "
            "understanding: we open the government page for the route, read it with the "
            "family, and explain which documents on that page refer to them. Lodging, "
            "representing and appealing are left to the official route or to an adviser "
            "who is registered to do it, and we will say plainly when a question needs "
            "one."
        ),
        "steps": [
            "Identify the correct government page for the destination and the course.",
            "Read the document list with the family and mark what already exists.",
            "Set out the sequence: offer, then eligibility letter, then application.",
            "Name the questions that need a registered adviser instead.",
        ],
        "includes": [
            "The official page for the route, opened and read together.",
            "A plain-language walk through the document list.",
            "The order the steps have to happen in.",
        ],
        "not_included": [
            "Regulated immigration advice, or representation before any authority.",
            "Lodging, filling or submitting a visa application on your behalf.",
            "Any promise about whether a visa will be granted, or how long it takes.",
        ],
        "who_for": "A family that has an offer and wants to understand what comes next.",
        "fees_note": (
            "Quoted as a single session. A question that needs a registered adviser is "
            "answered with a referral, not with a fee."
        ),
        "available": False,
        "sort_order": 4,
    },
]
