const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const cors = require('cors');
const { connect } = require('./src/utils/database');
const routerUser = require('./src/api/routes/user.router');

const PORT = process.env.PORT || 7000;

const app = express();
connect();

const corsOptions = {
    origin: 'http://localhost:3000',
    methods: 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    allowedHeaders: 'Content-Type, Authorization, Access-Control-Allow-Origin',
    optionsSuccessStatus: 200,
};

app.use(express.json());
app.use(cors(corsOptions));
app.use(express.urlencoded({ extended: false }));

app.use('/user', routerUser);
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Not Found', message: 'The requested route was not found on this server' });
});


app.listen(PORT, () => console.log(`listening on: http://localhost:${PORT}`));