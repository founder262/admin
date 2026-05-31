const normalizePlaceString = (value) =>
  (value || "")
    .toLowerCase()
    .replace(/[-_.]/g, " ")
    .replace(/[^ - \w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const getBestLocationMatch = (address, locations) => {
  const normalizedAddress = normalizePlaceString(address);
  console.log("Normalized Address:", normalizedAddress)
  
  const candidates = (locations || [])
    .map((loc) => ({
      ...loc,
      normalizedName: normalizePlaceString(loc.name),
    }))
    .filter((loc) => loc.normalizedName.length > 0);

  console.log("Candidates:", candidates.map(c => c.normalizedName))

  const exactMatches = candidates.filter((loc) => {
    const name = loc.normalizedName;
    return (
      normalizedAddress === name ||
      normalizedAddress.startsWith(`${name} `) ||
      normalizedAddress.endsWith(` ${name}`) ||
      normalizedAddress.includes(` ${name} `)
    );
  });

  console.log("Exact Matches:", exactMatches.map(c => c.normalizedName))

  const matches = exactMatches.length
    ? exactMatches
    : candidates.filter((loc) => normalizedAddress.includes(loc.normalizedName));

  console.log("All Matches:", matches.map(c => c.normalizedName))

  if (!matches.length) return null;

  return matches.sort((a, b) => {
    const aTokens = a.normalizedName.split(" ").length;
    const bTokens = b.normalizedName.split(" ").length;
    if (bTokens !== aTokens) return bTokens - aTokens;
    return b.normalizedName.length - a.normalizedName.length;
  })[0];
};

const locations = [
  { id: 1, name: "Avadi" },
  { id: 2, name: "chennai" },
  { id: 3, name: "T-Nagar" }
];

const address1 = "NO. 6/PC 36, TNHB MAIN ROAD, BEHIND PONNU SUPER BAZAAR, AVADI|||,";
console.log("Result 1:", getBestLocationMatch(address1, locations));

const address2 = "85/94 Park View, Door 18, G.N. Chetty Road, T.Nagar, Chennai, Tamil Nadu 600017|||,";
console.log("Result 2:", getBestLocationMatch(address2, locations));
