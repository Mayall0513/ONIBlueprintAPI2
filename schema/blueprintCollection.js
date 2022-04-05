const mongoose = require("mongoose");
const joi = require("@hapi/joi");

const blueprintCollectionSchema = new mongoose.Schema({
    author: mongoose.Schema.ObjectId,
    friendlyname: String,
    blueprints: [mongoose.Schema.ObjectId],
    createdAt: Date
});

const blueprintCollectionValidator = joi.object().keys({
    author: joi.required(),
    friendlyname: joi.string().min(6).required(),
    blueprints: joi.array().has(joi.string()).required(),
    createdAt: joi.date().default(Date.now)
});

module.exports = {
    schema: blueprintCollectionSchema,
    model: mongoose.model("blueprint_collection", blueprintCollectionSchema, "collections"),
    validator: blueprintCollectionValidator
};