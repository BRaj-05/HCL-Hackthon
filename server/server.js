
require("dotenv").config();

const app = require('./services/createApp').createApp();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
