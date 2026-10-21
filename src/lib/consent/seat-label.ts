// The parent word in a seat label must not identify the child (DECISIONS.md,
// seat label). The database enforces the shape; this only warns about meaning.

const GIVEN_NAMES = new Set(
  `james john robert michael william david richard joseph thomas charles
   christopher daniel matthew anthony mark donald steven paul andrew joshua
   kenneth kevin brian george timothy ronald jason edward jeffrey ryan jacob
   gary nicholas eric jonathan stephen larry justin scott brandon benjamin
   samuel gregory alexander patrick frank raymond jack dennis jerry tyler
   aaron jose adam nathan henry zachary douglas peter kyle noah ethan jeremy
   christian walter keith austin roger terry sean gerald carl dylan harold
   jordan jesse bryan lawrence arthur gabriel bruce logan billy joe alan juan
   elijah willie albert wayne randy mason vincent liam roy bobby caleb bradley
   russell lucas oliver levi owen luke isaac hudson jayden grayson leo ezra
   mary patricia jennifer linda elizabeth barbara susan jessica sarah karen
   lisa nancy betty sandra margaret ashley kimberly emily donna michelle carol
   amanda melissa deborah stephanie dorothy rebecca sharon laura cynthia amy
   kathleen angela shirley brenda emma anna pamela nicole samantha katherine
   christine helen debra rachel carolyn janet maria catherine heather diane
   olivia julie joyce victoria ruth virginia lauren kelly christina joan
   evelyn judith andrea hannah megan cheryl jacqueline martha madison teresa
   gloria sara janice ann kathryn abigail sophia frances jean alice judy
   isabella julia grace amber denise danielle marilyn beverly charlotte
   natalie theresa diana brittany doris kayla alexis lori marie ava mia
   amelia harper luna ella chloe penelope layla riley zoey nora lily eleanor
   hazel violet aurora savannah audrey brooklyn bella claire skylar lucy
   paisley everly caroline nova genesis emilia kennedy maya willow kinsley
   naomi aaliyah elena ariana gianna valentina ruby cecilia clara iris`
    .split(/\s+/),
);

const MONTHS =
  /^(jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|may|june|july|august|september|october|november|december)$/;

const SCHOOLISH = /(school|academy|elementary|middle|charter|montessori|prep|college|campus)/;

export function seatWordWarning(word: string): string | null {
  const w = word.trim().toLowerCase();
  if (GIVEN_NAMES.has(w)) return "This looks like a first name. Pick a word that does not identify your child.";
  if (w.length <= 3) return "Short words can read as initials. Pick a longer word.";
  if (MONTHS.test(w) || /birth|bday/.test(w)) return "This looks like part of a date. Pick a word unrelated to a birthday.";
  if (SCHOOLISH.test(w)) return "This looks like a school. Pick a word unrelated to where your child learns.";
  return null;
}
