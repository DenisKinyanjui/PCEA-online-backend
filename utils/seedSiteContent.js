require('dotenv').config();
const connectDB = require('../config/db');
const Church = require('../models/Church');
const SiteContent = require('../models/SiteContent');

const CHURCH_SLUG = 'pcea-emmanuel-thome-church';
const HERO_IMAGES = [
  '/images/hero/image2.webp',
  '/images/hero/image3.webp',
  '/images/hero/image1.webp',
  '/images/hero/image4.webp',
  '/images/hero/image5.webp',
];

async function seedSiteContent() {
  await connectDB();
  const church = await Church.findOne({ slug: CHURCH_SLUG });
  const existing = await SiteContent.findOne({ churchSlug: CHURCH_SLUG });
  if (existing) {
    console.log('Site content already exists; leaving it unchanged.');
    process.exit(0);
  }

  await SiteContent.create({
    churchSlug: CHURCH_SLUG,
    heroImages: HERO_IMAGES.map((src) => ({ src, originalName: src.split('/').pop() })),
    about: {
      intro: church?.description ||
        `Welcome to the online ministry of ${church?.name || 'PCEA Emmanuel Thome Church'}. We believe that powerful biblical teaching should be accessible to everyone, anytime, anywhere.`,
      sections: [
        {
          title: 'Our Mission',
          body: 'To provide easy access to quality biblical teaching that strengthens faith and transforms lives.',
        },
        {
          title: 'Our Vision',
          body: 'A world where everyone has access to life-changing biblical messages whenever they need encouragement.',
        },
        {
          title: 'What We Offer',
          body: 'A curated collection of sermons covering various topics, searchable and organized for your convenience.',
        },
        {
          title: 'Our Community',
          body: 'A congregation growing together in faith, with teachings from our pastors, elders and guest ministers.',
        },
        {
          title: 'How It Works',
          body: `Messages from ${church?.name || 'PCEA Emmanuel Thome Church'} are recorded, transcribed and organized here so you can revisit them any time. You can:`,
          items: [
            'Browse sermons by preacher or date',
            'Search for specific topics or keywords',
            'Listen to audio recordings',
            'Read detailed sermon outlines and notes',
          ],
        },
        {
          title: 'Our Commitment',
          body: 'We are committed to:',
          items: [
            'Maintaining high-quality, biblically sound content',
            'Providing a user-friendly, accessible platform',
            'Continuously improving and expanding our sermon library',
            'Serving our congregation and everyone who joins us online',
          ],
        },
        {
          title: 'Join Us',
          body: "Whether you're seeking encouragement, looking for answers to life's questions, or wanting to grow deeper in your faith, our online ministry is here to help. Start exploring our sermon library today and discover the message God has for you.",
          closing: "Together, let's grow in faith and understanding of God's Word.",
        },
      ],
    },
  });
  console.log('Seeded the current hero images and About page content.');
  process.exit(0);
}

seedSiteContent().catch((error) => {
  console.error('Failed to seed site content:', error);
  process.exit(1);
});
