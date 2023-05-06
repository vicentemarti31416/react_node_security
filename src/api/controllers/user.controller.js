const dotenv = require('dotenv');
dotenv.config();
const User = require('../models/user.model');
const PasswordReset = require('../models/PasswordReset');
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
        const token = generateSign(userInfo._id, userInfo.username, userInfo.email);
        console.log('Successfully logged in')
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

const resetEmail = (req, res) => {
    const { email, redirectUri } = req.body;
    console.log(email, redirectUri)
    User
        .find({ email })
        .then((data) => {
            if (data.length) {
                if (!data[0].verified) {
                    res.json({
                        status: 'FAILED',
                        message: 'An error ocurred while checking if exists the user'
                    })
                } else {
                    sendResetEmail(data[0], redirectUri, res)
                }
            } else {
                res.json({
                    status: 'FAILED',
                    message: 'An error ocurred while checking if exists the user'
                })
            }
        })
        .catch((error) => console.log(error));
}

const sendResetEmail = ({ _id, email }, redirectUri, res) => {
    const resetString = uuidv4() + _id;
    PasswordReset
        .deleteMany({ userId: _id }) // Borramos todos los intentos de reset que hayan
        .then((result) => {
            const mailOptions = {
                from: process.env.AUTH_EMAIL,
                to: email,
                subject: 'Password Reset',
                html: `
                    <p>Use the link below to reset the password</p>
                    <p>This link <b>expires in one hour</b></p>
                    <a href=${redirectUri + "/" + _id + "/" + resetString} target="_blank">Verify your email</a>`
            };
            const saltRounds = 10;
            bcrypt
                .hash(resetString, saltRounds)
                .then((hashedResetString) => {
                    const passwordReset = new PasswordReset({
                        userId: _id,
                        resetString: hashedResetString,
                        createdAt: Date.now(),
                        expiresAt: Date.now() + 3600000
                    })
                    passwordReset
                        .save()
                        .then(() => {
                            transporter
                                .sendMail(mailOptions)
                                .then(() => {
                                    res.json({
                                        status: 'PENDING',
                                        message: 'An reset email has been sent to your email'
                                    })
                                })
                                .catch((error) => console.log(error));
                        })
                        .catch((error) => console.log(error));
                })
                .catch((error) => console.log(error));
        })
        .catch
        ((error) => console.log(error));
}

const resetPassword = (req, res) => {
    const { userId, resetString, newPassword } = req.body;
    PasswordReset
        .find({ userId })
        .then((result) => {
            if (result.length > 0) {
                const { expiresAt } = result[0];
                const hashedResetString = result[0].resetString;
                if (expiresAt < Date.now()) {
                    PasswordReset // Si el enlace ha expirado lo borramos
                        .deleteOne({ userId })
                        .then((result) => {
                            console.log(result);
                            res.json({
                                status: 'FAILED',
                                message: 'The password reset link has expired'
                            })
                        })
                        .catch((error) => { // Si el borrado del enlace caducado falla mostramos los mensajes de error
                            console.log(error);
                            res.json({
                                status: 'FAILED',
                                message: 'Clearing the password reset record failed'
                            })
                        });
                } else { // Si el usuario existe y el enlace no ha expirado comparamos el resetString enviado en la request con el de la base de datos
                    bcrypt
                        .compare(resetString, hashedResetString)
                        .then((result) => {
                            if (result) {
                                const saltRounds = 10;
                                bcrypt
                                    .hash(newPassword, saltRounds)
                                    .then((hashedNewPassword) => {
                                        User
                                            .updateOne({ _id: userId }, { password: hashedNewPassword })
                                            .then((result) => {
                                                PasswordReset
                                                    .deleteOne({ userId })
                                                    .then((result) => {
                                                        res.json({
                                                            status: 'SUCCESS',
                                                            message: 'Password has been updated successfully'
                                                        })
                                                    })
                                                    .catch((error) => {
                                                        console.log(error);
                                                        res.json({
                                                            status: 'FAILED',
                                                            message: 'An error ocurred while deleting the password reset record'
                                                        })
                                                    });
                                            })
                                            .catch((error) => {
                                                console.log(error);
                                                res.json({
                                                    status: 'FAILED',
                                                    message: 'Updating usesr password failed'
                                                })
                                            });
                                    })
                                    .catch((error) => {
                                        console.log(error);
                                        res.json({
                                            status: 'FAILED',
                                            message: 'An error ocurred while hashing the neww password'
                                        })
                                    });
                            } else {
                                res.json({
                                    status: 'FAILED',
                                    message: 'Invalid password reset details passed'
                                })
                            }
                        })
                        .catch((error) => {
                            console.log(error);
                            res.json({
                                status: 'FAILED',
                                message: 'Comparing the password string resets failed'
                            })
                        });
                }
            } else {
                res.json({
                    status: 'FAILED',
                    message: 'The password reset link does not exists'
                })
            }
        })
        .catch((error) => {
            console.log(error);
            res.json({
                status: 'FAILED',
                message: 'Checking for an existing password reset record failed'
            })
        });
}

module.exports = { login, register, checksession, verify, verified, resetEmail, resetPassword };