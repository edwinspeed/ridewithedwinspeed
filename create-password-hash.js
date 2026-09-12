const readline = require('readline');
const bcrypt = require('bcryptjs');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });

rl.question('Enter the new admin password: ', async (password) => {
  try {
    const hash = await bcrypt.hash(password, 12);
    console.log('\nCopy this value into ADMIN_PASSWORD_HASH:\n');
    console.log(hash);
  } finally {
    rl.close();
  }
});
