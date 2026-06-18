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
  { name: "Burger King Scholars", amount: "$1,000–$60,000", url: "https://burgerkingscholars.com", needBased: true, blurb: "broad eligibility, GPA 2.5+, open to seniors (and BK employees' families)" },
  { name: "Cameron Impact Scholarship", amount: "full tuition", url: "https://www.bryancameroneducationfoundation.org", merit: true, blurb: "academic excellence + community impact" },
  { name: "Equitable Excellence Scholarship", amount: "$2,500–$25,000", url: "https://equitable.com/foundation", blurb: "achievement outside the classroom for seniors" },
  { name: "National Merit Scholarship", amount: "$2,500+", url: "https://www.nationalmerit.org", merit: true, blurb: "qualify through a strong PSAT/NMSQT junior year" },
  { name: "Rotary Foundation Global Grant", amount: "$30,000+", url: "https://www.rotary.org/en/our-programs/scholarships", merit: true, blurb: "graduate-level study or research that aligns with Rotary's areas of focus" },
  { name: "Prudential Spirit of Community Award", amount: "$1,000–$5,000", url: "https://spirit.prudential.com", merit: true, blurb: "youth volunteers with outstanding community service records" },
  { name: "Bonner Scholars Program", amount: "varies by partner school", url: "https://bonner.org", needBased: true, blurb: "students who commit to four years of community service in exchange for scholarship support" },
  { name: "Posse Foundation Scholarship", amount: "full tuition", url: "https://www.possefoundation.org", needBased: true, merit: true, firstGen: true, blurb: "urban youth with extraordinary academic and leadership potential, nominated by their high school" },
  { name: "Scholarship America Dream Award", amount: "up to $15,000", url: "https://scholarshipamerica.org/dream-award", needBased: true, firstGen: true, blurb: "community college students transferring to 4-year schools with financial need" },

  // ── National, diversity & identity ───────────────────────────────────────
  { name: "Gates Scholarship", amount: "full cost of attendance", url: "https://www.thegatesscholarship.org", needBased: true, firstGen: true, merit: true, blurb: "minority students of outstanding academic achievement and significant financial need" },
  { name: "Jackie Robinson Foundation Scholarship", amount: "up to $30,000 total", url: "https://www.jackierobinson.org", needBased: true, merit: true, blurb: "minority students with leadership potential and financial need" },
  { name: "Ron Brown Scholar Program", amount: "$10,000/yr", url: "https://www.ronbrown.org", needBased: true, merit: true, blurb: "Black high school seniors with academic excellence, leadership, and community service" },
  { name: "Thurgood Marshall College Fund Scholarship", amount: "up to $11,000", url: "https://tmcf.org/scholarships", needBased: true, merit: true, blurb: "students attending HBCUs and Predominantly Black Institutions" },
  { name: "UNCF (United Negro College Fund) Scholarships", amount: "varies by award", url: "https://uncf.org/scholarships", needBased: true, blurb: "Black and African American students — hundreds of individual awards in one portal" },
  { name: "Hispanic Scholarship Fund (HSF)", amount: "$500–$5,000", url: "https://www.hsf.net", needBased: true, merit: true, blurb: "Hispanic and Latino students with a GPA of 3.0 or higher" },
  { name: "Asian & Pacific Islander American Scholarship Fund (APIASF)", amount: "$2,500–$20,000", url: "https://www.apiasf.org", needBased: true, firstGen: true, blurb: "Asian American and Pacific Islander students with financial need" },
  { name: "American Indian College Fund Scholarship", amount: "varies", url: "https://collegefund.org/students/scholarships", needBased: true, blurb: "Native American and Alaska Native students at tribal colleges and universities" },
  { name: "AISES Scholarship (American Indian Science & Engineering)", amount: "varies", url: "https://www.aises.org/scholarships", majors: ["stem", "engineering"], needBased: true, blurb: "Indigenous students pursuing STEM degrees" },
  { name: "TheDream.US National Scholarship", amount: "$20,000–$50,000", url: "https://www.thedream.us", needBased: true, firstGen: true, blurb: "DREAMers (DACA recipients and TPS holders) attending partner colleges" },
  { name: "Point Foundation Scholarship", amount: "up to $14,000/yr", url: "https://pointfoundation.org", needBased: true, merit: true, blurb: "LGBTQ+ students demonstrating leadership and financial need" },
  { name: "American Association of University Women (AAUW) Career Development Grant", amount: "$2,000–$12,000", url: "https://www.aauw.org/resources/programs/fellowships-grants/current-fellows-grantees/career-development-grants", blurb: "women pursuing education or training to advance or change careers" },
  { name: "Jeannette Rankin Women's Scholarship", amount: "$2,000", url: "https://www.rankinfoundation.org", needBased: true, blurb: "low-income women 35 and older returning to school" },

  // ── STEM / engineering / computing ───────────────────────────────────────
  { name: "Regeneron Science Talent Search", amount: "up to $250,000", url: "https://www.societyforscience.org/regeneron-sts", merit: true, majors: ["stem"], blurb: "original STEM research projects from high school seniors" },
  { name: "Davidson Fellows Scholarship", amount: "up to $50,000", url: "https://www.davidsongifted.org/fellows", merit: true, majors: ["stem", "arts"], blurb: "a significant STEM, literature, or music project" },
  { name: "Society of Women Engineers (SWE) Scholarship", amount: "$1,000–$15,000", url: "https://swe.org/scholarships", majors: ["engineering", "stem"], blurb: "women pursuing engineering or computing" },
  { name: "Buick Achievers Scholarship", amount: "up to $25,000", url: "https://www.buickachievers.com", needBased: true, merit: true, majors: ["stem", "engineering"], blurb: "STEM majors with financial need" },
  { name: "Google Generation Scholarship", amount: "$10,000", url: "https://buildyourfuture.withgoogle.com/scholarships", majors: ["stem", "engineering"], merit: true, blurb: "computer science students from underrepresented groups" },
  { name: "Microsoft Scholarship Program", amount: "up to $12,000", url: "https://careers.microsoft.com/students/us/en/usscholarshipprogram", majors: ["stem", "engineering"], needBased: true, blurb: "underrepresented students in CS, IT, or related STEM fields" },
  { name: "Amazon Future Engineer Scholarship", amount: "$40,000 total", url: "https://www.amazonfutureengineer.com/scholarships", majors: ["stem", "engineering"], needBased: true, blurb: "low-income students studying computer science — includes an Amazon internship offer" },
  { name: "NSBE Scholarship (National Society of Black Engineers)", amount: "$500–$15,000", url: "https://www.nsbe.org/scholarships", majors: ["stem", "engineering"], needBased: true, merit: true, blurb: "Black engineering and STEM students at all academic levels" },
  { name: "SHPE Scholarship (Society of Hispanic Professional Engineers)", amount: "$1,000–$5,000", url: "https://www.shpe.org/scholarships", majors: ["stem", "engineering"], needBased: true, blurb: "Hispanic students in STEM fields" },
  { name: "Astronaut Scholarship Foundation", amount: "$10,000", url: "https://astronautscholarship.org", majors: ["stem"], merit: true, blurb: "science and engineering students who show initiative, creativity, and potential for research" },
  { name: "National GEM Consortium Fellowship", amount: "full tuition + living stipend", url: "https://www.gemfellowship.org", majors: ["stem", "engineering"], needBased: true, firstGen: true, blurb: "underrepresented minority students entering STEM master's or PhD programs" },
  { name: "Palantir Future Scholarship", amount: "$10,000", url: "https://www.palantir.com/students/scholarship", majors: ["stem", "engineering"], blurb: "underrepresented students in CS or engineering with a strong technical portfolio" },
  { name: "Tau Beta Pi Scholarship", amount: "up to $3,000", url: "https://www.tbp.org/scholarships.cfm", majors: ["engineering"], merit: true, blurb: "engineering students in the top 1/8 of their class" },

  // ── Health / nursing / medical ────────────────────────────────────────────
  { name: "Tylenol Future Care Scholarship", amount: "$5,000–$10,000", url: "https://www.tylenol.com/news/scholarship", majors: ["health", "nursing"], blurb: "students pursuing healthcare careers" },
  { name: "NSNA Foundation Scholarship", amount: "$1,000–$7,500", url: "https://www.nsna.org", majors: ["nursing", "health"], blurb: "nursing students at every academic stage" },
  { name: "HRSA Nursing Scholarship Program", amount: "full tuition + monthly stipend", url: "https://bhw.hrsa.gov/scholarships-loans-repayment", majors: ["nursing", "health"], needBased: true, blurb: "nursing students who commit to serving in health-professional shortage areas after graduation" },
  { name: "CVS Health Foundation Scholarship", amount: "$5,000", url: "https://cvshealth.com/community/cvshealth-foundation", majors: ["health", "nursing"], needBased: true, blurb: "students pursuing careers in pharmacy, health, or healthcare management" },
  { name: "Physician Assistant Foundation Scholarship", amount: "$2,000–$5,000", url: "https://pafoundation.com", majors: ["health"], merit: true, blurb: "physician assistant students showing clinical promise and commitment to the profession" },
  { name: "American Medical Women's Association Scholarship", amount: "up to $10,000", url: "https://www.amwa-doc.org", majors: ["health"], blurb: "women pursuing medical degrees or pre-med programs" },

  // ── Business / entrepreneurship ───────────────────────────────────────────
  { name: "DECA & FBLA Scholarships", amount: "$1,000–$10,000", url: "https://www.deca.org/scholarships", majors: ["business"], blurb: "future business leaders active in DECA or FBLA chapters" },
  { name: "National FFA Organization Scholarships", amount: "$1,000–$22,000", url: "https://www.ffa.org/participate/grants-and-scholarships", majors: ["business"], blurb: "FFA members pursuing agricultural, business, or related degrees" },
  { name: "Goldman Sachs Global Leaders Program", amount: "varies", url: "https://www.goldmansachs.com/careers/students/programs", majors: ["business"], merit: true, blurb: "sophomore business and economics students with demonstrated leadership" },
  { name: "National Restaurant Association Educational Foundation Scholarship", amount: "up to $10,000", url: "https://www.nraef.org/scholarships", majors: ["business"], blurb: "students pursuing hospitality, culinary arts, or restaurant management" },

  // ── Arts / design / creative ──────────────────────────────────────────────
  { name: "YoungArts National Arts Competition", amount: "up to $10,000", url: "https://youngarts.org", majors: ["arts"], blurb: "visual, literary, design, and performing artists in high school" },
  { name: "Scholastic Art & Writing Awards", amount: "up to $12,500", url: "https://www.artandwriting.org", majors: ["arts"], blurb: "creative teens in visual art, design, and writing" },
  { name: "Princess Grace Foundation USA Award", amount: "up to $35,000", url: "https://www.pgfusa.org", majors: ["arts"], merit: true, blurb: "emerging professional artists in theater, dance, and film" },

  // ── State: California ─────────────────────────────────────────────────────
  { name: "Cal Grant A & B (California)", amount: "up to $9,358/yr at UC", url: "https://www.csac.ca.gov/cal-grants", states: ["CA"], needBased: true, merit: true, blurb: "California residents; Cal Grant B also covers living expenses for lower-income students" },
  { name: "California Chafee Grant", amount: "up to $5,000/yr", url: "https://www.csac.ca.gov/chafee-grant", states: ["CA"], needBased: true, blurb: "current or former California foster youth" },

  // ── State: New York ───────────────────────────────────────────────────────
  { name: "New York Excelsior Scholarship", amount: "up to full SUNY/CUNY tuition", url: "https://www.hesc.ny.gov/excelsior", states: ["NY"], needBased: true, blurb: "New York students with family income under $125K attending SUNY or CUNY full-time" },
  { name: "New York Tuition Assistance Program (TAP)", amount: "up to $5,665/yr", url: "https://www.hesc.ny.gov/tap", states: ["NY"], needBased: true, blurb: "New York residents with demonstrated financial need at degree-granting NY colleges" },

  // ── State: Texas ──────────────────────────────────────────────────────────
  { name: "TEXAS Grant", amount: "up to full tuition + fees", url: "https://www.collegeforalltexans.com/apps/financialaid/tofa2.cfm?ID=429", states: ["TX"], needBased: true, firstGen: true, blurb: "Texas students with financial need at in-state public colleges" },
  { name: "Terry Foundation Scholarship", amount: "full ride (tuition, fees, housing)", url: "https://www.terryfoundation.org", states: ["TX"], needBased: true, merit: true, blurb: "Texas seniors who attend a Terry partner university with strong academics and character" },
  { name: "Texas Public Education Grant (TPEG)", amount: "varies by institution", url: "https://www.collegeforalltexans.com", states: ["TX"], needBased: true, blurb: "Texas students with financial need at public Texas colleges and universities" },

  // ── State: Florida ────────────────────────────────────────────────────────
  { name: "Florida Bright Futures Scholarship", amount: "up to 100% tuition + fees", url: "https://www.floridastudentfinancialaid.org/ssfad/bf", states: ["FL"], merit: true, blurb: "Florida students meeting GPA, test score, and community service requirements" },
  { name: "Florida Student Assistance Grant (FSAG)", amount: "up to $2,378/yr", url: "https://www.floridastudentfinancialaid.org", states: ["FL"], needBased: true, blurb: "Florida residents with significant financial need at eligible Florida colleges" },

  // ── State: Georgia ────────────────────────────────────────────────────────
  { name: "Georgia HOPE Scholarship", amount: "up to full tuition (public) or $3,500 (private)", url: "https://www.gafutures.org/hope-state-aid-programs/hope-scholarships-grants", states: ["GA"], merit: true, blurb: "Georgia high school graduates with a 3.0 GPA attending an eligible Georgia institution" },
  { name: "Georgia HOPE Grant", amount: "up to full tuition (technical college)", url: "https://www.gafutures.org", states: ["GA"], blurb: "Georgia residents attending technical colleges — no minimum GPA required" },

  // ── State: Illinois ───────────────────────────────────────────────────────
  { name: "Illinois Monetary Award Program (MAP)", amount: "up to $6,362/yr", url: "https://www.isac.org/students/before-college/financial-aid-planning/monetary-award-program", states: ["IL"], needBased: true, blurb: "Illinois residents with significant financial need at approved Illinois schools" },

  // ── State: Tennessee ──────────────────────────────────────────────────────
  { name: "Tennessee Promise Scholarship", amount: "last-dollar tuition at community/technical college", url: "https://tnpromise.gov", states: ["TN"], blurb: "Tennessee high school seniors attending a 2-year college — includes mentoring" },
  { name: "Tennessee HOPE Scholarship", amount: "up to $6,000/yr", url: "https://www.tn.gov/collegepays/money-for-college/grants-scholarships/tennessee-hope-scholarship.html", states: ["TN"], merit: true, blurb: "Tennessee students with a 3.0 GPA attending eligible Tennessee colleges" },

  // ── State: Washington ─────────────────────────────────────────────────────
  { name: "Washington College Grant", amount: "up to full tuition at public college", url: "https://wsac.wa.gov/wcg", states: ["WA"], needBased: true, blurb: "Washington residents with family income under 70% of state median" },
  { name: "Washington State Opportunity Scholarship", amount: "up to $5,000/yr", url: "https://waopportunityscholarship.org", states: ["WA"], needBased: true, majors: ["stem", "health"], blurb: "Washington students in STEM or healthcare careers with financial need" },

  // ── State: Colorado ───────────────────────────────────────────────────────
  { name: "Colorado Student Grant", amount: "up to $12,000/yr", url: "https://cdhe.colorado.gov/students/paying-for-college/financial-aid", states: ["CO"], needBased: true, blurb: "Colorado residents with financial need at eligible Colorado institutions" },

  // ── State: North Carolina ─────────────────────────────────────────────────
  { name: "NC Community College Grant", amount: "up to $1,800/yr", url: "https://www.ncseaa.edu", states: ["NC"], needBased: true, blurb: "North Carolina community college students with financial need" },
  { name: "NC Need-Based Scholarship", amount: "up to $13,300/yr", url: "https://www.ncseaa.edu/grants/nc-need-based-scholarship", states: ["NC"], needBased: true, blurb: "North Carolina residents with financial need at private NC colleges" },

  // ── State: Pennsylvania ───────────────────────────────────────────────────
  { name: "Pennsylvania State Grant (PHEAA)", amount: "up to $5,750/yr", url: "https://www.pheaa.org/grants", states: ["PA"], needBased: true, blurb: "Pennsylvania residents with demonstrated financial need at approved schools" },

  // ── State: Ohio ───────────────────────────────────────────────────────────
  { name: "Ohio College Opportunity Grant (OCOG)", amount: "up to $2,496/yr", url: "https://www.ohiohighered.org/ocog", states: ["OH"], needBased: true, blurb: "Ohio students with significant financial need at Ohio public or private colleges" },

  // ── State: Louisiana ──────────────────────────────────────────────────────
  { name: "Louisiana TOPS Program", amount: "up to full tuition at public LA school", url: "https://mylosfa.la.gov/students-parents/tops", states: ["LA"], merit: true, blurb: "Louisiana students who graduate with a 2.5 GPA, 18 ACT, and core curriculum" },

  // ── State: South Carolina ─────────────────────────────────────────────────
  { name: "South Carolina Palmetto Fellows Scholarship", amount: "up to $10,000/yr", url: "https://www.che.sc.gov/Students/PayingForCollege/GrantsScholarships/PalmettoFellows.aspx", states: ["SC"], merit: true, blurb: "South Carolina's most academically talented graduating seniors" },
  { name: "SC LIFE Scholarship", amount: "up to full tuition at public SC school", url: "https://www.che.sc.gov", states: ["SC"], merit: true, blurb: "South Carolina students with a 3.0 GPA and 1100 SAT/24 ACT" },

  // ── State: Virginia ───────────────────────────────────────────────────────
  { name: "Virginia Guaranteed Assistance Program (VGAP)", amount: "up to full tuition", url: "https://www.schev.edu/financial-aid/grants", states: ["VA"], needBased: true, blurb: "Virginia students with high financial need who maintain a C average" },

  // ── State: Maryland ───────────────────────────────────────────────────────
  { name: "Maryland Howard P. Rawlings Educational Excellence Award", amount: "up to $3,000/yr", url: "https://mhec.maryland.gov/preparing/Pages/FinancialAid/ProgramDescriptions/prog_gea.aspx", states: ["MD"], needBased: true, blurb: "Maryland residents with financial need attending a Maryland college" },

  // ── State: Michigan ───────────────────────────────────────────────────────
  { name: "Michigan Competitive Scholarship", amount: "up to $1,000/yr", url: "https://www.michigan.gov/studentaid/aid-types/scholarships/mcs", states: ["MI"], merit: true, needBased: true, blurb: "Michigan students with strong ACT scores and demonstrated financial need" },

  // ── State: Minnesota ──────────────────────────────────────────────────────
  { name: "Minnesota State Grant", amount: "up to $16,278/yr", url: "https://www.ohe.state.mn.us/mPg.cfm?pageID=1007", states: ["MN"], needBased: true, blurb: "Minnesota residents with financial need at an eligible Minnesota institution" },

  // ── State: Indiana ────────────────────────────────────────────────────────
  { name: "Indiana 21st Century Scholars Program", amount: "up to full tuition at public Indiana school", url: "https://www.in.gov/che/4498.htm", states: ["IN"], needBased: true, firstGen: true, blurb: "Indiana middle-schoolers who pledge early can receive full 4-year tuition plus support services" },
  { name: "Indiana Frank O'Bannon Grant", amount: "up to $1,080/yr", url: "https://www.in.gov/che", states: ["IN"], needBased: true, blurb: "Indiana residents with financial need at eligible Indiana colleges" },

  // ── State: Nevada ─────────────────────────────────────────────────────────
  { name: "Nevada Millennium Scholarship", amount: "up to $10,000 total", url: "https://www.nevadatreasury.gov/millenniumscholarship", states: ["NV"], merit: true, blurb: "Nevada high school graduates with a 3.25 GPA attending an eligible Nevada college" },

  // ── State: Oregon ─────────────────────────────────────────────────────────
  { name: "Oregon Opportunity Grant", amount: "up to $2,800/yr", url: "https://oregonstudentaid.gov/opportunity-grant.aspx", states: ["OR"], needBased: true, blurb: "Oregon residents with financial need at Oregon colleges — one of the state's largest grant programs" },

  // ── State: Missouri ───────────────────────────────────────────────────────
  { name: "Missouri A+ Scholarship", amount: "up to full community college tuition", url: "https://dhewd.mo.gov/policies/aplus.php", states: ["MO"], merit: true, blurb: "Missouri students who maintained a 2.5 GPA and 95% attendance in high school" },

  // ── State: Arizona ────────────────────────────────────────────────────────
  { name: "Arizona Promise Program", amount: "last-dollar at AZ community college", url: "https://highered.az.gov/financial-literacy-aid/financial-aid/arizona-promise", states: ["AZ"], needBased: true, blurb: "Arizona high school graduates with financial need attending a community college" },

  // ── State: New Jersey ─────────────────────────────────────────────────────
  { name: "New Jersey Student Tuition Assistance Reward Scholarship (NJ STARS)", amount: "community college tuition", url: "https://www.hesaa.org/Pages/NJSTARSInfo.aspx", states: ["NJ"], merit: true, blurb: "New Jersey students graduating in the top 15% of their class who attend a county college" },
  { name: "New Jersey Tuition Aid Grant (TAG)", amount: "up to $12,598/yr", url: "https://www.hesaa.org/Pages/TAGInfo.aspx", states: ["NJ"], needBased: true, blurb: "New Jersey residents with financial need at approved NJ colleges" },

  // ── State: Massachusetts ──────────────────────────────────────────────────
  { name: "Massachusetts MASSGrant Plus", amount: "up to $2,500/yr", url: "https://www.mass.edu/massscholarships/programs/massgrant.asp", states: ["MA"], needBased: true, blurb: "Massachusetts residents with financial need at eligible Massachusetts institutions" },

  // ── State: Wisconsin ──────────────────────────────────────────────────────
  { name: "Wisconsin Higher Education Grant (WHEG)", amount: "up to $3,850/yr", url: "https://wsas.wi.gov/wisconsin-grant", states: ["WI"], needBased: true, blurb: "Wisconsin residents with financial need at a UW System or technical college" },

  // ── State: Utah ───────────────────────────────────────────────────────────
  { name: "Utah New Century Scholarship", amount: "up to 75% of tuition", url: "https://ushe.edu/utah-new-century-scholarship", states: ["UT"], merit: true, blurb: "Utah students who complete an associate degree before high school graduation or a rigorous STEM/math track" },
  { name: "Utah Regents' Scholarship", amount: "$1,000–$2,500", url: "https://ushe.edu/utah-regents-scholarship", states: ["UT"], merit: true, blurb: "Utah students who complete a rigorous core course of study in high school" },
  { name: "Utah Access to Education Scholarship (Utah ACCESS)", amount: "up to $5,000", url: "https://ushe.edu/access-scholarship", states: ["UT"], needBased: true, firstGen: true, blurb: "Utah first-gen students with financial need at USHE institutions" },
];
