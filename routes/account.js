const router = require("express").Router();
const jwt = require("jsonwebtoken");
const Account = require("../schema/account");
const Token = require("../schema/token");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const sgMail = require("@sendgrid/mail");
const verifyJWT = require("./verifyJWT");
const emailTemplate = require("../util/emailTemplate");

require("dotenv/config");

// GET INFORMATION ON AN ACCOUNT
router.get("/info", verifyJWT, async (req, res) => {
    res.json({
        username: req.account.username,
        email: req.account.email,
        createdAt: req.account.createdAt,
    });
});

// LOGIN
router.post("/login", async (req, res) => {
    // Make sure required information was given
    if (!("username" in req.body) && !("email" in req.body) || !("password" in req.body)) { return res.status(400).send("Missing account information."); }

    // Check Account does already exist in DB
    let existingAccountName = await Account.model.findOne({ username: req.body.username });
    let existingAccountEmail = await Account.model.findOne({ email: req.body.email });
    if (!existingAccountEmail && !existingAccountName) { return res.status(400).send("Invalid Account or Password Information."); }

    // Set valid account to email or password used
    let validateAccount;
    if (existingAccountEmail) { validateAccount = existingAccountEmail; }
    if (existingAccountName) { validateAccount = existingAccountName; }

    if (validateAccount.level === 1) { return res.status(400).send("Account not verified."); }
    if (validateAccount.level === 0) { return res.status(400).send("Account banned."); }

    // Confirm Passwords Match
    let passwordCorrect = await bcrypt.compare(req.body.password, validateAccount.password);
    if (!passwordCorrect) { return res.status(400).send("Invalid Account or Password Information."); }

    // Generate JWT Token for valid user and Send Login Successful
    const token = jwt.sign({ _id: validateAccount._id }, process.env.JWT_SALT);
    res.json({
        message: "Log In successful!",
        token: token
    });
});

// REGISTER
router.post("/register", async (req, res) => {
    // Make sure required information was given
    if (!("username" in req.body)) { return res.status(400).send("Missing \"username\"."); }
    if (!("email" in req.body)) { return res.status(400).send("Missing \"email\"."); }
    if (!("password" in req.body)) { return res.status(400).send("Missing \"password\"."); }

    // Check if variables passed in body are valid and only pull variables we need ( no injecting extras )
    let validateAccount = await Account.validator.validate({
        username: req.body.username,
        email: req.body.email,
        password: req.body.password
    });
    if (validateAccount.error) { return res.status(400).send(validateAccount.error.details[0].message); }

    // Check Account does not already exist in DB
    let existingAccountName = await Account.model.findOne({ username: validateAccount.value.username });
    if (existingAccountName) { return res.status(409).send("An account with that username already exists."); }

    let existingAccountEmail = await Account.model.findOne({ email: validateAccount.value.email });
    if (existingAccountEmail) { return res.status(409).send("An account with that email address already exists."); }

    // Create New Account in Database
    let newAccount = await Account.model.create({
        username: validateAccount.value.username,
        last_ipaddress: req.ip,
        email: validateAccount.value.email,
        password: bcrypt.hashSync(validateAccount.value.password, 17),
        avatar: validateAccount.value.avatar,
        createdAt: validateAccount.value.createdAt,
        level: 1
    });
    if (newAccount.error) { return res.status(500).send(newAccount.error.message); }

    // Validate Token Data
    let newToken = await Token.validator.validate({
        _userId: newAccount._id,
        token: crypto.randomBytes(16).toString("hex")
    });
    if (newToken.error) { return res.status(400).send(newToken.error.message); }

    // Create New Token in Database
    let token = await Token.model.create(newToken.value);
    if (token.error) { return res.status(500).send(error.message); }

    // Account Creation Successful - Sending Email Verifcation                                
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    sgMail.send({
        to: newAccount.email,
        from: "no-reply@blueprints-not-included.com",
        subject: "Blueprints-Not-Included Account Verification",
        // Add find / replace for environment var and token using static html
        html: emailTemplate.verifyAccount(process.env.SITE_URL + "/account-verification?auth=" + token.token)
    });

    res.status(200).send("Account registration successful. Email verification sent.");
});

// LOST PASSWORD REQUEST
router.post("/password/lost", async (req, res) => {
    // Make sure required information was given
    if (!("username" in req.body) && !("email" in req.body)) { return res.status(400).send("Missing username and email. (one is required)"); }

    // Check Account does already exist in DB
    let existingAccountName = await Account.model.findOne({ username: req.body.email });
    let existingAccountEmail = await Account.model.findOne({ email: req.body.email });
    if (!existingAccountEmail && !existingAccountName) { return res.status(400).send("We were unable to find a account with that email or username."); }

    // Set valid account to email or password used
    let validateAccount;
    if (existingAccountEmail) { validateAccount = existingAccountEmail; }
    if (existingAccountName) { validateAccount = existingAccountName; } // Favours username based query over email if both are given

    if (validateAccount.level === 1) { return res.status(400).send("This account has not been verified."); }
    if (validateAccount.level === 0) { return res.status(400).send("This account is banned. You have been a bad dupe!"); }

    // Delete old Tokens in Database
    let token = await Token.model.deleteMany({ _userId: validateAccount._id });
    if (token.error) { return res.status(500).send(error.message); }

    // Create New Token in Database
    let newToken = await Token.validator.validate({
        _userId: validateAccount._id,
        token: crypto.randomBytes(16).toString("hex")
    });

    token = await Token.model.create(newToken.value);
    if (token.error) { return res.status(500).send(error.message); }

    // Account Creation Successful - Sending Email Verifcation                                
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    sgMail.send({
        to: validateAccount.email,
        from: "no-reply@blueprints-not-included.com",
        subject: "Blueprints-Not-Included Password Reset",
        // Add find / replace for environment var and token using static html
        html: emailTemplate.resetPassword(process.env.SITE_URL + "/password-reset?auth=" + token.token)
    });

    return res.status(200).send("Password reset email send successfully. Check your email.");
});

// RESET PASSWORD ACCOUNT
router.post("/password/reset", async (req, res) => {
    // Make sure required information was given
    if (!("token" in req.body)) { return res.status(400).send("Missing token"); }
    if (!("password" in req.body)) { return res.status(400).send("Missing new password"); }

    // Find a matching token
    let token = await Token.model.findOne({ token: req.body.token });
    if (!token) return res.status(400).send("We were unable to find a valid token. Your token my have expired.");

    // If we found a token, find a matching user
    let account = await Account.model.findOne({ _id: token._userId });
    if (!account) { return res.status(400).send("We were unable to find a user for this token."); }
    if (account.level === 1) { return res.status(400).send("This account has not been verified."); }
    if (account.level === 0) { return res.status(400).send("This account is banned. You have been a bad dupe!"); }

    // Reset Password
    account.password = bcrypt.hashSync(req.body.password, 17);

    // Set account status to active ie level 2 and save to database
    let saved = await account.save();
    if (saved.error) { return res.status(500).send(saved.error); }

    // Remove Used Token
    token = await Token.model.deleteMany({ _userId: account._id });
    if (token.error) { return res.status(500).send(error.message); }

    return res.status(200).send("Thank you, your password has been reset. Please login.");
});

// VERIFY ACCOUNT
router.post("/verify", async (req, res) => {
    // Make sure required information was given
    if (!("token" in req.body)) { return res.status(400).send("Missing token"); }

    // Find a matching token
    let token = await Token.model.findOne({ token: req.body.token });
    if (!token) return res.status(400).send('We were unable to find a valid token. Your token my have expired or your account was already verified with this token.');

    // If we found a token, find a matching user
    let account = await Account.model.findOne({ _id: token._userId });
    if (!account) { return res.status(400).send("We were unable to find a user for this token."); }
    if (account.level > 1) { return res.status(400).send("This user has already been verified."); }

    // Set account status to active ie level 2 and save to database
    account.level = 2;
    let saved = await account.save();
    if (saved.error) { return res.status(500).send(saved.error); }

    // Remove Used Token
    token = await Token.model.deleteMany({ _userId: account._id });
    if (token.error) { return res.status(500).send(error.message); }

    return res.status(200).send("Thank you, your account has been verified. Please log in.");
});

// RESEND VERIFICATION EMAIL
router.post("/resend-verify", async (req, res) => {
    // find account to re-verify and send new token
    let account = await Account.model.findOne({ email: req.body.email });
    if (!account) { return res.status(400).send("We were unable to find a user with that email."); }
    if (account.level > 1) { return res.status(400).send("This account has already been verified. Please log in."); }
    if (account.level === 0) { return res.status(400).send("This account is banned, you have been a bad dupe."); }

    // Delete old Tokens in Database
    let token = await Token.model.deleteMany({ _userId: account._id });
    if (token.error) { return res.status(500).send(error.message); }

    // Create New Token in Database
    let newToken = await Token.validator.validate({
        _userId: account._id,
        token: crypto.randomBytes(16).toString('hex')
    });
    token = await Token.model.create(newToken.value);
    if (token.error) { return res.status(500).send(error.message); }

    // Account Creation Successful - Sending Email Verifcation                                
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    sgMail.send({
        to: account.email,
        from: "no-reply@blueprints-not-included.com",
        subject: "Blueprints-Not-Included Account Verification",
        // Add find / replace for environment var and token using static html
        html: emailTemplate.verifyAccount(process.env.SITE_URL + "/account-verification?auth=" + token.token)
    });

    return res.status(200).send("Account registration successful; email verification sent.");
});

module.exports = router;