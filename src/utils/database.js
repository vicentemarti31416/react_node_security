const dotenv = require('dotenv');
dotenv.config();

const mongoose = require('mongoose'); 
const MONGODB_URI = process.env.MONGODB_URI;

const connect = async () => {
    try {
        const db = await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        const { name, host } = db.connection;
        console.log(`Connected to ${name} DB in host: ${host}`);
    } catch (error) {
        console.log(`He tenido un error al conectar con mi BBDD: ${error}`);
    }
}

module.exports = { connect }