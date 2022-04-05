const mongoose = require("mongoose");
const joi = require("@hapi/joi");

const blueprintSchema = new mongoose.Schema({
    author: mongoose.Schema.ObjectId,
    friendlyname: String,
    likes: [mongoose.Schema.ObjectId],
    likeCount: Number,
    version: String,
    description: String,
    buildings: [{
        _id: false,
        offset: {
            _id: false,
            x: Number,
            y: Number
        },
        buildingdef: String,
        selected_elements: [
            Number
        ],
        orientation: Number,
        flags: Number
    }],
    digcommands: [{
        _id: false,
        x: Number,
        y: Number
    }],
    tags: [String],
    createdAt: Date
});

const coordinateValidator = joi.object().keys({
    x: joi.number().integer().required(),
    y: joi.number().integer().required()
});

const buildingValidator = joi.object().keys({
    offset: coordinateValidator.required(),
    buildingdef: joi.string().required(),
    selected_elements: joi.array().min(1).items(joi.number().integer()).required(),
    orientation: joi.number().integer().min(0).max(6).required(),
    flags: joi.number().integer().default(0)
});

const blueprintValidator = joi.object().keys({
    author: joi.required(),
    friendlyname: joi.string().min(1).required(),
    likes: joi.array().items(joi.string()).default([]),
    likeCount: joi.number().integer().min(0).default(0),
    version: joi.string().default("1.0.0"),
    description: joi.string().default("No description."),
    buildings: joi.array().has(buildingValidator),
    digcommands: joi.array().has(coordinateValidator),
    tags: joi.array().items(joi.string()).default([]),
    createdAt: joi.date().default(Date.now)
}).or("buildings", "digcommands");

const queryValidator = joi.object().keys({
    author: joi.string(),
    friendlyname: joi.string(),
    likes: joi.array().items(joi.string()),
    likeCount: joi.number().integer().min(0),
    version: joi.string(),
    description: joi.string(),
    buildings: joi.array().has(buildingValidator),
    digcommands: joi.array().has(coordinateValidator),
    tags: joi.array().items(joi.string()),
    createdAt: joi.date()
});

module.exports = {
    schema: blueprintSchema,
    model: mongoose.model("blueprint", blueprintSchema, "blueprints"),
    validator: blueprintValidator,
    queryValidator: queryValidator
};