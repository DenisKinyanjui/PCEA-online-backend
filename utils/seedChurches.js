require('dotenv').config();
const connectDB = require('../config/db');
const Church = require('../models/Church');
const Sermon = require('../models/Sermon');

// Convert church name to URL-friendly slug
function toSlug(name) {
  return name
    .toLowerCase()
    .replace(/p\.c\.e\.a\.?/gi, 'pcea')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

const seedChurches = async () => {
  await connectDB();

  // Collect distinct church names from existing sermons
  const names = await Sermon.distinct('church');
  const filtered = names.filter(Boolean);

  console.log(`Found ${filtered.length} church name(s) in sermon data.`);

  let created = 0;
  let skipped = 0;

  for (const name of filtered) {
    const slug = toSlug(name);
    const exists = await Church.findOne({ $or: [{ name }, { slug }] });
    if (exists) {
      console.log(`  SKIP  "${name}" (already exists)`);
      skipped++;
      continue;
    }
    await Church.create({ name, slug });
    console.log(`  OK    "${name}" → slug: "${slug}"`);
    created++;
  }

  console.log(`\nDone. Created: ${created}, Skipped: ${skipped}`);
  process.exit(0);
};

seedChurches().catch((err) => {
  console.error(err);
  process.exit(1);
});
