require('dotenv').config();
const connectDB = require('../config/db');
const User = require('../models/User');

const ADMIN = {
  name: 'Admin',
  email: 'admin@pceaonlineministry.com',
  password: 'Adm1n123',
  role: 'super_admin',
  church: null,
};

const addAdmin = async () => {
  await connectDB();

  const existing = await User.findOne({ email: ADMIN.email });

  if (existing) {
    existing.name = ADMIN.name;
    existing.password = ADMIN.password;
    existing.role = ADMIN.role;
    existing.church = null;
    await existing.save();
    console.log(`Updated existing user to super_admin: ${ADMIN.email}`);
  } else {
    await User.create(ADMIN);
    console.log(`Created super_admin: ${ADMIN.email}`);
  }

  console.log('Done.');
  process.exit(0);
};

addAdmin().catch((err) => {
  console.error(err);
  process.exit(1);
});
