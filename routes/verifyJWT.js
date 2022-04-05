const jwt = require("jsonwebtoken");
const Account = require("../schema/account");

module.exports = async function (req, res, next) {
    if(!("authorization" in req.headers)) { return res.status(401).send("Access Denied"); }

    let verified = jwt.verify(req.headers.authorization, process.env.JWT_SALT);
    if (!verified) { return res.status(401).send("Access Denied"); }

    // Grab account ID from verify Token and check its validity
    let account = await Account.model.findById(verified._id);

    // Make sure the account exists and it is verified and not banned
    if (!account) { return res.status(400).send("Account not found"); }
    if (account.level === 1) { return res.status(400).send("Account not verified"); }
    if (account.level === 0) { return res.status(400).send("Account banned"); }

    // Cache account and move to next middleware
    req.account = account;
    next();
};