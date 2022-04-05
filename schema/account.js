const mongoose = require("mongoose");
const joi = require("@hapi/joi");

const accountSchema = new mongoose.Schema({
    username: String,
    last_ipaddress: String,
    email: String,
    password: String,
    level: Number,
    createdAt: Date
});

const accountValidator = joi.object().keys({
    username: joi.string().min(6).max(32).alphanum().required(),
    last_ipaddress: joi.string().ip(),
    email: joi.string().email().required(),
    password: joi.string().required(),
    level: joi.number().integer().min(0).max(5).default(1),
    createdAt: joi.date().default(Date.now)
});

module.exports = {
    schema: accountSchema,
    model: mongoose.model("account", accountSchema, "accounts"),
    validator: accountValidator
};