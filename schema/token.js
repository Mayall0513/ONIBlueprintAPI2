const mongoose = require("mongoose");
const joi = require("@hapi/joi");

const tokenSchema = new mongoose.Schema({
    _userId: String,
    token: String,
    createdAt: Date
});

const tokenValidator = joi.object().keys({
    _userId: joi.required(),
    token: joi.string().required(),
    createdAt: joi.date().default(Date.now)
});

module.exports = {
    schema: tokenSchema,
    model: mongoose.model("token", tokenSchema, "tokens"),
    validator: tokenValidator
};