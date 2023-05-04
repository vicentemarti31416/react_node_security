const dotenv = require('dotenv');
dotenv.config();
const User = require('../models/user.model');
const UserVerification = require('../models/user_verification.model');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { validateEmail, validatePassword, usedEmail } = require('../../utils/validators');
const { generateSign, verifySign } = require('../../utils/jwt');
const router = require('../routes/user.router');

const transporter = nodemailer.createTransport({
    host: 'smtp.office365.com',
    port: 587,
    secure: false, // Si el puerto es 587, debe ser false; si el puerto es 465, debe ser true
    auth: {
        user: process.env.AUTH_EMAIL,
        pass: process.env.AUTH_PASSWORD,
    },
    tls: {
        ciphers: 'SSLv3',
        rejectUnauthorized: false,
    },
});

transporter.verify((error, success) => {
    if (error) {
        console.log(error);
    } else {
        console.log("Transporter working properly");
        console.log(success);
    }
})

const sendVerificationEmail = ({ _id, email }, res) => {
    const currentUri = 'http://127.0.0.1:5000/'; // Si la aplicación está en un host esta URI será distinta
    const uniqueString = uuidv4() + _id;
    const mailOptions = {
        from: process.env.AUTH_EMAIL,
        to: email,
        subject: 'Verify your email',
        html: `
            <p>Verify your address to complete de registry process</p>
            <p>This link <b>expires in six hours</b></p>
            <a href=${currentUri + "user/verify/" + _id + "/" + uniqueString} target="_blank">Verify your email</a>`
};

    const saltRounds = 10;
    bcrypt
        .hash(uniqueString, saltRounds)
        .then((hashedUniqueString) => {
            const newUserVerification = new UserVerification({
                userId: _id,
                uniqueString: hashedUniqueString,
                createdAt: Date.now(),
                expiresAt: Date.now() + 21600000
            });
            newUserVerification
                .save()
                .then(() => {
                    transporter
                        .sendMail(mailOptions)
                        .then((error) => {
                            console.log(error)
                        })
                        .catch((error) => {
                            console.log(error)
                        });
                })
                .catch((error) => {
                    console.log(error)
                });
        })
        .catch((error) => res.status(500).json(error));
}

const verify = async (req, res) => {
    let { userId, uniqueString } = req.params;
    UserVerification
        .find({ userId })
        .then((result) => {
            if (result.length > 0) {
                const { expiresAt } = result[0];
                const hashedUniqueString = result[0].uniqueString;
                if (expiresAt < Date.now()) { // Si el link de verificación ha expirado
                    console.log(userId)
                    UserVerification
                        .deleteOne({ userId })
                        .then(() => {
                            User
                                .deleteOne({ _id: userId })
                                .then(() => {
                                    let message = 'The verification link has expired, please sign up again';
                                    res.redirect(`/user/verified?error=true&message=${message}`);
                                })
                                .catch((error) => {
                                    let message = 'Clearing the user with the verification record has failed';
                                    res.redirect(`/user/verified?error=true&message=${message}`);
                                })
                        })
                        .catch((error) => {
                            let message = 'An error ocurred while verifying user verification record';
                            res.redirect(`/user/verified?error=true&message=${message}`);
                        });
                } else { // Si el link de verificación continúa siendo válido
                    bcrypt
                        .compare(uniqueString, hashedUniqueString) // Comparamos el uniqueString pasado al método verify con el que hay en la base de datos
                        .then((result) => {
                            if (result) {
                                User
                                    .updateOne({ _id: userId }, { verified: true })
                                    .then((result) => {
                                        UserVerification
                                            .deleteOne({ userId })
                                            .then(() => res.sendFile(path.join(__dirname, '../../views/verification.html')))
                                            .catch((error) => {
                                                let message = 'An error ocurred while finalizing the verification process';
                                                res.redirect(`/user/verified?error=true&message=${message}`);
                                            });
                                    })
                                    .catch((error) => {
                                        let message = 'An error ocurred while updating the user verification field';
                                        res.redirect(`/user/verified?error=true&message=${message}`);
                                    });
                            } else {
                                let message = 'An error ocurred while clearing the expired user verification record';
                                res.redirect(`/user/verified?error=true&message=${message}`);
                            }
                        })
                        .catch((error) => {
                            let message = 'Account record does not exists or has been verified already. Please sign up or log in';
                            res.redirect(`/user/verified?error=true&message=${message}`);
                        })
                }
            } else {
                let message = 'Account record does not exists or has been verified already. Please sign up or log in';
                res.redirect(`/user/verified?error=true&message=${message}`);
            }
        })
        .catch((error) => {
            let message = 'An error ocurred while checking if exists the user';
            res.redirect(`/user/verified?error=true&message=${message}`);
        })
};

const verified = (req, res) => {
    res.sendFile(path.join(__dirname, '../../views/verification.html'));
}

const register = async (req, res) => {
    try {
        const newUser = new User(req.body);
        if (!validateEmail(newUser.email)) {
            return res.status(400).send({ message: 'Invalid email' });
        }
        if (!validatePassword(newUser.password)) {
            return res.status(400).send({ message: 'Invalid password (Format: UPPERCASE, lowercase, numbers, simbols, minlength = 10' });
        }
        if (await usedEmail(newUser.email) > 0) {
            return res.status(400).send({ message: 'Email is already in use' });
        }
        newUser.password = bcrypt.hashSync(newUser.password, 10);
        const createdUser = await newUser.save();
        sendVerificationEmail(createdUser);
        return res.status(201).json(createdUser);
    } catch (error) {
        return res.status(500).json(error)
    }
}

const login = async (req, res) => {
    try {
        const userInfo = await User.findOne({ email: req.body.email })
        if (!userInfo.verified) {
            return res.status(404).json({ message: 'Email has not been verified' });
        }
        if (!userInfo) {
            return res.status(404).json({ message: 'invalid email address' });
        }
        if (!bcrypt.compareSync(req.body.password, userInfo.password)) {
            return res.status(404).json({ message: 'invalid password' });
        }
        const token = generateSign(userInfo._id, userInfo.email);
        return res.status(200).json({ userInfo, token });
    } catch (error) {
        return res.status(500).json(error);
    }
}

const checksession = async (req, res) => {
    try {
        res.status(200).json(req.user)
    } catch (error) {
        return res.status(500).json(error)
    }
}

module.exports = { login, register, checksession, verify, verified };