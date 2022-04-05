const express = require('express');
const Blueprint = require('../schema/blueprint');
const Account = require("../schema/account");
const verifyJWT = require("./verifyJWT");

const router = express.Router();

const paginationCountLimit = 100;
const paginationCountDefault = 1;

require("dotenv/config");

function processBlueprintQuery(rawQuery, timeStamp) {
    // Construct query - exact matches
    let query = {
        _id: rawQuery._id,
        author: rawQuery.author,
        likeCount: rawQuery.likeCount,
        version: rawQuery.version,
        createdAt: rawQuery.createdAt
    };

    // Name must contain the query
    if ("friendlyname" in rawQuery) { query.friendlyname = { "$regex": rawQuery.friendlyname, "$options": "i" }; }   

    // Check if the URI query came with a timestamp, add it to the query if so.
    // All blueprints must have been created before the time given. This is used to prevent page drift.
    if (timeStamp) { query.createdAt = { "$lte": timeStamp }; }

    // Likes must contain all queries
    if ("likes" in rawQuery) { query.likes = { "$all": rawQuery.buildings }; }

    // Description must contain the query
    if ("description" in rawQuery) { query.description = { "$regex": rawQuery.description, "$options": "i" }; }

    // Tags must contain all queries
    if ("tags" in rawQuery) { query.tags = { "$all": rawQuery.tags }; }

    // Buildings must contain all queries
    if ("buildings" in rawQuery) { query.buildings = { "$all": rawQuery.buildings }; }

    // Dig comamnds must contain all dig queries
    if ("digcommands" in rawQuery) { query.digcommands = { "$all": rawQuery.digcommands }; }

    return query;
}

// DOWNLOAD BLUEPRINT / PAGINATION
router.post("/", async (req, res) => {
    // Make sure the body contains the query and add an empty query if not ( gets all blueprints )
    if (!("query" in req.body)) { req.body.query = {}; }

    // Make sure the body contains a sorter and add an ascending name sort if not
    if (!("sort" in req.body)) { req.body.sort = { "friendlyname": 1 }; }

    // Make sure the query parameters are there if they're not already and that they're numbers
    if (!("offset" in req.query) || isNaN(req.query.offset)) { req.query.offset = 0; }
    if (!("count" in req.query) || isNaN(req.query.count)) { req.query.count = paginationCountDefault; }

    // Extract the queries
    let offset = parseInt(req.query.offset);
    let count = parseInt(req.query.count);

    // Perform further validation on their values
    if (offset < 0) { offset = 0; }
    if (count < 1) { count = 1; }
    if (count > paginationCountLimit) { count = paginationCountLimit; }

    let query = processBlueprintQuery(req.body.query, req.param.time);

    // Validate it
    let validateQuery = await Blueprint.queryValidator.validate(query);
    if (validateQuery.error) { return res.status(400).send(validateQuery.error.details[0].message); }

    // Perform query
    try {
        let blueprints = await Blueprint.model.find(query, req.body.select, { "skip": offset, "sort": req.body.sort, "lean": true }).exec();
        
        // Calculate information needed for pagination
        let previousPageOffset = Math.max(0, offset - count);
        let previousPageCount = Math.min(count, offset - previousPageOffset);

        let nextPageOffset = offset + count;
        let nextPageCount = Math.min(count, Math.max(0, blueprints.length - nextPageOffset));

        let time = (req.query.time ? req.query.time : new Date().toISOString());
        let timeQueryParam = "&time=" + time;

        // Construct return object.
        let returnObject = {
            "pagination": {},
            "total_matches": blueprints.count,
            "offset": offset,
            "count": count,
            "time": time,
            "body": req.body,
            "results": blueprints.splice(0, count)  
        };

        // Add pagination resources if appropriate
        if (previousPageCount > 0) { returnObject.pagination.previous_page = process.env.SITE_URL + "/blueprint?offset=" + previousPageOffset + "&count=" + previousPageCount + timeQueryParam; }
        if (nextPageCount > 0) { returnObject.pagination.next_page = process.env.SITE_URL + "/blueprint?offset=" + nextPageOffset + "&count=" + nextPageCount + timeQueryParam; }

        res.status(200).json(returnObject);
    } 
    
    catch (error) {
        res.status(400).send(String(error));
    }
});

// UPLOAD BLUEPRINT
router.post("/upload", verifyJWT, async (req, res) => {
    // Check if variables passed in body are valid and only pull variables we need ( no injecting extras )
    let validateBlueprint = await Blueprint.validator.validate({
        "author": req.account._id,
        "friendlyname": req.body.friendlyname,
        "version": req.body.version,
        "description": req.body.description,
        "buildings": req.body.buildings,
        "digcommands": req.body.digcommands, 
    });
    if (validateBlueprint.error) { return res.status(400).send(validateBlueprint.error.details[0].message); }

    // Attempt to add the blueprint to the database
    let newBlueprint = await Blueprint.model.create(validateBlueprint.value);
    if (newBlueprint.error) { return res.status(500).send(newBlueprint.error.message); }

    // Send valid response, ID is sent back so that the mod can copy the ID to the user's clipboard. Could be used for other stuff too.
    res.status(200).json({
        message: "Blueprint Added",
        id: newBlueprint._id
    });
});

// DELETE BLUEPRINT
router.delete("/", verifyJWT, async (req, res) => {
    let query = processBlueprintQuery(req.body.query);

    let validateQuery = await Blueprint.queryValidator.validate(query);
    if (validateQuery.error) { return res.status(400).send(validateQuery.error.details[0].message); }

    // If the authorized account is not an admin the account needs to own the blueprints.
    if (req.account.level !== 5) {
        query._id = req.account._id;
    }

    // Perform query
    try {
        let blueprints = await Blueprint.model.deleteMany(query).exec();

        if (blueprints.length) {
            res.status(200).json({
                message: "Deleted blueprints",
                blueprint_count: blueprints.length
            });
        }

        else {
            res.status(200).json({
                message: "No matching blueprints were found",
                blueprint_count: blueprints.length
            });
        }

    }

    catch (error) {
        res.status(400).send(String(error));
    }
});

module.exports = router;