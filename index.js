const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const { connect } = require('./src/utils/database'); 
const routerUser = require('./src/api/routes/user.router');

const PORT = process.env.PORT || 7000;

const app = express();
connect();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use('/user', routerUser);

app.listen(PORT, () => console.log(`listening on: http://localhost:${PORT}`));