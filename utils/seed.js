require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Sermon = require('../models/Sermon');
const Series = require('../models/Series');

const seriesData = [
  { name: 'Journey of Faith', description: 'A series on faith in everyday life' },
  { name: 'Spiritual Disciplines', description: 'Building spiritual habits that transform us' },
  { name: 'Living Like Jesus', description: 'Practical Christianity in a modern world' },
  { name: 'Anchored in Truth', description: 'Standing firm on God\'s promises' },
  { name: 'Kingdom Living', description: 'Living as citizens of God\'s kingdom' },
];

const sermonData = [
  {
    title: 'Walking in Faith: Trusting God in Uncertain Times',
    preacher: 'Rev. James Kariuki',
    date: new Date('2026-01-14'),
    series: 'Journey of Faith',
    scriptureReferences: ['Hebrews 11:1', 'Proverbs 3:5-6', '2 Corinthians 5:7', 'Psalm 77:11-12', 'Hebrews 10:24-25'],
    summary: 'An encouraging message about maintaining faith during life\'s storms and trusting in God\'s perfect plan.',
    audioUrl: 'https://res.cloudinary.com/dppwytw0u/video/upload/v1771625140/2021-02-07_-_Week_5___Objections_to_Eternal_Security_The_Gospels___Secure_-_John_T._Clark_220262118345501_ejvv5c.mp3',
    video: { type: 'youtube', url: 'https://youtu.be/puGdqn6TWAQ' },
    content: {
      introduction: 'Good morning, church family. Today, we\'re going to explore what it means to walk by faith and not by sight, especially during those seasons when the path ahead seems unclear.',
      points: [
        { title: 'Faith is a Choice, Not a Feeling', description: 'Faith is a deliberate choice we make each day.', verses: ['Hebrews 11:1', 'Proverbs 3:5-6', '2 Corinthians 5:7'] },
        { title: 'God\'s Faithfulness in Our Past', description: 'Looking back at how God has been faithful gives us confidence for the future.', verses: ['Psalm 77:11-12', 'Lamentations 3:22-23'] },
        { title: 'The Power of Community in Faith', description: 'We were never meant to walk this journey alone.', verses: ['Hebrews 10:24-25', 'Galatians 6:2'] },
      ],
      conclusion: 'Take one step of faith this week.',
    },
  },
  {
    title: 'The Power of Prayer: Connecting with God',
    preacher: 'Rev. Sarah Muthoni',
    date: new Date('2026-01-21'),
    series: 'Spiritual Disciplines',
    scriptureReferences: ['Philippians 4:6-7', 'Matthew 6:6-8', 'Hebrews 4:16'],
    summary: 'Discovering the transformative power of prayer and developing a deeper relationship with God.',
    audioUrl: 'https://res.cloudinary.com/dppwytw0u/video/upload/v1771625140/2021-02-07_-_Week_5___Objections_to_Eternal_Security_The_Gospels___Secure_-_John_T._Clark_220262118345501_ejvv5c.mp3',
    content: {
      introduction: 'Prayer is the lifeline of our relationship with our Heavenly Father.',
      points: [
        { title: 'Prayer as Relationship, Not Religion', description: 'God desires authentic conversation with us.', verses: ['Philippians 4:6-7', 'Matthew 6:6-8'] },
        { title: 'The Elements of Effective Prayer', description: 'Jesus taught us a model for prayer.', verses: ['Matthew 6:9-13'] },
        { title: 'Persistence in Prayer', description: 'Persistence transforms us.', verses: ['Luke 18:1-8', '1 Thessalonians 5:17'] },
      ],
      conclusion: 'Set aside specific time each day for prayer.',
    },
  },
];

const adminUser = {
  name: 'PCEA Admin',
  email: 'admin@pceaonlineministry.com',
  password: 'Admin@1234',
  role: 'admin',
};

const seed = async () => {
  await connectDB();

  console.log('Clearing existing data...');
  await Promise.all([User.deleteMany(), Sermon.deleteMany(), Series.deleteMany()]);

  console.log('Seeding series...');
  await Series.insertMany(seriesData);

  console.log('Seeding sermons...');
  await Sermon.insertMany(sermonData);

  console.log('Seeding admin user...');
  await User.create(adminUser);

  console.log('Seed complete.');
  process.exit(0);
};

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
