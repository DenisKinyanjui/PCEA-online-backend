const crypto = require('crypto');

function personalizedQuizOrder(questions, userId) {
  return questions
    .map((question) => {
      const id = String(question._id);
      const orderKey = crypto.createHash('sha256').update(`${userId}:${id}`).digest('hex');
      return { question, orderKey };
    })
    .sort((left, right) => left.orderKey.localeCompare(right.orderKey))
    .map(({ question }) => question);
}

module.exports = { personalizedQuizOrder };