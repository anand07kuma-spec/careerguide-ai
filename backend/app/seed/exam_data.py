"""The exam catalogue as it was written on the `/exams` screen.

This file is that screen's `const GROUPS` array, moved rather than rewritten: the eleven
exams and the nine doors they sit under, with the same sentences. The prose was already
built around a refusal — no application dates, no fees, no eligibility percentages, no
age limits, no cutoffs, no seat counts, no result dates, no placement figures, because
all of them change every year and nobody here can verify them — and moving the data
behind an API must not be the thing that quietly changes it.

So every row here has `exam_date = NULL`, `fee_note = NULL`, `source_url = NULL` and
`verified = False`. That is not an oversight to fill in later; it is the same state an
operator's new row starts in, and the same rule: a figure arrives with the page it was
read from. Until then the card prints the sentence that names the official notification
as the only authority, exactly as it did when the text lived in the bundle.
"""

from __future__ import annotations

# (group, [exams]) in the order the page prints them. `sort_order` is the position within
# the group; the group order comes from the position in this list.
GROUPS: list[dict] = [
    {
        "title": "Become an engineer",
        "description": (
            "You clear the exam first, then take part in official seat allotment for "
            "engineering colleges."
        ),
        "exams": [
            {
                "name": "JEE Main",
                "authority": "Conducted by NTA",
                "description": (
                    "JEE Main is the entrance test that lets you take part in seat "
                    "allotment for the IITs, NITs, IIITs and many other government "
                    "engineering colleges across India."
                ),
                "careers": (
                    "Engineering degrees (B.Tech / B.E.) that lead to software, "
                    "electronics, mechanical, civil and many other careers."
                ),
                "timeline": (
                    "Students normally start paying attention in class 11 and sit for it "
                    "in or just after class 12. Who can apply in a given year is only "
                    "ever written in that year's official notification."
                ),
                "preparation": (
                    "Make your class 9 and 10 maths and science basics genuinely strong — "
                    "the syllabus stands on them. The syllabus PDF, previous question "
                    "papers and NCERT books are all free on the official sites."
                ),
            },
        ],
    },
    {
        "title": "Become a doctor or work in healthcare",
        "description": (
            "One national exam carries most of the weight for medical courses; some "
            "healthcare courses have their own routes."
        ),
        "exams": [
            {
                "name": "NEET UG",
                "authority": "Conducted by NTA",
                "description": (
                    "NEET UG is the single entrance test for MBBS, BDS and AYUSH seats in "
                    "government and private medical colleges across India."
                ),
                "careers": (
                    "Doctor, dentist and related medical careers. Nursing, pharmacy and "
                    "some allied courses may use separate state or institute exams — "
                    "check each one officially."
                ),
                "timeline": (
                    "The syllabus is the class 11 and 12 biology, physics and chemistry, "
                    "so students usually start paying real attention from class 11."
                ),
                "preparation": (
                    "Read the class 9 and 10 NCERT science books closely and enjoy the "
                    "biology chapters — a large part of the paper comes straight from "
                    "NCERT lines, and NCERT books are free on the official NCERT site."
                ),
            },
        ],
    },
    {
        "title": "Get into a university degree course",
        "description": "These exams are a door to a degree, not to one fixed career.",
        "exams": [
            {
                "name": "CUET (UG)",
                "authority": "Conducted by NTA",
                "description": (
                    "CUET UG is used for first-year admission to many central universities "
                    "and a growing set of other universities for degrees like B.A, B.Sc "
                    "and B.Com."
                ),
                "careers": (
                    "It does not open one career — it opens the university degree you "
                    "choose, and the careers and postgraduate routes that follow it."
                ),
                "timeline": (
                    "Students pay attention in class 12, when university applications "
                    "open. Which universities use CUET, and for which courses, changes — "
                    "check that year's notification and the university's own site."
                ),
                "preparation": (
                    "Go deep in the two or three subjects you like most and build reading "
                    "speed in English. University papers test understanding, not "
                    "last-month cramming."
                ),
            },
        ],
    },
    {
        "title": "Become a lawyer",
        "description": (
            "Law can be started right after class 12 as a five-year course, or later "
            "through a three-year degree."
        ),
        "exams": [
            {
                "name": "CLAT",
                "authority": "Conducted by the Consortium of National Law Universities",
                "description": (
                    "CLAT is the common entrance test for the five-year law programmes at "
                    "the National Law Universities. Many other law colleges either accept "
                    "CLAT or hold their own separate tests."
                ),
                "careers": (
                    "A law degree that leads to working as an advocate, a legal advisor in "
                    "companies, or — through separate later exams — judicial services. The "
                    "path after the degree has its own exams."
                ),
                "timeline": (
                    "Class 11 or 12, if law appeals to you. Hearing about it later is fine "
                    "too — a three-year law course exists for students who join it after "
                    "any graduation."
                ),
                "preparation": (
                    "Read a newspaper opinion page every week and practise reading "
                    "comprehension. Law papers test how you read and reason, not what you "
                    "memorise — and the Consortium publishes free sample questions on its "
                    "official site."
                ),
            },
        ],
    },
    {
        "title": "Become a defence officer",
        "description": (
            "The armed forces select through their own official process, announced in "
            "their own notifications."
        ),
        "exams": [
            {
                "name": "NDA / NA",
                "authority": "Conducted by UPSC for the Ministry of Defence",
                "description": (
                    "The NDA and NA exam is the route through which the Army, Navy and "
                    "Air Force select cadets for the National Defence Academy and the "
                    "Naval Academy."
                ),
                "careers": (
                    "A commissioned officer's career in the Indian Armed Forces, with "
                    "training and service rules set by the defence services themselves."
                ),
                "timeline": (
                    "Students aiming for a defence career follow it in class 11 and 12. "
                    "Age, course and eligibility conditions change and are written only in "
                    "the official notification — search for UPSC and its site, upsc.gov.in."
                ),
                "preparation": (
                    "Build a fitness habit, follow the armed forces through official and "
                    "news sources, and keep maths and English strong — the paper tests "
                    "basics you are already meeting in class 9 and 10."
                ),
            },
        ],
    },
    {
        "title": "Become a chartered accountant or company secretary",
        "description": (
            "Professional bodies run their own entry routes; the rules of a route live on "
            "the body's own site."
        ),
        "exams": [
            {
                "name": "CA Foundation / CS Executive route",
                "authority": "Run by ICAI and ICSI",
                "description": (
                    "Some careers are run by their own professional bodies. Chartered "
                    "Accountancy begins with the CA Foundation exam held by ICAI, and the "
                    "Company Secretary route begins with ICSI's own entry programme and "
                    "exams."
                ),
                "careers": (
                    "Chartered accountant, company secretary, and audit, tax, finance and "
                    "compliance careers."
                ),
                "timeline": (
                    "Most students first look at these routes in or just after class 12. "
                    "Registration rules and route structure change — the current scheme on "
                    "the ICAI and ICSI official sites is the only authority."
                ),
                "preparation": (
                    "Get comfortable with basic book-keeping, numbers and business news. "
                    "Both bodies publish introductory study material on their official "
                    "sites — read it for free before deciding anything."
                ),
            },
        ],
    },
    {
        "title": "Government office and banking jobs",
        "description": (
            "Recruiting bodies hold common exams for posts; most need a degree first, and "
            "some are open earlier."
        ),
        "exams": [
            {
                "name": "SSC CGL",
                "authority": "Conducted by the Staff Selection Commission",
                "description": (
                    "SSC CGL (Combined Graduate Level) is a central-government exam that "
                    "selects candidates for many office and inspector-level posts across "
                    "government departments."
                ),
                "careers": (
                    "Assistant, inspector and other office posts in central government "
                    "departments."
                ),
                "timeline": (
                    "This is a graduate-level exam, so students normally meet it during or "
                    "after their degree, not in class 12. Every post, date and rule is "
                    "only in that year's official notification."
                ),
                "preparation": (
                    "Nothing direct yet — but strong maths speed, English and general "
                    "awareness are the three parts of almost every government exam, and "
                    "all three can be built free from class 9 and 10 onwards."
                ),
            },
            {
                "name": "IBPS banking exams",
                "authority": "Conducted by IBPS",
                "description": (
                    "IBPS holds common recruitment exams for public-sector banks. Some "
                    "clerical-level exams are open after class 12, and most officer and "
                    "clerk exams come after a degree — the year's notification says "
                    "exactly who can apply."
                ),
                "careers": (
                    "Clerk, probationary officer and other careers in public-sector banks."
                ),
                "timeline": (
                    "Mostly during or after graduation; a few bank clerical exams appear "
                    "right after school."
                ),
                "preparation": (
                    "Practise arithmetic for speed and accuracy and start a habit of "
                    "reading current events. Both cost nothing and both help in every "
                    "later exam."
                ),
            },
        ],
    },
    {
        "title": "Design, fashion and architecture",
        "description": (
            "Creative routes test seeing, drawing and thinking — habits that grow slowly "
            "and free. For architecture the admission rules have changed in recent years, "
            "so verify the current route on the Council of Architecture and "
            "conducting-body sites rather than guessing."
        ),
        "exams": [
            {
                "name": "UCEED",
                "authority": "Conducted by an IIT",
                "description": (
                    "UCEED is the entrance test for the Bachelor of Design programmes at "
                    "the IITs — a design degree, not an engineering one."
                ),
                "careers": (
                    "Product design, communication design and other design careers."
                ),
                "timeline": (
                    "Class 12. Unlike JEE, design papers test observation, drawing and "
                    "problem-solving more than memorised facts."
                ),
                "preparation": (
                    "Sketch a little every day, keep an idea notebook, and look at the "
                    "free previous papers on the official UCEED site."
                ),
            },
            {
                "name": "NID and NIFT entrance exams",
                "authority": "Run by NID and NIFT",
                "description": (
                    "NID (National Institute of Design) and NIFT (National Institute of "
                    "Fashion Technology) hold their own entrance tests, including studio "
                    "and ability-based rounds, for their design and fashion programmes."
                ),
                "careers": (
                    "Design, fashion, lifestyle products, animation and related creative "
                    "careers."
                ),
                "timeline": (
                    "Class 12, for students who love making and looking at things. Their "
                    "tests reward habits built over years, not last-month cramming."
                ),
                "preparation": (
                    "Make things — sketches, crafts, mood boards, upcycled objects. Both "
                    "institutes explain their exam structure on their own official websites."
                ),
            },
        ],
    },
    {
        "title": "Close to home: state exams",
        "description": (
            "Many states run their own exams alongside the national ones, often for the "
            "state's own colleges."
        ),
        "exams": [
            {
                "name": "State CETs and state entrance exams",
                "authority": "Run by your state's exam authority",
                "description": (
                    "Many states hold their own exams — often called a CET or state "
                    "entrance test — for seats in state-government colleges for "
                    "engineering and other programmes. In some states this matters as much "
                    "as the national exam."
                ),
                "careers": (
                    "Seats in your state's colleges, and state-level recruitment exams "
                    "that come later, after your course."
                ),
                "timeline": (
                    "Class 11 or 12, if you plan to study in your home state. Each state's "
                    "authority sets its own rules every year, so the state notification is "
                    "the only authority."
                ),
                "preparation": (
                    "Ask your school which state exams local students write, then search "
                    "for the state exam authority's official site. Genuine government "
                    "portals end in .gov.in or the state's official domain."
                ),
            },
        ],
    },
]


def exam_rows() -> list[dict]:
    """Flatten the tree into rows the seeder can insert, with the two orders assigned.

    Nothing is invented on the way: the date, the fee and the source stay `None` for every
    row, and `verified` stays False, which is the state the public read publishes as "no
    figure here — the official notification is the authority".
    """
    rows: list[dict] = []
    for group_order, group in enumerate(GROUPS):
        for exam_order, exam in enumerate(group["exams"]):
            rows.append(
                {
                    **exam,
                    "group_title": group["title"],
                    "group_description": group["description"],
                    "group_order": group_order,
                    "sort_order": exam_order,
                    "exam_date": None,
                    "fee_note": None,
                    "source_url": None,
                    "verified": False,
                }
            )
    return rows
