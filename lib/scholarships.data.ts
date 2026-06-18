// Real, well-known U.S. scholarships with structured eligibility, so "find
// scholarships" can match against the student's actual profile (need, first-gen,
// major, state, grade) instead of generic categories. Amounts are approximate
// and award terms change yearly — the agent always says to verify on the site.
export interface ScholarshipEntry {
  name: string;
  amount: string;
  url?: string;
  needBased?: boolean;
  firstGen?: boolean;
  merit?: boolean; // strongly grades/achievement driven
  majors?: string[]; // category tags (stem/engineering/health/nursing/business/arts); omit = any major
  states?: string[]; // USPS codes; omit = national
  blurb: string; // what it rewards
}

export const SCHOLARSHIPS: ScholarshipEntry[] = [
  // ── National, broad ──────────────────────────────────────────────────────
  { name: "Coca-Cola Scholars Program", amount: "$20,000", url: "https://www.coca-colascholarsfoundation.org", merit: true, blurb: "leadership and service for graduating seniors" },
  { name: "Jack Kent Cooke College Scholarship", amount: "up to $55,000/yr", url: "https://www.jkcf.org", needBased: true, merit: true, blurb: "high-achieving students with financial need" },
  { name: "QuestBridge National College Match", amount: "full 4-yr scholarship", url: "https://www.questbridge.org", needBased: true, merit: true, blurb: "high-achieving, low-income students matched to top colleges" },
  { name: "Dell Scholars Program", amount: "$20,000", url: "https://www.dellscholars.org", needBased: true, firstGen: true, blurb: "grit and need over GPA alone" },
  { name: "Horatio Alger National Scholarship", amount: "$25,000", url: "https://scholars.horatioalger.org", needBased: true, blurb: "perseverance through adversity + financial need" },
  { name: "GE-Reagan Foundation Scholarship", amount: "$10,000/yr", url: "https://www.reaganfoundation.org", needBased: true, merit: true, blurb: "leadership, integrity, and need for seniors" },
  { name: "Elks Most Valuable Student", amount: "up to $50,000", url: "https://www.elks.org/scholars", needBased: true, merit: true, blurb: "leadership + financial need, no Elks affiliation required" },
  { name: "Burger King Scholars", amount: "$1,000–$60,000", url: "https://burgerkingscholars.com", needBased: true, blurb: "broad, GPA 2.5+, open to seniors (and BK employees' families)" },
  { name: "Cameron Impact Scholarship", amount: "full tuition", url: "https://www.bryancameroneducationfoundation.org", merit: true, blurb: "academic excellence + community impact" },
  { name: "Equitable Excellence Scholarship", amount: "$2,500–$25,000", url: "https://equitable.com/foundation", blurb: "achievement outside the classroom for seniors" },
  { name: "National Merit Scholarship", amount: "$2,500+", url: "https://www.nationalmerit.org", merit: true, blurb: "qualify through a strong PSAT/NMSQT junior year" },

  // ── STEM / engineering ───────────────────────────────────────────────────
  { name: "Regeneron Science Talent Search", amount: "up to $250,000", url: "https://www.societyforscience.org/regeneron-sts", merit: true, majors: ["stem"], blurb: "original STEM research projects, seniors" },
  { name: "Davidson Fellows Scholarship", amount: "up to $50,000", url: "https://www.davidsongifted.org/fellows", merit: true, majors: ["stem", "arts"], blurb: "a significant STEM, literature, or music project" },
  { name: "Society of Women Engineers (SWE) Scholarship", amount: "$1,000–$15,000", url: "https://swe.org/scholarships", majors: ["engineering", "stem"], blurb: "women pursuing engineering or computing" },
  { name: "Buick Achievers Scholarship", amount: "up to $25,000", url: "https://www.buickachievers.com", needBased: true, merit: true, majors: ["stem", "engineering"], blurb: "STEM majors with financial need" },

  // ── Health / nursing ─────────────────────────────────────────────────────
  { name: "Tylenol Future Care Scholarship", amount: "$5,000–$10,000", url: "https://www.tylenol.com/news/scholarship", majors: ["health", "nursing"], blurb: "students headed into healthcare" },
  { name: "NSNA Foundation Scholarship", amount: "$1,000–$7,500", url: "https://www.nsna.org", majors: ["nursing", "health"], blurb: "nursing students at every stage" },

  // ── Business ─────────────────────────────────────────────────────────────
  { name: "DECA & FBLA Scholarships", amount: "$1,000–$10,000", url: "https://www.deca.org/scholarships", majors: ["business"], blurb: "future business leaders" },

  // ── Arts / design ────────────────────────────────────────────────────────
  { name: "YoungArts National Arts Competition", amount: "up to $10,000", url: "https://youngarts.org", majors: ["arts"], blurb: "visual, literary, design, and performing artists" },
  { name: "Scholastic Art & Writing Awards", amount: "up to $12,500", url: "https://www.artandwriting.org", majors: ["arts"], blurb: "creative teens in art and writing" },

  // ── A few state-specific (demo states) ───────────────────────────────────
  { name: "Utah New Century Scholarship", amount: "up to 75% of tuition", url: "https://ushe.edu", states: ["UT"], merit: true, blurb: "Utah students who finish an associate degree early or strong STEM/math track" },
  { name: "Utah Regents' Scholarship", amount: "$1,000–$2,500", url: "https://ushe.edu", states: ["UT"], merit: true, blurb: "Utah students completing a rigorous core course of study" },
  { name: "TEXAS Grant", amount: "tuition + fees", url: "https://www.collegeforalltexans.com", states: ["TX"], needBased: true, blurb: "Texas students with financial need at in-state public schools" },
  { name: "Terry Foundation Scholarship", amount: "full ride", url: "https://www.terryfoundation.org", states: ["TX"], needBased: true, merit: true, blurb: "Texas seniors attending a Terry partner university" },
];
