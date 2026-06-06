require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Sermon = require('../models/Sermon');
const Series = require('../models/Series');

const mockSermons = [
  {
    title: 'Walking in Faith: Trusting God in Uncertain Times',
    preacher: 'Rev. James Kariuki',
    church: 'P.C.E.A Emmanuel Thome Church',
    date: new Date('2026-01-14'),
    series: 'Journey of Faith',
    scriptureReferences: ['Hebrews 11:1', 'Proverbs 3:5-6', '2 Corinthians 5:7', 'Psalm 77:11-12', 'Hebrews 10:24-25'],
    summary: "An encouraging message about maintaining faith during life's storms and trusting in God's perfect plan.",
    audioUrl: 'https://res.cloudinary.com/dppwytw0u/video/upload/v1771625140/2021-02-07_-_Week_5___Objections_to_Eternal_Security_The_Gospels___Secure_-_John_T._Clark_220262118345501_ejvv5c.mp3',
    video: { type: 'youtube', url: 'https://youtu.be/puGdqn6TWAQ' },
    content: {
      introduction: "Good morning, church family. Today, we're going to explore what it means to walk by faith and not by sight, especially during those seasons when the path ahead seems unclear and the storms of life threaten to overwhelm us.",
      points: [
        { title: 'Faith is a Choice, Not a Feeling', description: "Many people believe that faith is something you either have or you don't, but Scripture teaches us that faith is a deliberate choice we make each day.", verses: ['Hebrews 11:1', 'Proverbs 3:5-6', '2 Corinthians 5:7'] },
        { title: "God's Faithfulness in Our Past", description: "Looking back at how God has been faithful in our past gives us confidence for the future.", verses: ['Psalm 77:11-12', 'Lamentations 3:22-23', '1 Chronicles 16:12'] },
        { title: 'The Power of Community in Faith', description: "We were never meant to walk this journey alone. When our faith wavers, the body of Christ is there to support us.", verses: ['Hebrews 10:24-25', 'Ecclesiastes 4:9-10', 'Galatians 6:2'] },
      ],
      conclusion: "As we leave today, I want to challenge each of you to take one step of faith this week.",
    },
  },
  {
    title: 'The Power of Prayer: Connecting with God',
    preacher: 'Rev. Sarah Muthoni',
    church: 'P.C.E.A Siloam Kimbo Church',
    date: new Date('2026-01-21'),
    series: 'Spiritual Disciplines',
    scriptureReferences: ['Philippians 4:6-7', 'Matthew 6:6-8', 'Hebrews 4:16'],
    summary: 'Discovering the transformative power of prayer and developing a deeper relationship with God through consistent communication.',
    audioUrl: 'https://res.cloudinary.com/dppwytw0u/video/upload/v1771625140/2021-02-07_-_Week_5___Objections_to_Eternal_Security_The_Gospels___Secure_-_John_T._Clark_220262118345501_ejvv5c.mp3',
    video: { type: 'file', url: 'https://youtu.be/sA5E1K0rq7U' },
    content: {
      introduction: 'Prayer is not just a religious ritual or a list of requests we bring before God. It is the lifeline of our relationship with our Heavenly Father.',
      points: [
        { title: 'Prayer as Relationship, Not Religion', description: 'God desires authentic conversation with us, not rehearsed speeches or perfect words.', verses: ['Philippians 4:6-7', 'Matthew 6:6-8', 'Hebrews 4:16'] },
        { title: 'The Elements of Effective Prayer', description: 'Jesus taught us a model for prayer that includes worship, surrender, petition, confession, and protection.', verses: ['Matthew 6:9-13', '1 John 1:9', 'James 5:16'] },
        { title: 'Persistence in Prayer', description: 'Jesus taught about persistent prayer not because God is reluctant to answer, but because persistence transforms us.', verses: ['Luke 18:1-8', '1 Thessalonians 5:17', 'Colossians 4:2'] },
      ],
      conclusion: 'This week, I encourage you to set aside specific time each day for prayer.',
    },
  },
  {
    title: 'Love Your Neighbor: Practical Christianity',
    preacher: 'Rev. Michael Kamau',
    church: 'P.C.E.A Canaan Church',
    date: new Date('2026-01-28'),
    series: 'Living Like Jesus',
    scriptureReferences: ['1 Samuel 16:7', 'James 2:1-9', 'John 15:13'],
    summary: 'Exploring what it means to genuinely love others as Christ loved us, moving beyond words to action.',
    audioUrl: 'https://res.cloudinary.com/dppwytw0u/video/upload/v1771625140/2021-02-07_-_Week_5___Objections_to_Eternal_Security_The_Gospels___Secure_-_John_T._Clark_220262118345501_ejvv5c.mp3',
    video: { type: 'youtube', url: 'https://youtu.be/puGdqn6TWAQ' },
    content: {
      introduction: "Jesus said that people would know we are His disciples by our love for one another. Not by our theology, not by our church attendance — but by our love.",
      points: [
        { title: 'Love Sees Beyond Surface', description: 'Jesus consistently saw people that society overlooked. True love requires us to see people beyond their social status.', verses: ['1 Samuel 16:7', 'James 2:1-9', 'Luke 10:30-37'] },
        { title: 'Love Requires Sacrifice', description: "Love isn't just a warm feeling; it's a costly commitment. It means giving our time to someone who can't repay us.", verses: ['John 15:13', '1 John 3:16-18', 'Ephesians 5:2'] },
        { title: 'Love Creates Community', description: 'When we genuinely love one another, we create a community that reflects God\'s kingdom on earth.', verses: ['John 13:34-35', 'Romans 12:10', '1 Peter 4:8'] },
      ],
      conclusion: "I want to leave you with a challenge: identify one person this week who needs to experience Christ's love through you.",
    },
  },
  {
    title: "Overcoming Fear with God's Promises",
    preacher: 'Rev. David Mwangi',
    church: 'P.C.E.A Ruiru Town Church',
    date: new Date('2026-02-04'),
    series: 'Anchored in Truth',
    scriptureReferences: ['Isaiah 41:10', 'Deuteronomy 31:6', 'Jeremiah 29:11'],
    summary: "Finding courage and peace by standing on the unchanging promises of God in a world filled with uncertainty.",
    audioUrl: 'https://res.cloudinary.com/dppwytw0u/video/upload/v1771625140/2021-02-07_-_Week_5___Objections_to_Eternal_Security_The_Gospels___Secure_-_John_T._Clark_220262118345501_ejvv5c.mp3',
    content: {
      introduction: "We live in an age of anxiety. But God's Word is filled with promises that can anchor our souls and drive out fear.",
      points: [
        { title: "God's Presence is Promised", description: "The most repeated command in Scripture is 'Do not fear,' and it's almost always followed by the assurance of God's presence.", verses: ['Isaiah 41:10', 'Deuteronomy 31:6', 'Matthew 28:20'] },
        { title: "God's Plans are for Our Good", description: "Even when circumstances look bleak, God is working all things together for our good.", verses: ['Jeremiah 29:11', 'Romans 8:28', 'Psalm 138:8'] },
        { title: "God's Peace Surpasses Understanding", description: "God offers a supernatural peace that doesn't depend on our circumstances.", verses: ['Philippians 4:6-7', 'John 14:27', 'Isaiah 26:3'] },
      ],
      conclusion: "What fear are you carrying today? I invite you to bring it before God right now.",
    },
  },
  {
    title: 'The Joy of Generosity',
    preacher: 'Rev. Emily Wanjiku',
    church: 'P.C.E.A Murera Church',
    date: new Date('2026-02-11'),
    series: 'Kingdom Living',
    scriptureReferences: ['John 3:16', '2 Corinthians 9:6-11', 'Proverbs 11:24-25'],
    summary: "Understanding how generosity reflects God's heart and discovering the unexpected joy that comes from giving.",
    audioUrl: 'https://res.cloudinary.com/dppwytw0u/video/upload/v1771625140/2021-02-07_-_Week_5___Objections_to_Eternal_Security_The_Gospels___Secure_-_John_T._Clark_220262118345501_ejvv5c.mp3',
    content: {
      introduction: "Our culture teaches us that accumulation brings happiness, but Jesus taught the opposite.",
      points: [
        { title: "Generosity Reflects God's Nature", description: "God is the ultimate giver. When we give generously, we reflect His character to the world.", verses: ['John 3:16', '2 Corinthians 9:15', 'James 1:17'] },
        { title: 'Generosity Breaks the Power of Greed', description: "Generosity is the antidote to greed. When we open our hands to give, we loosen money's grip on our hearts.", verses: ['1 Timothy 6:10', 'Luke 12:15', 'Matthew 6:19-21'] },
        { title: 'Generosity Multiplies Blessings', description: "God promises that we cannot out-give Him.", verses: ['2 Corinthians 9:6-11', 'Proverbs 11:24-25', 'Luke 6:38'] },
      ],
      conclusion: 'This week, I challenge you to practice radical generosity.',
    },
  },
  {
    title: 'Finding Purpose in Your Season',
    preacher: 'Rev. James Kariuki',
    church: 'P.C.E.A Emmanuel Thome Church',
    date: new Date('2026-02-18'),
    series: 'Journey of Faith',
    scriptureReferences: ['Ecclesiastes 3:1-8', 'Psalm 27:14', 'Philippians 4:11-13'],
    summary: "Discovering God's purpose for your current season of life and learning to bloom where you're planted.",
    audioUrl: 'https://res.cloudinary.com/dppwytw0u/video/upload/v1771625140/2021-02-07_-_Week_5___Objections_to_Eternal_Security_The_Gospels___Secure_-_John_T._Clark_220262118345501_ejvv5c.mp3',
    content: {
      introduction: "Many of us struggle with the season we're in, always looking ahead to the next chapter. But what if God has something significant for us right here, right now?",
      points: [
        { title: 'Every Season Has Purpose', description: "Just as nature has seasons, each serving a vital role, our lives have seasons too.", verses: ['Ecclesiastes 3:1-8', 'Psalm 1:3', 'John 15:2'] },
        { title: 'Faithfulness in the Waiting', description: "Often the hardest seasons are the waiting seasons. Yet these are the times when our character is formed.", verses: ['Psalm 27:14', 'Isaiah 40:31', 'Genesis 50:20'] },
        { title: 'Contentment is Learned', description: "Paul said he learned to be content in every situation.", verses: ['Philippians 4:11-13', '1 Timothy 6:6-8', 'Hebrews 13:5'] },
      ],
      conclusion: "Stop waiting for the next season to start living purposefully.",
    },
  },
  {
    title: 'The Transforming Power of Worship',
    preacher: 'Rev. Sarah Muthoni',
    church: 'P.C.E.A Siloam Kimbo Church',
    date: new Date('2026-02-25'),
    series: 'Spiritual Disciplines',
    scriptureReferences: ['Psalm 34:1-3', 'Revelation 4:11', '2 Corinthians 3:18'],
    summary: "Exploring how true worship transforms our hearts and realigns our perspective with God's eternal truth.",
    audioUrl: 'https://res.cloudinary.com/dppwytw0u/video/upload/v1771625140/2021-02-07_-_Week_5___Objections_to_Eternal_Security_The_Gospels___Secure_-_John_T._Clark_220262118345501_ejvv5c.mp3',
    video: { type: 'file', url: 'https://commondatastorage.googleapis.com/gtv-videos-library/sample/ElephantsDream.mp4' },
    content: {
      introduction: "Worship is more than singing songs on Sunday morning. It's a lifestyle of acknowledging God's worth.",
      points: [
        { title: 'Worship Redirects Our Focus', description: "When we worship, we shift our gaze from our problems to our Provider.", verses: ['Psalm 34:1-3', 'Hebrews 12:2', 'Psalm 16:8'] },
        { title: "Worship is Our Response to God's Nature", description: "We worship not to get something from God but because of who He is.", verses: ['Revelation 4:11', 'Psalm 29:2', '1 Chronicles 16:25'] },
        { title: 'Worship Transforms Us', description: "As we behold God's glory in worship, we are transformed into His likeness.", verses: ['2 Corinthians 3:18', 'Romans 12:1-2', 'Psalm 135:15-18'] },
      ],
      conclusion: 'Make worship a daily practice this week.',
    },
  },
  {
    title: 'Grace for the Broken',
    preacher: 'Rev. Michael Kamau',
    church: 'P.C.E.A Canaan Church',
    date: new Date('2026-01-03'),
    series: 'Living Like Jesus',
    scriptureReferences: ['Romans 5:8', 'Ephesians 2:8-9', 'Titus 2:11-12'],
    summary: "Understanding the depth of God's grace and how it meets us in our brokenness to bring healing and restoration.",
    audioUrl: 'https://res.cloudinary.com/dppwytw0u/video/upload/v1771625140/2021-02-07_-_Week_5___Objections_to_Eternal_Security_The_Gospels___Secure_-_John_T._Clark_220262118345501_ejvv5c.mp3',
    content: {
      introduction: "We live in a world that values perfection, but God specializes in using broken people.",
      points: [
        { title: "God's Grace Meets Us Where We Are", description: "You don't have to clean yourself up before coming to God.", verses: ['Romans 5:8', 'Ephesians 2:8-9', 'Titus 3:4-5'] },
        { title: "Grace Doesn't Excuse Sin, It Empowers Change", description: "When we experience authentic grace, it empowers us to sin less.", verses: ['Titus 2:11-12', 'Romans 6:1-2', '1 Corinthians 15:10'] },
        { title: "We Extend the Grace We've Received", description: "Having received immeasurable grace from God, we're called to extend that same grace to others.", verses: ['Matthew 18:21-35', 'Colossians 3:13', 'Ephesians 4:32'] },
      ],
      conclusion: "If you're feeling broken today, know that you're exactly where God does His best work.",
    },
  },
  {
    title: 'Building Your Life on the Rock',
    preacher: 'Rev. David Mwangi',
    church: 'P.C.E.A Ruiru Town Church',
    date: new Date('2025-12-10'),
    series: 'Anchored in Truth',
    scriptureReferences: ['Matthew 7:24-27', '1 Corinthians 3:11', 'Joshua 1:8'],
    summary: 'Learning to build our lives on the solid foundation of Christ and His Word for lasting stability.',
    audioUrl: 'https://res.cloudinary.com/dppwytw0u/video/upload/v1771625140/2021-02-07_-_Week_5___Objections_to_Eternal_Security_The_Gospels___Secure_-_John_T._Clark_220262118345501_ejvv5c.mp3',
    content: {
      introduction: "Jesus told a story about two builders — one wise, one foolish. The difference? The foundation.",
      points: [
        { title: 'Christ is the Only Sure Foundation', description: "In life, we can build on many things — but only Christ provides a foundation that cannot be shaken.", verses: ['Matthew 7:24-27', '1 Corinthians 3:11', 'Isaiah 28:16'] },
        { title: 'Building Requires Intentionality', description: "A solid spiritual foundation doesn't happen by accident.", verses: ['Luke 6:46-49', 'Joshua 1:8', 'Psalm 119:105'] },
        { title: 'The Storm Reveals Our Foundation', description: "We don't really know what our life is built on until the storms come.", verses: ['James 1:2-4', '1 Peter 1:6-7', 'Romans 5:3-5'] },
      ],
      conclusion: "Examine your foundation today. If you've been building on sand, it's not too late to start over.",
    },
  },
  {
    title: 'Living with Eternal Perspective',
    preacher: 'Rev. Emily Wanjiku',
    church: 'P.C.E.A Murera Church',
    date: new Date('2025-03-17'),
    series: 'Kingdom Living',
    scriptureReferences: ['Philippians 3:20', 'Matthew 6:19-21', '2 Corinthians 5:10'],
    summary: 'Discovering how an eternal perspective changes our priorities and transforms how we live each day.',
    audioUrl: 'https://res.cloudinary.com/dppwytw0u/video/upload/v1771625140/2021-02-07_-_Week_5___Objections_to_Eternal_Security_The_Gospels___Secure_-_John_T._Clark_220262118345501_ejvv5c.mp3',
    content: {
      introduction: "We get one life to live, and how we live it matters forever.",
      points: [
        { title: 'This World is Not Our Home', description: "As Christians, we're citizens of heaven temporarily residing on earth.", verses: ['Philippians 3:20', '1 Peter 2:11', 'Hebrews 11:13-16'] },
        { title: 'Invest in What Lasts', description: "Jesus taught us to store up treasures in heaven, not on earth.", verses: ['Matthew 6:19-21', '1 Timothy 6:17-19', 'Luke 16:9'] },
        { title: 'Today Matters for Eternity', description: "Our eternal perspective shouldn't make us so heavenly minded that we're no earthly good.", verses: ['2 Corinthians 5:10', 'Colossians 3:23-24', 'Galatians 6:9'] },
      ],
      conclusion: "If you knew you had one year left to live, what would you change? Don't wait to live with purpose.",
    },
  },
];

const seriesData = [
  { name: 'Journey of Faith', description: 'A series on faith in everyday life' },
  { name: 'Spiritual Disciplines', description: 'Building spiritual habits that transform us' },
  { name: 'Living Like Jesus', description: 'Practical Christianity in a modern world' },
  { name: 'Anchored in Truth', description: "Standing firm on God's promises" },
  { name: 'Kingdom Living', description: "Living as citizens of God's kingdom" },
];

const importMockData = async () => {
  await connectDB();

  console.log('Ensuring series exist...');
  for (const s of seriesData) {
    await Series.findOneAndUpdate({ name: s.name }, s, { upsert: true, new: true });
  }

  console.log('Importing sermons (skipping duplicates)...');
  let inserted = 0;
  let skipped = 0;

  for (const sermon of mockSermons) {
    const exists = await Sermon.findOne({ title: sermon.title, date: sermon.date });
    if (exists) {
      console.log(`  SKIP  "${sermon.title}"`);
      skipped++;
      continue;
    }
    await Sermon.create(sermon);
    console.log(`  OK    "${sermon.title}"`);
    inserted++;
  }

  console.log(`\nDone. Inserted: ${inserted}, Skipped: ${skipped}`);
  process.exit(0);
};

importMockData().catch((err) => {
  console.error(err);
  process.exit(1);
});
