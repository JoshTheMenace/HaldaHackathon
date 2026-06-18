import type { StudentProfile } from "./types";
import { titleCase } from "./match";

// ─────────────────────────────────────────────────────────────────────────────
// Cohort = the student's Class-of community, scoped to THEIR pathway. Seeded
// peers + posts stand in for a real cohort, but everything the student SEES
// (their pathway label, cohort size, the schools being compared, which posts
// surface first) is derived live from their real profile.
// ─────────────────────────────────────────────────────────────────────────────

export interface CohortPeer {
  id: string;
  name: string; // first name + last initial only (privacy)
  avatar: string;
  pathway: string;
}

export interface CohortPost {
  id: string;
  authorId: string; // a peer id, or "halda" for the pinned system post
  pathway: string;
  time: string;
  body: string;
  tags: string[];
  likes: number;
  comments: number;
  system?: boolean;
  pinned?: boolean;
}

// ── High-school peers ────────────────────────────────────────────────────────
// Students from the same high schools as the seeded/simulator profiles — keyed
// by school name so hspeersFor() can surface "from your school" rows.

export interface HighSchoolPeer {
  id: string;
  name: string;
  avatar: string;
  highSchool: string; // exact match against profile.highSchool
  state: string;
  city: string;
  grade: number;
  pathway: string;
  status: string;
  accent: string;
}

export const HS_PEERS: HighSchoolPeer[] = [
  // Austin High School, Austin TX (Maya's HS)
  { id: "hs_jasmine", name: "Jasmine P.", avatar: "https://i.pravatar.cc/80?img=1", highSchool: "Austin High School", state: "TX", city: "Austin", grade: 10, pathway: "Computer Science", status: "applied to UT Austin 🤞", accent: "#bf5700" },
  { id: "hs_carlos", name: "Carlos M.", avatar: "https://i.pravatar.cc/80?img=11", highSchool: "Austin High School", state: "TX", city: "Austin", grade: 11, pathway: "Engineering", status: "on an 8-day streak 🔥", accent: "#bf5700" },
  // Bellaire HS, Houston TX (Devon's HS)
  { id: "hs_naomi", name: "Naomi K.", avatar: "https://i.pravatar.cc/80?img=2", highSchool: "Bellaire HS", state: "TX", city: "Houston", grade: 10, pathway: "Business", status: "saved 5 schools 📌", accent: "#00205b" },
  { id: "hs_trevor", name: "Trevor W.", avatar: "https://i.pravatar.cc/80?img=13", highSchool: "Bellaire HS", state: "TX", city: "Houston", grade: 11, pathway: "Engineering", status: "won a scholarship 🎉", accent: "#00205b" },
  // Grady HS, Atlanta GA (Aisha's HS)
  { id: "hs_imani", name: "Imani T.", avatar: "https://i.pravatar.cc/80?img=3", highSchool: "Grady HS", state: "GA", city: "Atlanta", grade: 10, pathway: "Biology & Life Sciences", status: "touring Georgia Tech 🏛", accent: "#b3a369" },
  { id: "hs_malik", name: "Malik J.", avatar: "https://i.pravatar.cc/80?img=22", highSchool: "Grady HS", state: "GA", city: "Atlanta", grade: 11, pathway: "Computer Science", status: "comparing 6 schools 📊", accent: "#b3a369" },
  // Garfield HS, Seattle WA (Liam's HS)
  { id: "hs_yuki", name: "Yuki N.", avatar: "https://i.pravatar.cc/80?img=4", highSchool: "Garfield HS", state: "WA", city: "Seattle", grade: 10, pathway: "Arts & Design", status: "lit her constellation ✨", accent: "#4b2e83" },
  { id: "hs_rafael", name: "Rafael O.", avatar: "https://i.pravatar.cc/80?img=14", highSchool: "Garfield HS", state: "WA", city: "Seattle", grade: 11, pathway: "Computer Science", status: "on a 5-day streak 🔥", accent: "#4b2e83" },
  // Tempe HS, Tempe AZ (Sofia's HS)
  { id: "hs_chloe", name: "Chloe R.", avatar: "https://i.pravatar.cc/80?img=6", highSchool: "Tempe HS", state: "AZ", city: "Tempe", grade: 10, pathway: "Business", status: "toured ASU last week 🏛", accent: "#8c1d40" },
  { id: "hs_jerome", name: "Jerome B.", avatar: "https://i.pravatar.cc/80?img=16", highSchool: "Tempe HS", state: "AZ", city: "Tempe", grade: 11, pathway: "Biology & Life Sciences", status: "saved 3 schools 📌", accent: "#8c1d40" },
  // Boulder HS, Boulder CO (Noah Kim's HS)
  { id: "hs_piper", name: "Piper L.", avatar: "https://i.pravatar.cc/80?img=7", highSchool: "Boulder HS", state: "CO", city: "Boulder", grade: 10, pathway: "Engineering", status: "on an 11-day streak 🔥", accent: "#cfb87c" },
  { id: "hs_darius", name: "Darius W.", avatar: "https://i.pravatar.cc/80?img=17", highSchool: "Boulder HS", state: "CO", city: "Boulder", grade: 11, pathway: "Computer Science", status: "comparing 8 schools 📊", accent: "#cfb87c" },
  // Boston Latin, Boston MA (Emma Thompson's HS)
  { id: "hs_mei", name: "Mei C.", avatar: "https://i.pravatar.cc/80?img=8", highSchool: "Boston Latin", state: "MA", city: "Boston", grade: 10, pathway: "Biology & Life Sciences", status: "shadowing a doctor 🩺", accent: "#990000" },
  { id: "hs_quinn", name: "Quinn A.", avatar: "https://i.pravatar.cc/80?img=18", highSchool: "Boston Latin", state: "MA", city: "Boston", grade: 11, pathway: "Arts & Design", status: "won a YoungArts award 🎨", accent: "#990000" },
  // Bellevue HS, Bellevue WA (Alex Kim simulator)
  { id: "hs_mia", name: "Mia T.", avatar: "https://i.pravatar.cc/80?img=9", highSchool: "Bellevue High School", state: "WA", city: "Bellevue", grade: 10, pathway: "Computer Science", status: "submitted MIT app 🎓", accent: "#4b2e83" },
  { id: "hs_ethan", name: "Ethan G.", avatar: "https://i.pravatar.cc/80?img=19", highSchool: "Bellevue High School", state: "WA", city: "Bellevue", grade: 11, pathway: "Engineering", status: "PSAT semi-finalist 🏅", accent: "#4b2e83" },
  // Evanston Township HS, IL (Amara Diallo simulator)
  { id: "hs_nia", name: "Nia F.", avatar: "https://i.pravatar.cc/80?img=23", highSchool: "Evanston Township High School", state: "IL", city: "Evanston", grade: 10, pathway: "Business", status: "DECA regional winner 🏆", accent: "#13294b" },
  { id: "hs_sam", name: "Sam V.", avatar: "https://i.pravatar.cc/80?img=24", highSchool: "Evanston Township High School", state: "IL", city: "Evanston", grade: 11, pathway: "Arts & Design", status: "on a 7-day streak 🔥", accent: "#13294b" },
  // Rio Grande HS, Albuquerque NM (Emma Rivera simulator)
  { id: "hs_luna", name: "Luna E.", avatar: "https://i.pravatar.cc/80?img=25", highSchool: "Rio Grande High School", state: "NM", city: "Albuquerque", grade: 10, pathway: "Arts & Design", status: "saved 4 schools 📌", accent: "#c0392b" },
  { id: "hs_oscar", name: "Oscar T.", avatar: "https://i.pravatar.cc/80?img=26", highSchool: "Rio Grande High School", state: "NM", city: "Albuquerque", grade: 11, pathway: "Engineering", status: "first-gen scholar 🎉", accent: "#c0392b" },
  // Lincoln HS, Portland OR (Kenji Nakamura simulator)
  { id: "hs_fiona", name: "Fiona L.", avatar: "https://i.pravatar.cc/80?img=27", highSchool: "Lincoln High School", state: "OR", city: "Portland", grade: 10, pathway: "Computer Science", status: "built a hackathon project 💻", accent: "#006a4e" },
  { id: "hs_dan", name: "Dan P.", avatar: "https://i.pravatar.cc/80?img=28", highSchool: "Lincoln High School", state: "OR", city: "Portland", grade: 11, pathway: "Biology & Life Sciences", status: "shadowing at OHSU 🩺", accent: "#006a4e" },
  // Westland HS, Columbus OH (Marcus Johnson simulator)
  { id: "hs_tanya", name: "Tanya B.", avatar: "https://i.pravatar.cc/80?img=29", highSchool: "Westland High School", state: "OH", city: "Columbus", grade: 10, pathway: "Engineering", status: "toured Ohio State 🏛", accent: "#bb0000" },
  { id: "hs_kevin", name: "Kevin O.", avatar: "https://i.pravatar.cc/80?img=30", highSchool: "Westland High School", state: "OH", city: "Columbus", grade: 11, pathway: "Business", status: "on a 4-day streak 🔥", accent: "#bb0000" },
  // Lynbrook HS, San Jose CA (Sarah Chen simulator)
  { id: "hs_jenny", name: "Jenny H.", avatar: "https://i.pravatar.cc/80?img=33", highSchool: "Lynbrook High School", state: "CA", city: "San Jose", grade: 10, pathway: "Computer Science", status: "comparing 7 schools 📊", accent: "#1e3a5f" },
  { id: "hs_aaron", name: "Aaron Z.", avatar: "https://i.pravatar.cc/80?img=34", highSchool: "Lynbrook High School", state: "CA", city: "San Jose", grade: 11, pathway: "Biology & Life Sciences", status: "won the Regeneron STS 🏅", accent: "#1e3a5f" },
  // Timpview HS, Provo UT (default profile HS)
  { id: "hs_brynn", name: "Brynn M.", avatar: "https://i.pravatar.cc/80?img=35", highSchool: "Timpview High School", state: "UT", city: "Provo", grade: 10, pathway: "Nursing & Health", status: "applied for the UVU grant 🎉", accent: "#0057a8" },
  { id: "hs_cole", name: "Cole J.", avatar: "https://i.pravatar.cc/80?img=36", highSchool: "Timpview High School", state: "UT", city: "Provo", grade: 11, pathway: "Computer Science", status: "on a 9-day streak 🔥", accent: "#0057a8" },
];

// ── Current college students ─────────────────────────────────────────────────
// Real-ish students enrolled at schools in the catalog — surfaces in a
// "Hear from someone who goes there" section when user saves / matches a school.

export interface CollegeStudent {
  id: string;
  name: string;
  avatar: string;
  schoolId: string; // matches School.id in schools.ts
  schoolShort: string; // display name
  major: string;
  year: string; // "Freshman" | "Sophomore" | "Junior" | "Senior"
  blurb: string;
  accent: string;
}

export const COLLEGE_STUDENTS: CollegeStudent[] = [
  { id: "col_kai", name: "Kai R.", avatar: "https://i.pravatar.cc/80?img=37", schoolId: "uw", schoolShort: "UW", major: "Computer Science", year: "Junior", blurb: "The CS program here is intense but the startup culture is unreal. Happy to answer questions about research labs or co-ops.", accent: "#4b2e83" },
  { id: "col_amelia", name: "Amelia S.", avatar: "https://i.pravatar.cc/80?img=38", schoolId: "uw", schoolShort: "UW", major: "Nursing", year: "Sophomore", blurb: "Got the WWAMI scholarship. The clinical hours start early — ask me anything about the BSN application.", accent: "#4b2e83" },
  { id: "col_miguel", name: "Miguel T.", avatar: "https://i.pravatar.cc/80?img=39", schoolId: "ut-austin", schoolShort: "UT Austin", major: "Computer Science", year: "Junior", blurb: "First-gen, needsAid — Dell Scholars covered most of my tuition. Lots of AI research here if that's your thing.", accent: "#bf5700" },
  { id: "col_cora", name: "Cora B.", avatar: "https://i.pravatar.cc/80?img=40", schoolId: "ut-austin", schoolShort: "UT Austin", major: "Business", year: "Senior", blurb: "McCombs is huge but the alumni network is insane. I had 3 internship offers by junior year. Ask me anything.", accent: "#bf5700" },
  { id: "col_james", name: "James W.", avatar: "https://i.pravatar.cc/80?img=41", schoolId: "gatech", schoolShort: "Georgia Tech", major: "Electrical Engineering", year: "Junior", blurb: "Co-op program paid for a semester at Intel. The workload is real but the job placement is worth it.", accent: "#b3a369" },
  { id: "col_nadia", name: "Nadia A.", avatar: "https://i.pravatar.cc/80?img=42", schoolId: "gatech", schoolShort: "Georgia Tech", major: "Computer Science", year: "Sophomore", blurb: "Came from Atlanta — knew the city, which helped. The CS workload is challenging but everyone is in it together.", accent: "#b3a369" },
  { id: "col_lena", name: "Lena H.", avatar: "https://i.pravatar.cc/80?img=43", schoolId: "asu", schoolShort: "ASU", major: "Business Analytics", year: "Junior", blurb: "Tempe is amazing if you like warm weather and startup energy. Scholarship options are great for in-state students.", accent: "#8c1d40" },
  { id: "col_marcus2", name: "Marcus N.", avatar: "https://i.pravatar.cc/80?img=44", schoolId: "asu", schoolShort: "ASU", major: "Engineering", year: "Sophomore", blurb: "The engineering college has tons of labs. I'm doing research on solar energy — DM me if you're into that.", accent: "#8c1d40" },
  { id: "col_priya2", name: "Priya L.", avatar: "https://i.pravatar.cc/80?img=46", schoolId: "purdue", schoolShort: "Purdue", major: "Aerospace Engineering", year: "Junior", blurb: "Purdue aerospace is #2 in the country. Co-ops at SpaceX and Boeing are common. The winters are rough though 😅", accent: "#cfb87c" },
  { id: "col_derek", name: "Derek O.", avatar: "https://i.pravatar.cc/80?img=47", schoolId: "purdue", schoolShort: "Purdue", major: "Computer Science", year: "Senior", blurb: "Got a FAANG offer before graduation. The CS program here is very industry-focused — lots of interview prep culture.", accent: "#cfb87c" },
  { id: "col_sasha", name: "Sasha M.", avatar: "https://i.pravatar.cc/80?img=48", schoolId: "northeastern", schoolShort: "Northeastern", major: "Data Science", year: "Junior", blurb: "Co-op rotation at a Boston biotech startup was the best thing I did. The co-op program is Northeastern's biggest flex.", accent: "#c8102e" },
  { id: "col_ben", name: "Ben F.", avatar: "https://i.pravatar.cc/80?img=49", schoolId: "northeastern", schoolShort: "Northeastern", major: "Computer Science", year: "Sophomore", blurb: "First-gen, got a big merit scholarship. Boston has a huge student population — always something going on.", accent: "#c8102e" },
  { id: "col_grace", name: "Grace Y.", avatar: "https://i.pravatar.cc/80?img=50", schoolId: "byu", schoolShort: "BYU", major: "Computer Science", year: "Junior", blurb: "Tuition is incredibly low here. The CS program has a great job placement rate and a tight-knit community.", accent: "#002e5d" },
  { id: "col_evan", name: "Evan K.", avatar: "https://i.pravatar.cc/80?img=51", schoolId: "byu", schoolShort: "BYU", major: "Business", year: "Senior", blurb: "The Marriott School business program is top-tier. Lots of entrepreneurship resources and alumni connections.", accent: "#002e5d" },
  { id: "col_diana", name: "Diana V.", avatar: "https://i.pravatar.cc/80?img=52", schoolId: "uvu", schoolShort: "UVU", major: "Nursing", year: "Sophomore", blurb: "Got the UVU Nursing Grant as a first-gen student. The clinical program is smaller so you get more hands-on time.", accent: "#275d38" },
  { id: "col_alex2", name: "Alex C.", avatar: "https://i.pravatar.cc/80?img=53", schoolId: "uvu", schoolShort: "UVU", major: "Computer Science", year: "Junior", blurb: "Transferred from community college — UVU made the transfer super smooth. Great tech internship pipeline in Utah.", accent: "#275d38" },
  { id: "col_tasha", name: "Tasha W.", avatar: "https://i.pravatar.cc/80?img=54", schoolId: "spelman", schoolShort: "Spelman", major: "Biology", year: "Junior", blurb: "The HBCU experience is unlike anything else. Strong pre-med program and an unmatched sisterhood. I love it here.", accent: "#003366" },
  { id: "col_rio", name: "Rio M.", avatar: "https://i.pravatar.cc/80?img=55", schoolId: "calpoly", schoolShort: "Cal Poly", major: "Mechanical Engineering", year: "Senior", blurb: "Learn by doing is real — built a CubeSat sophomore year. Industry hires heavily from Cal Poly.", accent: "#154734" },
  { id: "col_ivy", name: "Ivy L.", avatar: "https://i.pravatar.cc/80?img=56", schoolId: "colorado", schoolShort: "CU Boulder", major: "Aerospace", year: "Junior", blurb: "Colorado research on satellites is legit. Outdoor lifestyle + rigorous STEM = best of both worlds.", accent: "#cfb87c" },
  { id: "col_omar", name: "Omar S.", avatar: "https://i.pravatar.cc/80?img=57", schoolId: "rice", schoolShort: "Rice", major: "Computer Science", year: "Junior", blurb: "Small school, huge resources. Every student gets a research mentor. The residential college system is like living in a tight community.", accent: "#00205b" },
];

// ── Auto-generated peers ─────────────────────────────────────────────────────
// Generates 1-2 phantom peers whose profile roughly mirrors the student's own
// signals — makes the community feel immediately relevant on first load.

const FIRST_NAMES = ["Taylor", "Jordan", "Morgan", "Riley", "Quinn", "Avery", "Casey", "Skyler", "Drew", "Alex", "Cameron", "Sage", "Reese", "Blake", "Logan"];
const LAST_INITS = ["A", "B", "C", "D", "F", "G", "H", "J", "K", "L", "M", "N", "P", "R", "S", "T", "V", "W"];
const GEN_STATUSES = ["just joined Halda 🌱", "comparing 4 schools 📊", "on a 3-day streak 🔥", "lit their constellation ✨", "saved their first school 📌"];
const GEN_ACCENTS = ["#4b5563", "#0057a8", "#166534", "#7c3aed", "#b45309", "#065f46"];

function stableRng(seed: string, max: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  return Math.abs(h) % max;
}

export function generateAlignedPeers(p: StudentProfile): HighSchoolPeer[] {
  const pathway = pathwayFor(p);
  if (!pathway) return [];
  const seed = `${p.state || ""}${pathway}`;
  const peers: HighSchoolPeer[] = [];
  for (let i = 0; i < 2; i++) {
    const ns = seed + i;
    const name = `${FIRST_NAMES[stableRng(ns + "f", FIRST_NAMES.length)]} ${LAST_INITS[stableRng(ns + "l", LAST_INITS.length)]}.`;
    const imgN = stableRng(ns + "img", 70) + 1;
    peers.push({
      id: `gen_${i}_${stableRng(ns, 999)}`,
      name,
      avatar: `https://i.pravatar.cc/80?img=${imgN}`,
      highSchool: p.highSchool || (p.state ? `${p.state} High School` : "Your high school"),
      state: p.state || "UT",
      city: p.city || "Provo",
      grade: p.grade || 10,
      pathway,
      status: GEN_STATUSES[stableRng(ns + "s", GEN_STATUSES.length)],
      accent: GEN_ACCENTS[stableRng(ns + "a", GEN_ACCENTS.length)],
    });
  }
  return peers;
}

// ── Existing cohort peers (pathway-level feed) ───────────────────────────────
// A couple of seeded community members (the "couple of user profiles" we seed).
export const COHORT_PEERS: CohortPeer[] = [
  { id: "p_jordan", name: "Jordan L.", avatar: "https://i.pravatar.cc/80?img=32", pathway: "Nursing & Health" },
  { id: "p_priya", name: "Priya S.", avatar: "https://i.pravatar.cc/80?img=45", pathway: "Nursing & Health" },
  { id: "p_marcus", name: "Marcus B.", avatar: "https://i.pravatar.cc/80?img=12", pathway: "Health Sciences" },
  { id: "p_ava", name: "Ava T.", avatar: "https://i.pravatar.cc/80?img=5", pathway: "Computer Science" },
  { id: "p_diego", name: "Diego R.", avatar: "https://i.pravatar.cc/80?img=15", pathway: "Engineering" },
  { id: "p_lily", name: "Lily M.", avatar: "https://i.pravatar.cc/80?img=20", pathway: "Biology & Life Sciences" },
];

export const peerById = (id: string) => COHORT_PEERS.find((p) => p.id === id);

// ── Lookup helpers ───────────────────────────────────────────────────────────

// Returns HS peers at the student's school, padded with generated ones.
export function hspeersFor(p: StudentProfile): HighSchoolPeer[] {
  const hs = p.highSchool;
  const same = hs ? HS_PEERS.filter((x) => x.highSchool.toLowerCase() === hs.toLowerCase()) : [];
  const generated = generateAlignedPeers(p);
  // De-dup generated names against seeded ones.
  const seenNames = new Set(same.map((x) => x.name));
  const extra = generated.filter((g) => !seenNames.has(g.name));
  return [...same, ...extra].slice(0, 4);
}

// Returns college students enrolled at the given school IDs.
export function collegeStudentsFor(schoolIds: string[]): CollegeStudent[] {
  if (!schoolIds.length) return [];
  const idSet = new Set(schoolIds);
  const matched = COLLEGE_STUDENTS.filter((s) => idSet.has(s.schoolId));
  // Up to 1 per school, max 4 total.
  const seen = new Set<string>();
  return matched.filter((s) => (seen.has(s.schoolId) ? false : seen.add(s.schoolId))).slice(0, 4);
}

export const COHORT_POSTS: CohortPost[] = [
  {
    id: "post_jordan", authorId: "p_jordan", pathway: "Nursing & Health", time: "2h ago",
    body: "Just got the UVU Nursing Grant for first-gen students 🎉 The Halda guide walked me through every form. If anyone's nervous about the essay, happy to share what I wrote.",
    tags: ["Scholarship", "FirstGen", "UVU"], likes: 64, comments: 9,
  },
  {
    id: "post_priya", authorId: "p_priya", pathway: "Nursing & Health", time: "5h ago",
    body: "Anyone else taking the TEAS before winter break? Starting a study group on Saturdays at the Orem library — we have 4 so far. Comment if you want in.",
    tags: ["StudyGroup", "TEAS", "Local"], likes: 27, comments: 18,
  },
  {
    id: "post_marcus", authorId: "p_marcus", pathway: "Health Sciences", time: "1d ago",
    body: "FAFSA question — do I list my parent's income if they're self-employed? Not sure which line. Any tips appreciated 🙏",
    tags: ["FAFSA", "Question"], likes: 11, comments: 23,
  },
  {
    id: "post_ava", authorId: "p_ava", pathway: "Computer Science", time: "3h ago",
    body: "Built my first portfolio site this weekend! If you're applying CS, a GitHub with even one real project goes a long way. Happy to review anyone's.",
    tags: ["CompSci", "Portfolio", "Question"], likes: 41, comments: 7,
  },
  {
    id: "post_diego", authorId: "p_diego", pathway: "Engineering", time: "6h ago",
    body: "Reminder the PSAT is coming up — it's the qualifier for National Merit. Khan Academy's free practice actually helped me jump 120 points.",
    tags: ["PSAT", "Study"], likes: 33, comments: 5,
  },
  {
    id: "post_lily", authorId: "p_lily", pathway: "Biology & Life Sciences", time: "8h ago",
    body: "Touring the U of U biology labs next Friday for anyone local — they let sophomores shadow a research group. Ask your counselor's office to sign up.",
    tags: ["Biology", "Local", "Tour"], likes: 19, comments: 12,
  },
];

// The student's pathway, derived from their real major / strongest interest.
export function pathwayFor(p: StudentProfile): string {
  const m = (p.intendedMajors[0] || p.interestSignals[0]?.interest || "").toLowerCase();
  if (!m) return "";
  if (/nurs|pre-?med|medic|health/.test(m)) return "Nursing & Health";
  if (/comput|software|coding|\bcs\b|program|data|\bai\b|machine learning/.test(m)) return "Computer Science";
  if (/engineer/.test(m)) return "Engineering";
  if (/bio|life scien|ecolog|marine/.test(m)) return "Biology & Life Sciences";
  if (/business|finance|econ|account|marketing|entrepre/.test(m)) return "Business";
  if (/art|design|film|music|theat|anim|fashion|media/.test(m)) return "Arts & Design";
  return titleCase(m);
}

// Short chip label for the pathway, e.g. "Nursing & Health" → "Nursing".
export const pathwayShort = (pathway: string) => pathway.split(/[&]/)[0].trim().split(" ")[0];

// Believable cohort size for a pathway label (seeded, stable).
export function cohortSize(pathway: string): number {
  const base: Record<string, number> = {
    "Nursing & Health": 248, "Computer Science": 312, "Engineering": 196,
    "Biology & Life Sciences": 174, "Business": 220, "Arts & Design": 143, "Health Sciences": 168,
  };
  return base[pathway] ?? 180;
}

// Peer faces for the banner — on-pathway first, padded with others.
export function cohortFaces(pathway: string): CohortPeer[] {
  const on = COHORT_PEERS.filter((p) => p.pathway === pathway);
  const rest = COHORT_PEERS.filter((p) => p.pathway !== pathway);
  return [...on, ...rest].slice(0, 4);
}

// Posts ranked for this student: same-pathway first, then broadly useful ones.
export function postsFor(p: StudentProfile): CohortPost[] {
  const path = pathwayFor(p);
  const broad = /FAFSA|Scholarship|PSAT|Question/;
  const score = (post: CohortPost) => (post.pathway === path ? 2 : broad.test(post.tags.join()) ? 1 : 0);
  return [...COHORT_POSTS].sort((a, b) => score(b) - score(a) || b.likes - a.likes);
}
