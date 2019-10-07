const express = require("express");
const uuid = require("uuid/v4");
const logger = require("../logger");
const { bookmarks } = require("../store");
const BookmarksService = require("../bookmarks-service");

const bookmarksRouter = express.Router();
const bodyParser = express.json();

bookmarksRouter
  .route("/bookmarks")
  .get((req, res, next) => {
    const knexInstance = req.app.get("db");
    BookmarksService.getAllBookmarks(knexInstance)
      .then(bookmarks => {
        res.json(bookmarks);
      })
      .catch(next);
  })
  .post(bodyParser, (req, res) => {
    const { title, url, description, rating } = req.body;
    console.log(req.body);

    if (!title) {
      logger.error("Title is required");
      return res.status(400).send("Invalid data");
    }

    if (!url) {
      logger.error("URL is required");
      return res.status(400).send("Invalid data");
    }

    if (!description) {
      logger.error("Description is requried");
      return res.status(400).send("Invalid data");
    }

    if (!rating) {
      logger.error("Rating is required");
      return res.status(400).send("Invalid data");
    }

    const id = uuid();
    const bookmark = {
      id,
      title,
      url,
      description,
      rating
    };
    bookmarks.push(bookmark);
    logger.info(`Bookmark with id ${id} created`);

    res
      .status(201)
      .location(`http://localhost:8000/bookmarks/${id}`)
      .json(bookmark);
  });

bookmarksRouter
  .route("/bookmarks/:id")
  .get((req, res, next) => {
    const knexInstance = req.app.get("db");
    BookmarksService.getById(knexInstance, req.params.id)
      .then(bookmark => {
        if (!bookmark) {
          logger.error(`Bookmark with id ${req.params.id} not found`);
          return res
            .status(404)
            .json({ error: { message: `Bookmark not found.` } });
        }

        res.json(bookmark);
      })
      .catch(next);
  })

  .delete((req, res) => {
    const { id } = req.params;

    const bookmarkIndex = bookmarks.findIndex(bookmark => bookmark.id == id);

    if (bookmarkIndex === -1) {
      logger.error(`Bookmark with id: ${id} not found`);
      return res.status(404).send("Not found");
    }

    //remove bookmark
    bookmarks.splice(bookmarkIndex, 1);
    logger.info(`Card with id: ${id} deleted.`);

    res.status(204).end();
  });

module.exports = bookmarksRouter;
